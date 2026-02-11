const BuyNow = require("../Models/buyNowModel");
const Product = require("../Models/productModel");

const buyNow = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantId, qty = 1, attributes = {} } = req.body;

    if (!productId || !variantId) {
      return res.status(400).json({ message: "Missing product data" });
    }

    // 1️⃣ Fetch product + variants
    const product = await Product.findById(productId)
      .select("_id name mainImage basePrice vendorId variants");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 2️⃣ Fetch variant
    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ message: "Variant not found" });
    }

    const image = variant.images?.[0] || product.mainImage;
    const price = variant.price ?? product.basePrice;

    // 3️⃣ Remove old Buy Now
    await BuyNow.deleteOne({ user: userId });

    // 4️⃣ Create Buy Now session
    const buyNowDoc = await BuyNow.create({
      user: userId,
      items: [
        {
          productId: product._id,
          vendorId: product.vendorId,
          variantId,

          name: product.name,
          image,          // ✅ variant first image
          price,          // ✅ variant price if exists
          qty,
          attributes,
        },
      ],
    });

    res.json({
      success: true,
      message: "Buy Now initiated",
      buyNowId: buyNowDoc._id,
    });
  } catch (err) {
    console.error("Buy Now error:", err);
    res.status(500).json({ message: "Buy now failed" });
  }
};

module.exports = { buyNow };
