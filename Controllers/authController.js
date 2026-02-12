const jwt = require("jsonwebtoken")
const User = require("../Models/userModel")
const sendTokens = require("../Utils/sendTokens")
const Otp=require("../Models/otpModel")
const bcrypt = require("bcrypt");
const sendEmail=require("../Config/nodeMailer")
const {getOtpEmailHtml,getResetPasswordEmailHtml}=require("../Utils/emailContentProvider")
const axios=require("axios")
const UAParser = require("ua-parser-js");
const geoip = require("geoip-lite");
const Vendor=require("../Models/vendorModel")
const{generateAccessToken}=require("../Utils/generateTokens")
const{validatePassword}=require("../Utils/vadlidatePassword")
//for sendingOtp to User
const sendOtp = async (req, res) => {
  try {
    const { name, email, password, purpose } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({ message: "Email & purpose are required" });
    }
const passwordError = validatePassword(password);
if (passwordError) {
  return res.status(400).json({ message: passwordError });
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
  if (exists.isDeleted) {
    return res.status(403).json({
      message:
        "This account was deleted. Please contact support to restore access.",
    });
  }

  return res.status(400).json({
    message: "Email already in use",
  });
}      
    }

    // 🔹 RESET PASSWORD FLOW
    if (purpose === "reset") {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
       if (user.isDeleted) {
  return res.status(403).json({
    message:
      "This account was deleted and cannot be recovered. Please contact support.",
  });
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
    console.log(otp)
    await Otp.findOneAndUpdate(
      { email },
      {
        otp,
        purpose,
        name: name || null,
        password: password|| null,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      { upsert: true }
    );

    const subject =
      purpose === "reset"
        ? "Reset your CHIP-64 password"
        : "Your CHIP-64 verification code";

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
       console.log(newUser)
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
      return res.status(400).json({ message: "Email and password are required" });
    }


    // get user with password
    const user = await User.findOne({ email }).select("+password");
    if(!user){
      return res.status(401).json({message:"User not found"})
    }
    if (user.isDeleted) {
  return res.status(403).json({
    message: "Account deleted. Contact support to restore.",
  });
}
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    /* ================= LOGIN ACTIVITY ================= */

    // 1️⃣ Device & browser
    const parser = new UAParser(req.headers["user-agent"]);
    const deviceInfo = parser.getResult();

    const device = `${deviceInfo.browser.name || "Unknown"} on ${
      deviceInfo.os.name || "Unknown"
    }`;

    // 2️⃣ IP
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    // 3️⃣ Location
    const geo = geoip.lookup(ip);
    const location = geo
      ? `${geo.city || "Unknown"}, ${geo.country}`
      : "Unknown";

    // 4️⃣ Save login entry
    user.recentLogins.unshift({
      device,
      location,
      ip,
      loggedAt: new Date(),
    });

    // 5️⃣ Keep only last 5 logins
    user.recentLogins = user.recentLogins.slice(0, 5);
    console.log(user.recentLogins)

    await user.save();

    /* ================= SEND TOKEN ================= */
    return sendTokens(user, res);

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
//for regenerating the refresh token
const refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    let entity = "user";
    let account = await User.findById(decoded.id);

    if (!account) {
      account = await Vendor.findById(decoded.id);
      entity = "vendor";
    }

    if (!account) {
      return res.status(401).json({ message: "Account not found" });
    }

    // ✅ VERY IMPORTANT: tokenVersion check
    if (decoded.tokenVersion !== account.tokenVersion) {
      return res.status(401).json({ message: "Session expired" });
    }

    // ✅ Generate token USING FULL ACCOUNT
    const accessToken = generateAccessToken(account);

    return res.json({
      success: true,
      entity,
      accessToken,
      data: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role || "vendor",
        authProvider: account.authProvider,
        tokenVersion: account.tokenVersion,
      },
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
};

// for logout 
const logout=(req,res)=>{
  console.log("logout triggered")
    res.clearCookie("refreshToken",{
        httpOnly:true,
              secure: process.env.NODE_ENV === "production",
      sameSite: "lax",

    })
    .json({success:true,message:"LoggedOut"})
}
//for google auth


const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    // 🔐 Verify token with Google
    const googleRes = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { email, name, sub: googleId } = googleRes.data;

   let user = await User.findOne({ email });

// FIRST create if not exists
if (!user) {
  user = await User.create({
    name,
    email,
    googleId,
    authProvider: "google",
  });
}

// THEN check isDeleted
if (user.isDeleted) {
  return res.status(403).json({
    message: "Account deleted. Contact support to restore.",
  });
}


    /* ================= LOGIN ACTIVITY ================= */

    const parser = new UAParser(req.headers["user-agent"]);
    const deviceInfo = parser.getResult();

    const device = `${deviceInfo.browser.name || "Unknown"} on ${
      deviceInfo.os.name || "Unknown"
    }`;

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    const geo = geoip.lookup(ip);

    const location = geo
      ? `${geo.city || "Unknown"}, ${geo.country}`
      : "Unknown location";

    user.recentLogins = user.recentLogins || [];

    user.recentLogins.unshift({
      device,
      location,
      ip,
      loggedAt: new Date(),
    });

    // keep only last 5 logins
    user.recentLogins = user.recentLogins.slice(0, 5);

    await user.save();

    /* ================= SEND TOKENS ================= */
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


const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.authProvider === "google") {
      return res.status(400).json({
        message: "Password change not available for Google accounts",
      });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    // ✅ no hashing here
    user.password = newPassword;
    await user.save();

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
const logoutAllDevices=async (req,res)=>{
   try {
    console.log(req.user)
    const user = await User.findById(req.user.id);
    console.log(user)

    // 🔥 Invalidate all tokens
    user.tokenVersion += 1;
    user.recentLogins = []; // optional
    await user.save();

    res.json({ message: "Signed out from all devices" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}
module.exports = { loginUser, logout,refresh,sendOtp,verifyOtp,googleLogin,resetPassword,logoutAllDevices,changePassword}