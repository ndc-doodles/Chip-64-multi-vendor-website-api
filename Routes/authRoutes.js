const express=require("express")
const { loginUser,refresh,logout,sendOtp,verifyOtp,googleLogin,resetPassword
}=require("../Controllers/authController")
const {protect,isAdmin}=require("../Middleware/authMiddleware")
const router=express.Router()

router.post("/send-otp",sendOtp)
router.post("/verify-otp",verifyOtp)
router.post("/login",loginUser)
router.post("/refresh",refresh)
router.post("/logout",logout)
router.post("/google",googleLogin)
router.post("/reset-password",resetPassword)



module.exports=router;