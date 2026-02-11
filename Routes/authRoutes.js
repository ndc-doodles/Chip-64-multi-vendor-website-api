const express=require("express")
const { loginUser,refresh,logout,sendOtp,verifyOtp,googleLogin,resetPassword, logoutAllDevices
}=require("../Controllers/authController")
const {changePassword}=require("../Controllers/authController")
const {protect,isAdmin}=require("../Middleware/authMiddleware")
const router=express.Router()

router.post("/send-otp",sendOtp)
router.post("/verify-otp",verifyOtp)
router.post("/login",loginUser)
router.post("/refresh",refresh)
router.post("/logout",logout)
router.post("/google",googleLogin)
router.post("/reset-password",resetPassword)
router.post("/logout-all",protect,logoutAllDevices)
router.post("/change-password",protect,changePassword)


module.exports=router;