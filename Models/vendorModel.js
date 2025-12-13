const mongoose = require("mongoose");
const { Schema } = mongoose;

const vendorBankSchema = new Schema(
  {
    accountHolderName: String,
    accountNumber: String,
    ifsc: String,
    upiId: String
  },
  { _id: false }
);

const vendorSchema = new Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },

    phone: String,

    // 🔐 AUTH
    password: {
      type: String,
      required: true
    },

    // 🔑 COMMISSION
    commissionPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    // 💰 WALLET
    walletBalance: {
      type: Number,
      default: 0
    },

    bankDetails: vendorBankSchema,

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
