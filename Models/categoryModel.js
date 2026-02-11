const mongoose = require("mongoose");
const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      lowercase: true
    },
    description: {
      type: String,
      default: ""
    },

    image: {
      type: String,
      default: ""
    },

    // 🔑 PARENT CATEGORY (for subcategories)
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null // null = top-level category
    },

  

    isActive: {
      type: Boolean,
      default: true
    },
    priorityOrder:{
      type:Number,
      default: 0
    }
  },
  { timestamps: true }
);

// 🔒 unique category per vendor under same parent
categorySchema.index(
  { name: 1, vendorId: 1, parentCategory: 1 },
  { unique: true }
);

module.exports = mongoose.model("Category", categorySchema);