const Cart=require("../Models/cartModel")
const mongoose=require("mongoose")

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
    console.log(req.user)
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { productId, variantId, qty = 1, price, name, slug, image, size, color, options } = req.body;


    if (!productId || price == null)
      return res.status(400).json({ success: false, message: "productId + price required" });

    const cart = await Cart.findOrCreateFor({ userId });

    await cart.addItem({ productId, variantId, qty, price, name, slug, image ,size,color});

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
 module.exports={getCart,clearCart,removeItem,addItem,updateItemQty}