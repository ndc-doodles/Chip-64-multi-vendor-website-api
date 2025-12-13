const express=require("express")
const {adminLogin}=require("../Controllers/adminController")
const {getCategories,createCategory,toggleCategory,updateCategory}=require("../Controllers/categoryController")
const{createProduct,listProducts,updateProduct,toggleProduct}=require("../Controllers/productController")
const upload=require("../Middleware/multer")
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
  { name: "images", maxCount: 12 },          // gallery
  { name: "variantImages", maxCount: 100 }   // variant image uploads
])
, createProduct,multerErrorHandler);
router.get("/products",listProducts)
router.put("/products/:id", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "images", maxCount: 12 },          // gallery
  { name: "variantImages", maxCount: 100 }   // variant image uploads
]),
updateProduct)
router.patch("/products/:id/toggle",toggleProduct)

module.exports=router
