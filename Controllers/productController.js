// controllers/productController.js
const Product = require("../Models/productModel"); // adjust path if needed
const mongoose = require("mongoose");
const { uploadBufferToCloudinary } = require("../Utils/cloudinaryHelper"); // your helper
const ALLOWED_GENDERS = ["Men", "Women", "Unisex"];
const Category=require("../Models/categoryModel")
const User=require("../Models/userModel")

async function deleteRemoteImageByUrl(url) {
  if (!url || typeof url !== "string") return;
  try {

    const parts = url.split("/");
    const last = parts[parts.length - 1]; // public_id.ext
    const [publicWithExt] = [last];
    const publicParts = publicWithExt.split(".");
    const publicId = publicParts.slice(0, -1).join("."); // handles dots in public_id
    const uploadIdx = parts.findIndex((p) => p === "upload");
    let public_path = publicId;
    if (uploadIdx >= 0) {
      const afterUpload = parts.slice(uploadIdx + 1); // e.g. ['v1234', 'folder', 'file.jpg']
      if (afterUpload[0] && afterUpload[0].startsWith("v") && /^\v?\d+$/.test(afterUpload[0]) === false) {
      }
      const withoutVersion = afterUpload[0] && /^v\d+$/.test(afterUpload[0]) ? afterUpload.slice(1) : afterUpload;
      const pathParts = withoutVersion.map((p, idx) => {
        if (idx === withoutVersion.length - 1) return p.split(".").slice(0, -1).join(".");
        return p;
      });
      public_path = pathParts.join("/");
    }
    await cloudinary.uploader.destroy(public_path, { resource_type: "image" });
  } catch (e) {
    console.warn("deleteRemoteImageByUrl failed for", url, e?.message || e);
  }
}

function buildVariantFromIncoming(v = {}, otherImages = []) {
  const stock = Number(v.stock || 0);
  const price = v.price != null && v.price !== "" ? Number(v.price) : null;

  let images = [];

  // prefer explicit image or images provided as URL(s)
  if (v.image) {
    if (Array.isArray(v.image)) images = v.image.slice(0, 4).map(String).filter(Boolean);
    else images = [String(v.image)].filter(Boolean).slice(0, 4);
  }

  // imageIndices -> map to otherImages (if explicit images not provided)
  if ((images.length === 0 || !images) && Array.isArray(v.imageIndices)) {
    images = v.imageIndices
      .map((idx) => {
        const i = Number(idx);
        return Number.isFinite(i) && otherImages[i] ? otherImages[i] : null;
      })
      .filter(Boolean)
      .slice(0, 4);
  }

  // fallback: single imageIndex numeric
  if ((images.length === 0 || !images) && typeof v.imageIndex === "number") {
    const i = Number(v.imageIndex);
    if (otherImages[i]) images = [otherImages[i]];
  }

  // final result
  return {
    color: v.color,
    size: v.size,
    stock,
    price,
    image: images,
  };
}


const createProduct = async (req, res) => {

  try {
    const {
      name,
      description,
      basePrice,
      category,
      badges,
      tags,
      variants: variantsRaw,
      slug: incomingSlug,
      isActive,
      brand
    } = req.body;

    /* ---------------- BASIC VALIDATION ---------------- */

    if (!name || !description || !basePrice || !category || !brand) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!mongoose.isValidObjectId(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }
     if (!mongoose.isValidObjectId(brand)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand",
      });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    /* ---------------- SLUG ---------------- */

    const slug = (incomingSlug || name)
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const slugExists = await Product.findOne({ slug });
    if (slugExists) {
      return res.status(409).json({
        success: false,
        message: "Product slug already exists",
      });
    }

    /* ---------------- MAIN IMAGE (REQUIRED) ---------------- */

    if (!req.files?.mainImage?.[0]) {
      return res.status(400).json({
        success: false,
        message: "Main product image is required",
      });
    }

    const mainFile = req.files.mainImage[0];
    const mainUpload = await uploadBufferToCloudinary(
      mainFile.buffer,
      `chip/products/${slug}/main`
    );

    const mainImageUrl =
      mainUpload?.secure_url || mainUpload?.url || "";

    /* ---------------- GALLERY IMAGES (OPTIONAL) ---------------- */

    const galleryImages = [];
    if (Array.isArray(req.files?.images)) {
      for (let i = 0; i < req.files.images.length; i++) {
        const file = req.files.images[i];
        const upload = await uploadBufferToCloudinary(
          file.buffer,
          `chip/products/${slug}/gallery-${Date.now()}-${i}`
        );
        galleryImages.push(upload?.secure_url || upload?.url || "");
      }
    }

    /* ---------------- VARIANT IMAGES ---------------- */

    const variantImageUrls = [];
    if (Array.isArray(req.files?.variantImages)) {
      for (let i = 0; i < req.files.variantImages.length; i++) {
        const file = req.files.variantImages[i];
        const upload = await uploadBufferToCloudinary(
          file.buffer,
          `chip/products/${slug}/variant-${Date.now()}-${i}`
        );
        variantImageUrls.push(upload?.secure_url || upload?.url || "");
      }
    }

    /* ---------------- PARSE VARIANTS ---------------- */

    if (!variantsRaw) {
      return res.status(400).json({
        success: false,
        message: "At least one variant is required",
      });
    }

    let parsedVariants = [];

    try {
      const raw =
        typeof variantsRaw === "string"
          ? JSON.parse(variantsRaw)
          : variantsRaw;

      if (!Array.isArray(raw)) {
        throw new Error("variants must be an array");
      }

      parsedVariants = raw.map((v) =>
        buildVariantFromIncoming(v, variantImageUrls)
      );
    } catch (err) {
      console.error("Variant parse error:", err);
      return res.status(400).json({
        success: false,
        message: "Invalid variants format",
      });
    }

    if (!parsedVariants.length) {
      return res.status(400).json({
        success: false,
        message: "At least one variant is required",
      });
    }

    /* ---------------- TAGS / BADGES ---------------- */

    const badgesArr = badges
      ? Array.isArray(badges)
        ? badges
        : String(badges)
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean)
      : [];

    const tagsArr = tags
      ? Array.isArray(tags)
        ? tags
        : String(tags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
      : [];

    /* ---------------- CREATE PRODUCT ---------------- */

    const product = await Product.create({
      name: String(name).trim(),
      slug,
      description,
      basePrice: Number(basePrice),
      category,
      brand,
      mainImage: mainImageUrl,
      images: galleryImages,
      variants: parsedVariants, // attributes stay flexible
      badges: badgesArr,
      tags: tagsArr,
      isActive: isActive === "false" ? false : true,
      soldCount: 0,
    });


    return res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("createProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


/**
 * List products
 */
const listProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .populate("category", "name")
      .populate("vendorId","name")
      .lean();
    return res.json({ success: true, products });
  } catch (err) {
    console.error("listProducts error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get single product
 */
const getProduct = async (req, res) => {
  const { slug } = req.params;
  try {
    const product = await Product.findOne({ slug })
      .populate("category", "name")
      .lean();
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
     if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { recentlyViewedProducts: product._id }, // remove duplicate
      });

      await User.findByIdAndUpdate(req.user.id, {
        $push: {
          recentlyViewedProducts: {
            $each: [product._id],
            $position: 0,
            $slice: 5,
          },
        },
      });
    }
    return res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const updateProduct = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid product id" });
  }

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }


    if (req.body.name) product.name = req.body.name.trim();
    if (req.body.description) product.description = req.body.description;
    if (req.body.basePrice) product.basePrice = Number(req.body.basePrice);

    if (req.body.category) {
      if (!mongoose.isValidObjectId(req.body.category)) {
        return res.status(400).json({ success: false, message: "Invalid category id" });
      }

      const cat = await Category.findById(req.body.category);
      if (!cat) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }

      product.category = req.body.category;
    }

    if (req.body.tags) {
      product.tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : String(req.body.tags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
    }

    if (typeof req.body.isActive !== "undefined") {
      product.isActive = req.body.isActive === "false" ? false : true;
    }

    if (req.files?.mainImage?.[0]) {
      const file = req.files.mainImage[0];

      const upload = await uploadBufferToCloudinary(
        file.buffer,
        `chip/products/${product.slug}/main`
      );

      product.mainImage = upload?.secure_url || upload?.url || product.mainImage;
    }


    let removeImages = [];
    if (req.body.removeImages) {
      try {
        removeImages =
          typeof req.body.removeImages === "string"
            ? JSON.parse(req.body.removeImages)
            : req.body.removeImages;
      } catch {
        removeImages = [];
      }
    }

    if (Array.isArray(removeImages) && removeImages.length) {
      for (const url of removeImages) {
        try {
          await deleteRemoteImageByUrl(url);
        } catch (err) {
          console.warn("Failed to delete:", url);
        }
      }

      // remove from variant images
      product.variants = product.variants.map((v) => ({
        ...v,
        images: (v.images || []).filter((img) => !removeImages.includes(img)),
      }));
    }

    /* ---------------- VARIANT IMAGES UPLOAD ---------------- */

    let uploadedVariantImages = [];
    if (Array.isArray(req.files?.variantImages)) {
      for (let i = 0; i < req.files.variantImages.length; i++) {
        const f = req.files.variantImages[i];
        const r = await uploadBufferToCloudinary(
          f.buffer,
          `chip/products/${product.slug}/variant-${Date.now()}-${i}`
        );
        uploadedVariantImages.push(r?.secure_url || r?.url || "");
      }
    }

    /* ---------------- VARIANTS ---------------- */

    if (req.body.variants) {
      let parsedVariants;

      try {
        parsedVariants =
          typeof req.body.variants === "string"
            ? JSON.parse(req.body.variants)
            : req.body.variants;
      } catch {
        return res.status(400).json({ success: false, message: "Invalid variants JSON" });
      }

      if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
        return res.status(400).json({ success: false, message: "At least one variant required" });
      }

      product.variants = parsedVariants.map((v) =>
        buildVariantFromIncoming(v, uploadedVariantImages)
      );
    }

    await product.save();

    return res.json({ success: true, product });
  } catch (err) {
    console.error("updateProduct error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const getRelatedProducts = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const related = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true,
    })
      .limit(8)
      .select("name slug mainImage basePrice variants")
      .lean();

    res.json({ success: true, products: related });
  } catch (err) {
    console.error("getRelatedProducts error:", err);
    res.status(500).json({ success: false });
  }
};

/**
 * Toggle product active flag
 */
const toggleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    const p = await Product.findById(id);
    if (!p) return res.status(404).json({ success: false, message: "Not found" });
    p.isActive = !p.isActive;
    await p.save();
    return res.json({ success: true, product: p });
  } catch (err) {
    console.error("toggleProduct error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
const getShopProducts = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      search = "",
      sort = "new",
      gender,
      minPrice,
      maxPrice,
      inStock,
      page = 1,
      limit = 12,
    } = req.query;

    console.log(req.query)
    const filter = { isActive: true };
    console.log("search",search)

    /* CATEGORY + SUBCATEGORY */
    let categoryIds = [];

    if (subcategory) {
      categoryIds = [subcategory];
    } else if (category) {
      const children = await Category.find(
        { parentCategory: category },
        "_id"
      );
      categoryIds = [category, ...children.map(c => c._id)];
    }

    if (categoryIds.length) {
      filter.category = { $in: categoryIds };
    }

    /* GENDER */
    if (gender) {
      filter.gender = Array.isArray(gender)
        ? { $in: gender }
        : gender;
    }

    /* STOCK */
    if (inStock === "true") {
      filter["variants.stock"] = { $gt: 0 };
    }

    /* PRICE */
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice) filter.basePrice.$gte = Number(minPrice);
      if (maxPrice) filter.basePrice.$lte = Number(maxPrice);
    }

    /* SEARCH */
  if (search.trim()) {
  const cleaned = search.replace(/\s+/g, ""); // remove spaces
  const pattern = cleaned.split("").join(".*"); // i -> .* -> p

  filter.name = {
    $regex: `^${pattern}`,
    $options: "i"
  };
}


    /* SORT */
    let sortObj = { createdAt: -1 };
    if (sort === "price-low-high") sortObj = { basePrice: 1 };
    if (sort === "price-high-low") sortObj = { basePrice: -1 };
    if (sort === "best-seller") sortObj = { soldCount: -1 };

    /* PAGINATION */
    const pg = Math.max(1, Number(page));
    const lim = Math.min(100, Number(limit));
    const skip = (pg - 1) * lim;

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(lim)
      .populate("category", "name")
      .populate("vendorId", "name")
      .lean();

    res.json({
      success: true,
      products,
      meta: {
        total,
        page: pg,
        pages: Math.ceil(total / lim),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.json([]);
    }

    // remove spaces
    const cleaned = q.replace(/\s+/g, "");

    // build flexible regex: i\s*p\s*h\s*o\s*n\s*e
    const pattern = cleaned.split("").join("\\s*");

    const regex = new RegExp(pattern, "i");

    const products = await Product.find({
      name: { $regex: regex }
    })
      .select("name slug basePrice mainImage")
      .limit(5)
      .lean();

    res.json(products);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Search failed" });
  }
};

const getRecentlyViewed = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: "recentlyViewedProducts",
        populate: [
          { path: "category", select: "name" },
          { path: "vendorId", select: "storeName" },
        ],
      })
      .lean();

    return res.json({
      success: true,
      products: user?.recentlyViewedProducts || [],
    });
  } catch (err) {
    console.error("recently viewed error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  toggleProduct,
  getShopProducts,
  getRelatedProducts,
  searchProducts,
  getRecentlyViewed
};
