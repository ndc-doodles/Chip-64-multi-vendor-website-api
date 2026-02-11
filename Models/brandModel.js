const mongoose = require("mongoose");
const { Schema } = mongoose;

const brandSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true, // Apple, Samsung, Nike
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    logo: {
      type: String, // cloudinary url
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    // 🔐 Admin controlled
    isApproved: {
      type: Boolean,
      default: true, // admin-created brands auto approved
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // 📊 optional future use
    productCount: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: false, // admin created
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Brand", brandSchema);
