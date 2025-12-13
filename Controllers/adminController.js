const bcrypt = require("bcrypt");
const User = require("../Models/userModel");
const sendTokens = require("../Utils/sendTokens");

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("ADMIN LOGIN BODY:", { email, password });

    const user = await User.findOne({ email }).select("+password");
    console.log("FOUND USER:", user ? { email: user.email, role: user.role } : null);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied - not admin" });
    }

    const isMatch = await user.matchPassword(password);
    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return sendTokens(user, res);
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


module.exports = { adminLogin };
