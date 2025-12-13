// models/product.model.js
const mongoose=require("mongoose")

const variantSchema = new mongoose.Schema({
  color: {
    type: String,
    required: true,
  },
  size: {
    type: String, // eg: XS, S, M, L, XL, "One Size"
    required: true,
  },
  stock: {
    type: Number,
    default: 0,
  },
  price: {
    type: Number, // if null → use main price
    default: null,
  },
  image: {
    type: [{ type: String }],
  },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    slug: { type: String, required: true, unique: true, lowercase: true },

    description: { type: String, required: true },

    basePrice: { type: Number, required: true }, // replaces price

   
    gender: {
      type: String,
      required: true,
      enum: ["Men", "Women", "Unisex"],
    },


    badges: [{ type: String, enum: ["New", "Bestseller", "Limited"] }],

    mainImage: {
      type: String,
      required: true,
    },

    images: [{ type: String }],
      category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },

    variants: [variantSchema], // <-- NEW FEATURE

    isActive: { type: Boolean, default: true },

    soldCount: { type: Number, default: 0 },

    tags: [{ type: String }],

  },
  { timestamps: true }
);

const Product=mongoose.model("Product",productSchema)

module.exports =Product