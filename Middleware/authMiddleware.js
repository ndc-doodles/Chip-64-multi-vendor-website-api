const jwt= require("jsonwebtoken")
const User=require("../Models/userModel")
const Vendor=require("../Models/vendorModel")

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    // 🔐 Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // 🔥 Fetch user from DB
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // ✅ TOKEN VERSION CHECK (MOST IMPORTANT PART)
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: "Session expired" });
    }

    // Attach user
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      tokenVersion : user.tokenVersion
    };

    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

const optionalProtect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 👉 No token → guest → continue
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) return next();

    if (decoded.tokenVersion !== user.tokenVersion) return next();

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    next();
  } catch (err) {
    next(); // never block
  }
};

const isAdmin=(req,res,next)=>{
    if(req.user && req.user.role ==="admin"){
        return next();
    }
    return res.status(403).json({message:"Admin only"})
}
const protectVendor= async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const vendor = await Vendor.findById(decoded.id);
    if (!vendor) return res.status(401).json({ message: "Vendor not found" });

    req.vendor = { id: vendor._id }; // ✅ IMPORTANT
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}; 
module.exports={protect,isAdmin,protectVendor,optionalProtect}