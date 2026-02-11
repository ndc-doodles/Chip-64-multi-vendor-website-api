const mongoose=require("mongoose")

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },

    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FLAT"],
      required: true
    },

    discountValue: {
      type: Number,
      required: true
    },

    maxDiscountAmount: {
      type: Number // only for percentage
    },

    minOrderValue: {
      type: Number,
      default: 0
    },

    expiryDate: {
      type: Date,
      required: true
    },

    usageLimit: {
      type: Number
    },

    usedCount: {
      type: Number,
      default: 0
    },

    usedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        usedAt: Date
      }
    ],

    isActive: {
      type: Boolean,
      default: true
    },

    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);
const Coupon=mongoose.model("Coupon",couponSchema)
module.exports=Coupon
