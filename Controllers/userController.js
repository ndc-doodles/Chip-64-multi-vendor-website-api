const User=require("../Models/userModel")
const axios = require("axios");

const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔐 Google users cannot use password delete
    if (user.authProvider === "google") {
      return res.status(400).json({
        message: "Please re-login with Google to delete your account",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // 🔥 Soft delete
    user.isDeleted = true;
    user.deletedAt = new Date();

    // 🔥 Invalidate all sessions
    user.tokenVersion += 1;

    await user.save();

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


const deleteGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("working")
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Google token required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
     
    if (user.authProvider !== "google") {
      return res.status(400).json({
        message: "This account is not a Google account",
      });
    }

    // 🔐 Verify Google token
    const googleRes = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (googleRes.data.email !== user.email) {
      return res.status(401).json({ message: "Google verification failed" });
    }

    // 🔥 Soft delete
    user.isDeleted = true;
    user.deletedAt = new Date();

    // 🔥 Invalidate all sessions
    user.tokenVersion += 1;

    await user.save();

    return res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Google delete error:", err.message);
    return res.status(500).json({ message: "Delete failed" });
  }
};


module.exports={deleteAccount,deleteGoogleAccount}