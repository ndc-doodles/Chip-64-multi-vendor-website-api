const mongoose = require("mongoose");
const { Schema } = mongoose;


const variantSchema = new Schema(
  {
    sku: { type: String }, // optional but recommended

    price: {
      type: Number, // if null → use basePrice
      default: null,
    },

    stock: {
      type: Number,
      default: 0,
    },
   

    images: [{ type: String }],

    // 🔑 FLEXIBLE VARIANT ATTRIBUTES
    // ex: { color: "Black", size: "M" }
    // ex: { ram: "8GB", storage: "128GB" }
    attributes: {
      type: Map,
      of: String,
    },
  },
  { _id: true }
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

    slug: { type: String, required: true, unique: true, lowercase: true },

    description: { type: String, required: true },
brand: {
  type: Schema.Types.ObjectId,
  ref: "Brand",
  required: true,
}
,

averageRating: {
  type: Number,
  default: 0,
  min: 0,
  max: 5,
  set: v => Math.round(v * 10) / 10, // 4.3
},

reviewCount: {
  type: Number,
  default: 0,
},




    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    // 📦 CATEGORY (tech, toys, fashion, leather, etc.)
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    // 💰 BASE PRICE (used when no variant price)
    basePrice: { type: Number, required: true },

    mainImage: { type: String, required: true },


  
    variants: [variantSchema],

    isActive: { type: Boolean, default: true },

    soldCount: { type: Number, default: 0 },

    tags: [{ type: String }],
  },
  { timestamps: true }
);
productSchema.index({
  name: "text",
  description: "text",
  tags: "text",
})
module.exports = mongoose.model("Product", productSchema);
