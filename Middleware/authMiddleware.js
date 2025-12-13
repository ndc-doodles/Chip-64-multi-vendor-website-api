const jwt= require("jsonwebtoken")
const User=require("../Models/userModel")

const protect=async(req,res,next)=>{
    let token

    if(req.headers.authorization && req.headers.authorization.startsWith("Bearer ")){
        token =req.headers.authorization.split(" ")[1];
    }
    if(!token){
        return res.status(401).json({ message: "Not authorized, no token" });
    }
    try{
        const decoded=jwt.verify(token,process.env.JWT_ACCESS_SECRET);
        req.user={
            id:decoded.id,
            email:decoded.email,
            role:decoded.role
        }
        console.log(req.user)
        next()
    }catch(error){
        console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Not authorized, token failed" });
    }
}

const isAdmin=(req,res,next)=>{
    if(req.user && req.user.role ==="admin"){
        return next();
    }
    return res.status(403).json({message:"Admin only"})
}

module.exports={protect,isAdmin}