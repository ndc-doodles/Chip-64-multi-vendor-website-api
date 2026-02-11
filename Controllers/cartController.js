const Cart=require("../Models/cartModel")
const mongoose=require("mongoose")
const Product=require("../Models/productModel")
const BuyNow=require("../Models/buyNowModel")
const getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const cart = await Cart.findOrCreateFor({ userId });
    return res.json({ success: true, cart });
  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
     console.log(req.body)
    const {
      productId,
      vendorId,
      qty = 1,
      price,
      name,
      slug,
      image,
      attributes,
      variantId // 🔑 THIS IS THE VARIANT
    } = req.body;
     console.log(variantId)
    if (!productId || !vendorId || price == null|| !variantId) {
      return res.status(400).json({
        success: false,
        message: "productId, vendorId , variantId and price are required",
      });
    }
        await BuyNow.deleteOne({ user: userId });


    const cart = await Cart.findOrCreateFor({ userId });

    await cart.addItem({
      productId,
      vendorId,
      qty,
      price,
      name,
      slug,
      image,
      attributes,
      variantId 
    });

    return res.json({ success: true, cart });
  } catch (err) {
    console.error("addItem error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


const updateItemQty = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { itemId } = req.params;
    const { qty } = req.body;

    const cart = await Cart.findOrCreateFor({ userId });
    await cart.updateItemQty(itemId, qty);

    return res.json({ success: true, cart });
  } catch (err) {
    console.error("updateItemQty error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const removeItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { itemId } = req.params;

    const cart = await Cart.findOrCreateFor({ userId });
    await cart.removeItem(itemId);

    return res.json({ success: true, cart });
  } catch (err) {
    console.error("removeItem error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
const clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const cart = await Cart.findOrCreateFor({ userId });
    await cart.clearCart();

    return res.json({ success: true, cart });
  } catch (err) {
    console.error("clearCart error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
const getCartRecommendations = async (req, res) => {
  const { cartProductIds } = req.body;

  const cartProducts = await Product.find({
    _id: { $in: cartProductIds }
  }).select("category");

  const categories = [
    ...new Set(cartProducts.map(p => p.category.toString()))
  ];

  const recommendations = await Product.find({
    category: { $in: categories },
    _id: { $nin: cartProductIds },
    isActive: true
  })
    .limit(3)
    .select("name basePrice mainImage category slug");
   console.log(recommendations)
  res.json(recommendations);
};
 module.exports={getCart,clearCart,removeItem,addItem,updateItemQty,getCartRecommendations}