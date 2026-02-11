const Wishlist = require("../Models/wishlistModel");
const mongoose=require("mongoose")
const Product=require("../Models/productModel")

/* GET wishlist */
const getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) wishlist = await Wishlist.create({ user: userId });

    res.json({ success: true, wishlist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const toggleWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantId } = req.body;

    if (!productId || !variantId) {
      return res.status(400).json({
        success: false,
        message: "productId and variantId required",
      });
    }

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    const variant = product.variants.id(variantId);
    if (!variant)
      return res.status(404).json({ success: false, message: "Variant not found" });

    const wishlist = await Wishlist.findOrCreateFor({ userId });

    const existingIndex = wishlist.items.findIndex(
      (i) =>
        String(i.productId) === String(productId) &&
        String(i.variantId) === String(variantId)
    );

    if (existingIndex >= 0) {
      // ❌ REMOVE
      wishlist.items.splice(existingIndex, 1);
    } else {
      // ✅ ADD FULL SNAPSHOT
      wishlist.items.push({
        productId,
        variantId,
        vendorId: product.vendorId,
        name: product.name,
        slug: product.slug,
        image: variant.images?.[0] || product.mainImage,
        price: variant.price ?? product.basePrice,
        attributes: variant.attributes || {},
      });
    }

    await wishlist.save();

    res.json({ success: true, wishlist });
  } catch (err) {
    console.error("toggleWishlist error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports={getWishlist,toggleWishlist}