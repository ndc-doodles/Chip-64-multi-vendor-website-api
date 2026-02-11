const express=require("express")
const router=express.Router()
const {vendorLogin,listVendorCategories,createCategoryVendor,updateCategoryVendor,toggleVendorCategory,createVendorProduct,listVendorProducts,updateVendorProduct,toggleVendorProductStatus,registerVendor, getVendorDashboard, getVendorOrderById, getVendorProfile, updateVendorProfile, updateVendorBank, changeVendorPassword}=require("../Controllers/vendorController")
const {protectVendor}=require("../Middleware/authMiddleware")
const upload=require("../Middleware/multer")
const { getBrandsVendor, vendorRequestBrand } = require("../Controllers/brandController")
const { getVendorOrders, updateVendorItemStatus } = require("../Controllers/orderController")
const { getVendorWallet, getVendorWalletLedger, requestPayout } = require("../Controllers/payoutController")

router.post("/login",vendorLogin)
router.get("/categories",protectVendor,listVendorCategories)
router.post("/categories",protectVendor,upload.single("image"),createCategoryVendor)
router.put("/categories/:id",protectVendor,upload.single("image"),updateCategoryVendor)
router.patch("/categories/:id/toggle",protectVendor,toggleVendorCategory)
router.post("/products",protectVendor, upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "images", maxCount: 12 },          
  { name: "variantImages", maxCount: 100 }   
])
, createVendorProduct)
router.get("/products",protectVendor,listVendorProducts)
router.put("/products/:id",upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "images", maxCount: 12 },          
  { name: "variantImages", maxCount: 100 }   
])
,updateVendorProduct)
router.patch(
  "/products/:id/toggle",
  protectVendor,
  toggleVendorProductStatus
);
router.post(
  "/register",
  upload.fields([
    { name: "panCard", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
    { name: "bankProof", maxCount: 1 },
    { name: "gstCertificate", maxCount: 1 },
  ]),
  registerVendor
);
router.get("/brands",protectVendor,getBrandsVendor)
router.post(
  "/brand-requests",protectVendor,
  upload.single("logo"),
  vendorRequestBrand
);
router.get("/orders",protectVendor,getVendorOrders)
router.put(
  "/orders/:orderId/items/:itemId/status",
  protectVendor,
  updateVendorItemStatus
)
router.get("/dashboard",protectVendor,getVendorDashboard)
router.get("/orders/:orderId",protectVendor,getVendorOrderById)
router.get("/profile",protectVendor,getVendorProfile)
router.put("/profile",protectVendor,updateVendorProfile)
router.put("/profile/bank",protectVendor,updateVendorBank)
router.put("/change-password",protectVendor,changeVendorPassword)
router.get("/wallet", protectVendor,  getVendorWallet);
router.get("/wallet-ledger", protectVendor, getVendorWalletLedger);
router.post("/payout/request", protectVendor, requestPayout);

module.exports=router