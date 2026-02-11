const express=require("express")
const router=express.Router()
const {listProducts,getProduct,getShopProducts,getRelatedProducts, searchProducts, getRecentlyViewed}=require("../Controllers/productController")
const{getCategoriesUser,getShopCategories}=require("../Controllers/categoryController")
const {getCart,addItem,updateItemQty,removeItem,clearCart, getCartRecommendations}=require("../Controllers/cartController")
const {createAddress,getMyAddresses,updateAddress,deleteAddress,setDefaultAddress}=require("../Controllers/addressController")
const {protect,isAdmin, optionalProtect}=require("../Middleware/authMiddleware")
const {getProductsByCollection}=require("../Controllers/collectionController")
const {getWishlist,toggleWishlist}=require("../Controllers/wishlistController")
const { deleteAccount,deleteGoogleAccount } = require("../Controllers/userController")
const { validateCoupon ,getAvailableCoupons} = require("../Controllers/couponController")
const{placeOrder,verifyRazorpay, getOrderById, getUserOrders, updateVendorItemStatus, getCheckoutItems}=require("../Controllers/orderController")
const { createReview, updateReview, deleteReview, getProductReviews } = require("../Controllers/reviewController")
const { buyNow } = require("../Controllers/buyNowController")

router.get("/products",listProducts)
router.get("/products/:slug",optionalProtect,getProduct)
router.get("/categories",getCategoriesUser)
router.get("/products-shop",getShopProducts)

router.get("/cart",protect,getCart)
router.post("/cart/items",protect,addItem)
router.patch("/cart/items/:itemId",protect,updateItemQty)
router.delete("/cart/items/:itemId",protect,removeItem)
router.delete("/cart",clearCart)

router.get("/shop-categories",getShopCategories)

router.post("/addresses", protect, createAddress);
router.get("/addresses", protect, getMyAddresses);
router.put("/addresses/:id", protect, updateAddress);
router.delete("/addresses/:id", protect, deleteAddress);
router.patch("/addresses/:id/default", protect, setDefaultAddress);

router.get("/collections/:slug", getProductsByCollection);
router.get("/products/related/:slug", getRelatedProducts);


router.get("/wishlist", protect, getWishlist);

router.post("/wishlist/toggle", protect, toggleWishlist);
router.delete("/delete-account",protect,deleteAccount)
router.post("/delete-account/google", protect, deleteGoogleAccount);

router.post("/cart-recommendations",protect,getCartRecommendations)
router.post("/coupons/validate",protect,validateCoupon)
router.get("/coupons/available", protect, getAvailableCoupons);
router.post("/orders", protect, placeOrder);
router.post("/orders/verify-payment", protect, verifyRazorpay);
router.get("/orders/:id", protect, getOrderById);
router.get("/orders",protect,getUserOrders)


router.post("/review", protect,createReview);
router.put("/review/:id", protect, updateReview);
router.delete("/review/:id", protect, deleteReview);
router.get("/product/:id/reviews", getProductReviews);
router.post("/buy-now", protect, buyNow);

router.get("/checkout",protect,getCheckoutItems)
router.get("/search-products",protect,searchProducts)
router.get("/recently-viewed",protect,getRecentlyViewed)
module.exports=router