const jwt = require("jsonwebtoken")
const User = require("../Models/userModel")
const sendTokens = require("../Utils/sendTokens")
const Otp=require("../Models/otpModel")
const bcrypt = require("bcrypt");
const sendEmail=require("../Config/nodeMailer")
const {getOtpEmailHtml,getResetPasswordEmailHtml}=require("../Utils/emailContentProvider")
const axios=require("axios")
//for sendingOtp to User
const sendOtp = async (req, res) => {
  try {
    const { name, email, password, purpose } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({ message: "Email & purpose are required" });
    }

    // 🔹 REGISTER FLOW
    if (purpose === "register") {
      if (!name || !password) {
        return res
          .status(400)
          .json({ message: "Name & password required for register" });
      }

      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(400).json({ message: "User already exists" });
      }
    }

    // 🔹 RESET PASSWORD FLOW
    if (purpose === "reset") {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // ❗ Block pure Google accounts from using forgot password
      if (user.authProvider === "google" && !user.password) {
        return res.status(400).json({
          message:
            "This account uses Google login. Please use 'Continue with Google' to sign in.",
        });
      }
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const hashedPass = password ? await bcrypt.hash(password, 10) : null;

    await Otp.findOneAndUpdate(
      { email },
      {
        otp,
        purpose,
        name: name || null,
        password: hashedPass || null,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      { upsert: true }
    );

    const subject =
      purpose === "reset"
        ? "Reset your Leather Haven password"
        : "Your Leather Haven verification code";

    const html =
      purpose === "reset"
        ? getResetPasswordEmailHtml({ name, otp })
        : getOtpEmailHtml({ name, otp });

    await sendEmail(email, subject, html);

    return res.json({ success: true, message: "OTP sent successfully", email });
  } catch (error) {
    console.error("sendOtp error:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};



//for verifying OTP
const verifyOtp = async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp || !purpose)
      return res.status(400).json({ message: "Missing fields" });

    const record = await Otp.findOne({ email, purpose });

    if (!record) return res.status(400).json({ message: "OTP request not found" });

    if (record.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    if (purpose === "register") {
      const newUser = await User.create({
        name: record.name,
        email,
        password: record.password,
      });

      await Otp.deleteOne({ email, purpose });
      return sendTokens(newUser, res, 201);
    }

    if (purpose === "reset") {
      return res.json({
        success: true,
        message: "OTP verified. Continue to reset password.",
        email
      });
    }
  } catch (error) {
    console.error("verifyOtp error:", error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};
// for login purpose
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" })
        }
        const user = await User.findOne({ email })
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: "Invalid credentials " })
        }
        return sendTokens(user, res)
    } catch (err) {
        console.error("Login error", err.message);
        res.status(500).json({ message: "Server error" })
    }
}
//for regenerating the refresh token
const refresh = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) {
            return res.status(401).json({ message: "No refresh token" })
        }
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id)
        if (!user) return res.status(401).json({ message: "User not Found" })
        const accessToken = jwt.sign(

            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }

        )
        return res.json({
            success:true,
            accessToken,
            user:{
                id:user._id,
                name:user.name,
                email:user.email,
                role:user.role
            }
        });
    }
    catch(error){
        console.log(error);
        return res.status(401).json({message:"Invalid refresh token"})
    }
}

// for logout 
const logout=(req,res)=>{
    res.clearCookie("refreshToken",{
        httpOnly:true,
              secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",

    })
    .json({success:true,message:"LoggedOut"})
}
//for google auth
const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    // verify token with Google
    const googleRes = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { email, name, sub: googleId } = googleRes.data;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        authProvider: "google",
      });
    }

    return sendTokens(user, res, 200);
  } catch (error) {
    console.error("Google login error:", error.message);
    return res.status(400).json({ message: "Google login failed" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    user.password = newPassword;
    await user.save();

    

    return res.json({
      success: true,
      message: "Password successfully reset",
    });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({ message: "failed to reset password" });
  }
};



module.exports = { loginUser, logout,refresh,sendOtp,verifyOtp,googleLogin,resetPassword}