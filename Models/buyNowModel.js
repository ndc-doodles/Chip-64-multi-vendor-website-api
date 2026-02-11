const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ---------- BUY NOW ITEM ---------- */
const buyNowItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    // 🔒 SNAPSHOT (important)
    name: { type: String, required: true },
    slug: { type: String },

    sku: { type: String, default: "" },
    image: { type: String, default: "" },

    qty: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    price: {
      type: Number,
      required: true,
    },

    attributes: {
      type: Map,
      of: String,
      default: {},
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

/* ---------- BUY NOW SESSION ---------- */
const buyNowSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
      unique: true, // 🔑 one Buy Now per user
    },

    items: {
      type: [buyNowItemSchema],
      required: true,
      validate: [
        (v) => v.length === 1,
        "Buy Now can contain only one item",
      ],
    },

    source: {
      type: String,
      enum: ["BUY_NOW"],
      default: "BUY_NOW",
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000), // ⏱ 30 mins
      index: { expires: 0 }, // 🔥 TTL auto-delete
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BuyNowSession", buyNowSchema);
