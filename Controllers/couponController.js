 const Coupon=require("../Models/couponModel")
 
 const createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
const getAllCoupons = async (req, res) => {
  const coupons = await Coupon.find({ isDeleted: false }).sort({ createdAt: -1 });
  res.json(coupons);
};
const toggleCouponStatus = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  res.json({ success: true, isActive: coupon.isActive });
};
 const deleteCoupon = async (req, res) => {
  await Coupon.deleteOne(req.params.id);
  res.json({ success: true });
};
const validateCoupon = async (req, res) => {
  const { code, cartTotal } = req.body;
  const userId = req.user._id;

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
    isDeleted: false
  });

  if (!coupon)
    return res.status(400).json({ message: "Invalid coupon" });

  if (coupon.expiryDate < new Date())
    return res.status(400).json({ message: "Coupon expired" });

  if (cartTotal < coupon.minOrderValue)
    return res.status(400).json({ message: `Minimum order ₹${coupon.minOrderValue}` });

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return res.status(400).json({ message: "Coupon usage limit reached" });

  const alreadyUsed = coupon.usedBy.some(
    (u) => u.userId.toString() === userId.toString()
  );

  if (alreadyUsed)
    return res.status(400).json({ message: "Coupon already used" });

  let discount = 0;

  if (coupon.discountType === "PERCENTAGE") {
    discount = (cartTotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount)
      discount = Math.min(discount, coupon.maxDiscountAmount);
  } else {
    discount = coupon.discountValue;
  }

  discount = Math.min(discount, cartTotal);

  res.json({
    success: true,
    couponId: coupon._id,
    discount,
    finalAmount: cartTotal - discount
  });
};
const getAvailableCoupons = async (req, res) => {
  const userId = req.user.id;
  const cartTotal = Number(req.query.cartTotal || 0);

  const now = new Date();
  console.log(userId,cartTotal)
  const coupons = await Coupon.find({
    isActive: true,
    isDeleted: false,
    expiryDate: { $gt: now },
    minOrderValue: { $lte: cartTotal },

    // ✅ FIX: handle empty usedBy properly
    $or: [
      { usedBy: { $size: 0 } },
      { "usedBy.userId": { $ne: userId } }
    ],

    // ✅ FIX: usage limit logic
    $expr: {
      $or: [
        { $eq: ["$usageLimit", null] },
        { $lt: ["$usedCount", "$usageLimit"] }
      ]
    }
  }).select(
    "code discountType discountValue maxDiscountAmount minOrderValue expiryDate"
  );

  res.json({
    success: true,
    coupons
  });
};

module.exports={validateCoupon,toggleCouponStatus,getAllCoupons,createCoupon,deleteCoupon,getAvailableCoupons}