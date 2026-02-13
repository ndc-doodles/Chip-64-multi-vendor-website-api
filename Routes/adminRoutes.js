const express=require("express")
const {adminLogin,getUsers, blockUser,unblockUser, getAllVendors, blockVendor, unblockVendor, getVendorById,approveVendor,rejectVendor, getAdminWallet, getWalletLedger, getDashboardOverview}=require("../Controllers/adminController")
const {getCategories,createCategory,toggleCategory,updateCategory}=require("../Controllers/categoryController")
const{createProduct,listProducts,updateProduct,toggleProduct}=require("../Controllers/productController")
const {createBrand,approveBrandRequest,getBrandRequests,rejectBrandRequest, getBrands}=require("../Controllers/brandController")
const{ getAllCoupons, createCoupon, toggleCouponStatus, deleteCoupon }=require("../Controllers/couponController")
const upload=require("../Middleware/multer")
const {isAdmin, protect} =require("../Middleware/authMiddleware")
const { getCommissionSlabs, createCommissionSlab, updateCommissionSlab, toggleCommissionSlab } = require("../Controllers/commissionController")
const { getVendorPayouts, settleVendorPayout, getPayoutHistory, getPayoutRequests, approvePayoutRequest } = require("../Controllers/payoutController")
const router=express.Router()

router.post("/login",adminLogin)
router.get("/categories", getCategories);
router.post("/categories", upload.single("image"), createCategory);
router.patch("/categories/:id/toggle", toggleCategory);
router.put("/categories/:id",upload.single("image"), updateCategory)
function multerErrorHandler(err, req, res, next) {
  if (err && err.name === "MulterError") {
    console.log(err)
    return res.status(400).json({ success: false, message: `Multer: ${err.message}`, field: err.field });
  }
  next(err);
}
router.post("/products", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "images", maxCount: 12 },          
  { name: "variantImages", maxCount: 100 }   
])
, createProduct,multerErrorHandler);
router.get("/products",listProducts)
router.put("/products/:id", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "images", maxCount: 12 },          
  { name: "variantImages", maxCount: 100 }  
]),
updateProduct)
router.patch("/products/:id/toggle",toggleProduct)
router.get("/users",getUsers)
router.patch("/users/:id/block",blockUser)
router.patch("/users/:id/unblock",unblockUser)
router.get("/vendors",getAllVendors)
router.patch("/vendors/:id/block",blockVendor)
router.patch("/vendors/:id/unblock",unblockVendor)
router.get("/vendors/:id",getVendorById)
router.patch("/vendors/:id/approve", approveVendor);
router.patch("/vendors/:id/reject", rejectVendor);

router.post("/brands",protect, isAdmin,upload.single("logo"), createBrand);
router.get("/brands",protect,isAdmin,getBrands)
router.get("/brand-requests", protect,isAdmin, getBrandRequests);
router.post("/brand-requests/:id/approve", protect,isAdmin, approveBrandRequest);
router.post("/brand-requests/:id/reject", protect,isAdmin, rejectBrandRequest);
router.get("/coupons",protect,isAdmin,getAllCoupons)
router.post("/coupons",protect,isAdmin,createCoupon)
router.patch("/coupons/:couponId/toggle",protect,isAdmin,toggleCouponStatus)
router.delete("/coupons/:couponId",protect,isAdmin,deleteCoupon)

router.get("/commission",protect,isAdmin,getCommissionSlabs);
router.post("/commission", protect,isAdmin, createCommissionSlab);
router.put("/commission/:id",protect,isAdmin, updateCommissionSlab);
router.patch("/commission/:id/toggle", protect,isAdmin, toggleCommissionSlab);
router.get("/payout",protect,isAdmin,getVendorPayouts)
router.get("/payout/history",protect,isAdmin,getPayoutHistory)

router.post("/payout",protect,isAdmin,settleVendorPayout)
router.get("/wallet",protect,isAdmin,getAdminWallet)
router.get("/wallet/ledger",protect,isAdmin,getWalletLedger)
router.get( "/payout-requests",protect,isAdmin,getPayoutRequests)
router.get("/payout-request",protect,isAdmin ,approvePayoutRequest)

router.get("/dashboard/overview", protect,isAdmin,getDashboardOverview);

module.exports=router
