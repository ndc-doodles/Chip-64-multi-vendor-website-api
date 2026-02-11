
const mongoose=require("mongoose")
const {Schema}=mongoose


const payoutSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    orders: [
      {
        type: Schema.Types.ObjectId,
        ref: "Order",
        required: true,
      },
    ],

    amount: {
      type: Number,
      required: true,
    },

    method: {
      type: String,
      enum: ["BANK", "UPI", "MANUAL"],
      required: true,
    },

    referenceId: {
      type: String,
    },

    note: {
      type: String,
    },

    status: {
      type: String,
      enum: ["INITIATED", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },

    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payout", payoutSchema);
