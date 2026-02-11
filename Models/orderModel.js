const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    items: [
      {
        name: String,
        image: String,
        price: Number,
        qty: Number,
        attributes: Object,
        walletCredited:{
          type:Boolean,
          default:false
        },
       commissionPerItem: {
  type: Number,
  required: true,
},
totalCommission: {
  type: Number,
  required: true,
},
vendorEarning: {
  type: Number,
  required: true,
},
isSettled: {
  type: Boolean,
  default: false,
},
        productId: {
  type: Schema.Types.ObjectId,
  ref: "Product",
  required: true,

}
,
         status: {
      type: String,
      enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"],
      default: "PLACED",
    },
    
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
      },
    ],

    address: {
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },

    subtotal: Number,
    discount: { type: Number, default: 0 },
    totalAmount: Number,

    coupon: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "RAZORPAY"],
      required: true,
    },
    orderNumber: {
  type: String,
  unique: true,
  required: true
},
   orderStatus: {
  type: String,
  enum: ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED","PLACED"],
  default: "CONFIRMED",
},

paymentStatus: {
  type: String,
  enum: ["INITIATED", "PENDING", "PAID", "FAILED",],
  default: "PENDING",
},

    razorpay: {
      orderId: String,
      paymentId: String,
      signature: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
