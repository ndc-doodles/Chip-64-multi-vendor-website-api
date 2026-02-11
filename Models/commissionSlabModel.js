const mongoose = require("mongoose");

const commissionSlabSchema = new mongoose.Schema(
  {
    minPrice: Number,
    maxPrice: Number,
    flatCommission: Number,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommissionSlab", commissionSlabSchema);