 const Category=require("../Models/categoryModel")
 const Product=require("../Models/productModel")
 const mongoose=require("mongoose")
 const getProductsByCollection = async (req, res) => {
  try {
    const { slug } = req.params;

    const {
      brand,
      minPrice,
      maxPrice,
      sort = "newest",
    } = req.query;

    /* ---------------- FIND CATEGORY ---------------- */
    const category = await Category.findOne({ slug });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    /* ---------------- QUERY ---------------- */
    const query = {
      category: category._id,
      isActive: true,
    };

    if (brand && mongoose.isValidObjectId(brand)) {
      query.brand = brand;
    }

    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }

    /* ---------------- SORT ---------------- */
    let sortQuery = { createdAt: -1 };

    if (sort === "price-low") sortQuery = { basePrice: 1 };
    if (sort === "price-high") sortQuery = { basePrice: -1 };

    /* ---------------- FETCH ---------------- */
    const products = await Product.find(query)
      .populate("brand", "name")
      .populate("vendorId", "name")
      .sort(sortQuery)
      .lean();

    return res.json({
      success: true,
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
      },
      products,
    });
  } catch (error) {
    console.error("collection error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports={getProductsByCollection}