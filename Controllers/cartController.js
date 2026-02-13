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

    const {
      productId,
      vendorId,
      qty = 1,
      name,
      slug,
      image,
      attributes,
      variantId
    } = req.body;

    if (!productId || !vendorId || !variantId) {
      return res.status(400).json({
        message: "productId, vendorId and variantId are required",
      });
    }

    const product = await Product.findById(productId);
    const variant = product.variants.id(variantId);

    const finalPrice = variant.price ?? product.basePrice;

    const cart = await Cart.findOrCreateFor({ userId });

    await cart.addItem({
      productId,
      vendorId,
      qty,
      price: finalPrice,
      name,
      slug,
      image,
      attributes,
      variantId,
    });

    res.json({ success: true, cart });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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