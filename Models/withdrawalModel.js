const mongoose = require("mongoose");
const { Schema } = mongoose;

const withdrawalSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true
    },

    // 💰 AMOUNT REQUESTED BY VENDOR
    amount: {
      type: Number,
      required: true,
      min: 1
    },

    // 🔁 WORKFLOW STATUS
    status: {
      type: String,
      enum: ["pending", "paid", "rejected"],
      default: "pending",
      index: true
    },

    // timestamps
    requestedAt: {
      type: Date,
      default: Date.now
    },

    paidAt: Date,

    remark: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
