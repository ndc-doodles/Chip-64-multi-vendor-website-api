const Review = require("../Models/reviewModel");
const Product = require("../Models/productModel");
const Order = require("../Models/orderModel");
const {recalculateRating} = require("../Utils/recalculatingRating")
const mongoose=require("mongoose")
const createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, rating, comment } = req.body;

    /* ---------------- BASIC VALIDATION ---------------- */

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    if (!comment || comment.trim().length < 5) {
      return res.status(400).json({
        message: "Review comment must be at least 5 characters",
      });
    }

    /* ---------------- PRODUCT EXISTS ---------------- */

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    /* ---------------- VERIFIED PURCHASE ---------------- */

    const hasPurchased = await Order.exists({
      user: userId,
      "items.productId": productId,
      orderStatus: "DELIVERED",
    });

    if (!hasPurchased) {
      return res.status(403).json({
        message: "Only users who purchased this product can review",
      });
    }

    /* ---------------- CREATE OR UPDATE REVIEW ---------------- */
    // ⭐ THIS IS THE IMPORTANT FIX
    const review = await Review.findOneAndUpdate(
      { user: userId, product: productId }, // unique combo
      {
        rating,
        comment,
        vendor: product.vendorId,
        isVerifiedPurchase: true,
      },
      {
        new: true,
        upsert: true, // create if not exists
        setDefaultsOnInsert: true,
      }
    );

    /* ---------------- RECALCULATE PRODUCT RATING ---------------- */

    await recalculateRating(productId);

    /* ---------------- RESPONSE ---------------- */

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review,
    });

  } catch (error) {
    console.error("Create review error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong while submitting review",
    });
  }
};


const getProductReviews = async (req, res) => {
  const { id } = req.params;

  const reviews = await Review.find({ product: id })
    .populate("user", "name avatar")
    .sort({ createdAt: -1 })
    .limit(10);

  res.json(reviews);
};
const updateReview = async (req, res) => {
  const userId = req.user.id;
  const { rating, comment } = req.body;

  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });

  if (String(review.user) !== userId) {
    return res.status(403).json({ message: "Not allowed" });
  }

  review.rating = rating ?? review.rating;
  review.comment = comment ?? review.comment;

  await review.save();
  await recalculateRating(review.product);

  res.json({ success: true, review });
};
const deleteReview = async (req, res) => {
  const userId = req.user.id;

  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });

  if (String(review.user) !== userId) {
    return res.status(403).json({ message: "Not allowed" });
  }

  await review.deleteOne();
  await recalculateRating(review.product);

  res.json({ success: true });
};


module.exports={createReview,getProductReviews,updateReview,deleteReview}