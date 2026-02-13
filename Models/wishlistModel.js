const mongoose = require("mongoose");
const { Schema } = mongoose;

const wishlistItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    // snapshot
    name: { type: String, required: true },
    slug: { type: String },
    image: { type: String, default: "" },

    attributes: {
      type: Map,
      of: String,
      default: {},
    },
     price: {
      type: Number,   // 🔥 ADD THIS
      required: true,
    },


    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const wishlistSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    items: {
      type: [wishlistItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);
wishlistSchema.statics.findOrCreateFor = async function ({ userId }) {
  if (!userId) throw new Error("userId required");

  let wishlist = await this.findOne({ user: userId });
  if (!wishlist) wishlist = await this.create({ user: userId });

  return wishlist;
};
module.exports = mongoose.model("Wishlist", wishlistSchema);
