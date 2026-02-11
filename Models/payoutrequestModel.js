const mongoose = require("mongoose");
const { Schema } = mongoose;

const payoutRequestSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "PAID"],
      default: "PENDING",
    },

    note: {
      type: String,
      default: null,
    },

    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PayoutRequest", payoutRequestSchema);
