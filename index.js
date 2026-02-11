require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./Config/db");
const authRoutes = require("./Routes/authRoutes");
const adminRoutes=require("./Routes/adminRoutes")
const userRoutes=require("./Routes/userRoutes")
const vendorRoutes=require("./Routes/vendorRoutes")
const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CLIENT_URL, 
    credentials: true,
  })
);

app.use("/auth", authRoutes);
app.use("/user",userRoutes)
app.use("/vendor",vendorRoutes)
app.use("/admin",adminRoutes)


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
