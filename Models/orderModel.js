const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },

    variantId: { type: Schema.Types.ObjectId },

    name: String,
    slug: String,
    image: String,

    price: { type: Number, required: true },
    qty: { type: Number, required: true },

    color: String,
    size: String,
    options: [{ name: String, value: String }],

    // 💰 COMMISSION SPLIT (IMPORTANT)
    adminCommission: { type: Number, required: true }, // platform share
    vendorAmount: { type: Number, required: true }     // vendor net earning
  },
  { _id: false }
);

// address snapshot inside order
const orderAddressSchema = new Schema(
  {
    fullName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    addressId: { type: Schema.Types.ObjectId, ref: "Address" },
    shippingAddress: orderAddressSchema,

    items: [orderItemSchema],

    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },

    currency: { type: String, default: "INR" },

    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
    },

    paymentMethod: { type: String, default: "cod" },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
