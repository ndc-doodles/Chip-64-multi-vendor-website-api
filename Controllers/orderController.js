const Order = require("../Models/orderModel")
const Cart = require("../Models/cartModel")
const Address = require("../Models/addressModel")
const Coupon = require("../Models/couponModel");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Product=require("../Models/productModel")
const {getCommissionForPrice}=require("../Utils/commisionUtils")
const Vendor=require("../Models/vendorModel")
const mongoose = require("mongoose");
const BuyNow=require("../Models/buyNowModel")
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { addressId, paymentMethod, couponId } = req.body;

    /* ---------------- ADDRESS ---------------- */
    const address = await Address.findOne(
      { _id: addressId, user: userId },
      null,
      { session }
    );
    if (!address) {
      throw new Error("Invalid address");
    }

    /* ---------------- SOURCE ITEMS ---------------- */
    const buyNow = await BuyNow.findOne({ user: userId });
    const cart = await Cart.findOne({ user: userId });

    let sourceItems = [];
    let sourceType = "CART";

    if (buyNow && buyNow.items.length === 1) {
      sourceItems = buyNow.items;
      sourceType = "BUY_NOW";
    } else if (cart && cart.items.length > 0) {
      sourceItems = cart.items;
    } else {
      throw new Error("No items to place order");
    }

    /* ---------------- PRODUCT VALIDATION ---------------- */
    const productIds = sourceItems.map(i => i.productId);

    const products = await Product.find({
      _id: { $in: productIds },
    }).select("_id name mainImage vendorId basePrice stock");

    let subtotal = 0;
    const orderItems = [];

    for (const item of sourceItems) {
      const product = products.find(
        p => p._id.toString() === item.productId.toString()
      );

      if (!product) {
        throw new Error("Product not found");
      }

      if (item.qty > product.stock) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const price = item.price;
      const qty = item.qty;

      const commissionPerItem = await getCommissionForPrice(price);
      const totalCommission = commissionPerItem * qty;
      const vendorEarning = (price * qty) - totalCommission;

      subtotal += price * qty;

      orderItems.push({
        productId: product._id,
        vendorId: product.vendorId,
        name: product.name,
        image: product.mainImage,
        price,
        qty,
        attributes: item.attributes,

        commissionPerItem,
        totalCommission,
        vendorEarning,

        status: "PLACED",
      });
    }

    /* ---------------- COUPON ---------------- */
    let discount = 0;
    let couponDoc = null;

    if (couponId) {
      couponDoc = await Coupon.findById(couponId);

      if (!couponDoc || !couponDoc.isActive) {
        throw new Error("Invalid coupon");
      }

      if (couponDoc.expiryDate < new Date()) {
        throw new Error("Coupon expired");
      }

      if (couponDoc.usedBy.some(u => u.userId.toString() === userId)) {
        throw new Error("Coupon already used");
      }

      if (subtotal < couponDoc.minOrderAmount) {
        throw new Error("Minimum order value not met");
      }

      discount =
        couponDoc.discountType === "PERCENTAGE"
          ? Math.min(
              (subtotal * couponDoc.discountValue) / 100,
              couponDoc.maxDiscountAmount || Infinity
            )
          : couponDoc.discountValue;

      discount = Math.min(discount, subtotal);
    }

    const totalAmount = subtotal - discount;

    /* ---------------- ORDER ---------------- */
    const orderNumber = `ORD-${Date.now()}`;

    const order = await Order.create(
      [
        {
          user: userId,
          orderNumber,
          items: orderItems,
          address,
          subtotal,
          discount,
          totalAmount,
          coupon: couponId || null,
          paymentMethod,
          paymentStatus:
            paymentMethod === "COD" ? "PENDING" : "INITIATED",
          orderStatus: "CONFIRMED",
          razorpay: {},
          sourceType,
        },
      ],
      { session }
    );

    /* ---------------- COUPON UPDATE ---------------- */
    if (couponDoc) {
      couponDoc.usedCount += 1;
      couponDoc.usedBy.push({ userId });
      await couponDoc.save({ session });
    }

    /* ---------------- CLEANUP SOURCE ---------------- */
    if (sourceType === "BUY_NOW") {
      await BuyNow.deleteOne({ user: userId }, { session });
    } else {
      await Cart.deleteOne({ user: userId }, { session });
    }

    /* ---------------- COD ---------------- */
    if (paymentMethod === "COD") {
      await session.commitTransaction();
      return res.json({
        success: true,
        orderId: order[0]._id,
        orderNumber,
        paymentMethod: "COD",
      });
    }

    /* ---------------- RAZORPAY ---------------- */
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100,
      currency: "INR",
      receipt: orderNumber,
    });

    order[0].razorpay.orderId = razorpayOrder.id;
    await order[0].save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      orderId: order[0]._id,
      orderNumber,
      razorpayOrder,
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("placeOrder error:", err);

    res.status(400).json({
      success: false,
      message: err.message || "Order failed",
    });
  } finally {
    session.endSession();
  }
};
const verifyRazorpay = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, razorpayPaymentId, razorpaySignature } = req.body;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Order not found" });
    }

    // 🔐 Prevent double verification
    if (order.paymentStatus === "PAID") {
      await session.commitTransaction();
      return res.json({
        success: true,
        message: "Payment already verified",
        orderId: order._id,
      });
    }

    // 🔐 Signature verification
    const sign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(order.razorpay.orderId + "|" + razorpayPaymentId)
      .digest("hex");

    if (sign !== razorpaySignature) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // ✅ Update order payment info
    order.paymentStatus = "PAID";
    order.orderStatus = "CONFIRMED";
    order.razorpay.paymentId = razorpayPaymentId;
    order.razorpay.signature = razorpaySignature;

    // 💰 Credit vendor wallets (SAFE)
    for (const item of order.items) {
      if (!item.walletCredited) {
        await Vendor.findByIdAndUpdate(
          item.vendorId,
          { $inc: { walletBalance: item.vendorEarning } },
          { session }
        );

        item.walletCredited = true;
      }
    }

    await order.save({ session });

    // 🧹 Clear cart / buy-now safely
    await Cart.deleteOne({ user: order.user }).session(session);
    await BuyNow.deleteOne({ user: order.user }).session(session);

    await session.commitTransaction();

    res.json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("verifyRazorpay error:", err);
    res.status(500).json({ message: "Payment verification failed" });
  } finally {
    session.endSession();
  }
};

const getOrderById = async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json({
    success: true,
    order,
  });
};
const getUserOrders = async (req, res) => {
  const query = { user: req.user.id };

  if (req.query.status && req.query.status !== "all") {
    query.orderStatus = req.query.status;
  }

  if (req.query.paymentStatus && req.query.paymentStatus !== "all") {
    query.paymentStatus = req.query.paymentStatus;
  }

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .lean();
    console.log(orders)

  res.json({ success: true, orders });
};
const getVendorOrders = async (req, res) => {
  const vendorId = req.vendor.id;
  console.log(vendorId)

  const orders = await Order.find({
    "items.vendorId": vendorId,
  })
    .populate("user", "name email phone")
    .sort({ createdAt: -1 });

  const getVendorStatus = (items) => {
    if (items.every(i => i.status === "DELIVERED")) return "DELIVERED";
    if (items.some(i => i.status === "SHIPPED")) return "SHIPPED";
    if (items.some(i => i.status === "CONFIRMED")) return "CONFIRMED";
    return "PLACED";
  };

  const vendorOrders = orders.map(order => {
    const vendorItems = order.items.filter(
      item => String(item.vendorId) === String(vendorId)
    );

    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,

      user: order.user,                 // ✅ needed
      address: order.address,

      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,

      vendorOrderStatus: getVendorStatus(vendorItems), // ✅ derived

      items: vendorItems,               // ✅ item-level
      subtotal: vendorItems.reduce(
        (sum, i) => sum + i.price * i.qty,
        0
      ),
    };
  });

  res.json(vendorOrders);
};

const deriveOrderStatus = (items = []) => {
  if (items.every(i => i.status === "DELIVERED")) return "DELIVERED";
  if (items.some(i => i.status === "SHIPPED")) return "SHIPPED";
  if (items.some(i => i.status === "CONFIRMED")) return "CONFIRMED";
  return "PLACED";
};

const updateVendorItemStatus = async (req, res) => {
  const { orderId, itemId } = req.params;
  const { status } = req.body;
  const vendorId = req.vendor.id;

  const order = await Order.findOne({
    _id: orderId,
    "items._id": itemId,
    "items.vendorId": vendorId,
  });

  if (!order) {
    return res.status(404).json({ message: "Order item not found" });
  }

  // ✅ Update item status
  const item = order.items.id(itemId);
  item.status = status;
    if (status === "DELIVERED") {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { soldCount: item.qty },
    })
  }

  // ✅ DERIVE ORDER STATUS FROM ALL ITEMS
  order.orderStatus = deriveOrderStatus(order.items);

  await order.save();

  res.json({
    success: true,
    itemId,
    itemStatus: status,
    orderStatus: order.orderStatus, // 🔥 useful for frontend
  });
};


const getCheckoutItems = async (req, res) => {
  const userId = req.user.id;

  const buyNow = await BuyNow.findOne({ user: userId });
  if (buyNow && buyNow.items.length === 1) {
    return res.json({
      source: "BUY_NOW",
      items: buyNow.items,
    });
  }

  const cart = await Cart.findOne({ user: userId });
  if (cart && cart.items.length) {
    return res.json({
      source: "CART",
      items: cart.items,
    });
  }

  return res.status(400).json({ message: "No items to checkout" });
};
module.exports={verifyRazorpay,placeOrder,getOrderById,getUserOrders,getVendorOrders,updateVendorItemStatus,getCheckoutItems}