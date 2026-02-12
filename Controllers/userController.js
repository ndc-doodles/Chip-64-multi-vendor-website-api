const User=require("../Models/userModel")
const axios = require("axios");
const Order=require("../Models/orderModel")
const Address=require("../Models/addressModel")
const Contact=require("../Models/contactModel.js")
const sendEmail = require("../Config/nodeMailer.js"); // you already have this

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

 const getAccountStats = async (req, res) => {
  try {
    const userId = req.user.id;



    const [ordersCount, addressCount] = await Promise.all([
      Order.countDocuments({ user:userId }),
      Address.countDocuments({ user:userId }),
    ]);

    res.status(200).json({
      ordersCount,
      addressCount,
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};

const sendContactMessage = async (req, res) => {
  try {
    const { name, email, orderId, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        message: "Name, email & message are required",
      });
    }

    const ticket = await Contact.create({
      user: req.user?.id || null, 
      name,
      email,
      orderId: orderId || "",
      message,
    });

    const userHtml = `
      <h2>Hi ${name},</h2>
      <p>Thanks for contacting <b>CHIP-64 Support</b>.</p>
      <p>We received your message and will reply within 24 hours.</p>
      <br/>
      <b>Your message:</b>
      <p>${message}</p>
      <br/>
      <small>Ticket ID: ${ticket._id}</small>
    `;

    await sendEmail(
      email,
      "We received your message ✅ | CHIP-64 Support",
      userHtml
    );

    const adminHtml = `
      <h3>🚨 New Support Message</h3>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Order ID:</b> ${orderId || "N/A"}</p>
      <p><b>Message:</b></p>
      <p>${message}</p>
      <br/>
      <b>Ticket ID:</b> ${ticket._id}
    `;

    await sendEmail(
      process.env.EMAIL_USER, 
      "New Support Ticket 🚨",
      adminHtml
    );

    return res.json({
      success: true,
      message: "Message sent successfully",
    });

  } catch (error) {
    console.error("sendContactMessage error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};


module.exports={deleteAccount,deleteGoogleAccount,getAccountStats,sendContactMessage}