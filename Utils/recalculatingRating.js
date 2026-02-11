const Review = require("../Models/reviewModel");
const Product = require("../Models/productModel")
const mongoose = require("mongoose");

async function recalculateRating(productId) {
  const objectId = new mongoose.Types.ObjectId(productId);

  const stats = await Review.aggregate([
    { $match: { product: objectId } },
    {
      $group: {
        _id: "$product",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (!stats.length) {
    await Product.findByIdAndUpdate(productId, {
      averageRating: 0,
      reviewCount: 0,
    });
    return;
  }

  await Product.findByIdAndUpdate(productId, {
    averageRating: Number(stats[0].avg.toFixed(1)), // optional clean decimal
    reviewCount: stats[0].count,
  });
}


module.exports={recalculateRating}