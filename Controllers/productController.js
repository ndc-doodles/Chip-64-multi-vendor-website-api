// controllers/productController.js
const Product = require("../Models/productModel"); // adjust path if needed
const mongoose = require("mongoose");
const { uploadBufferToCloudinary } = require("../Utils/cloudinaryHelper"); // your helper
const ALLOWED_GENDERS = ["Men", "Women", "Unisex"];
const Category=require("../Models/categoryModel")
/**
 * Helper: map incoming variant object -> normalized variant with images[] (0..4)
 * - v may contain: image (string or array), imageIndex (number), imageIndices (array)
 * - otherImages is an array of URLs produced by uploading gallery files for this request
 */
async function deleteRemoteImageByUrl(url) {
  if (!url || typeof url !== "string") return;
  try {
    // Cloudinary expects public_id, so convert URL -> public_id
    // This simple extractor assumes standard Cloudinary URL format:
    // https://res.cloudinary.com/<cloud_name>/.../<folder>/<public_id>.<ext>
    const parts = url.split("/");
    const last = parts[parts.length - 1]; // public_id.ext
    const [publicWithExt] = [last];
    const publicParts = publicWithExt.split(".");
    const publicId = publicParts.slice(0, -1).join("."); // handles dots in public_id
    // Build possible folder path (everything after "upload/")
    const uploadIdx = parts.findIndex((p) => p === "upload");
    let public_path = publicId;
    if (uploadIdx >= 0) {
      const afterUpload = parts.slice(uploadIdx + 1); // e.g. ['v1234', 'folder', 'file.jpg']
      // remove version token like v123456 if present
      if (afterUpload[0] && afterUpload[0].startsWith("v") && /^\v?\d+$/.test(afterUpload[0]) === false) {
        // ignore — defensive
      }
      // remove version token if it starts with 'v' followed by digits
      const withoutVersion = afterUpload[0] && /^v\d+$/.test(afterUpload[0]) ? afterUpload.slice(1) : afterUpload;
      // join without extension
      const pathParts = withoutVersion.map((p, idx) => {
        if (idx === withoutVersion.length - 1) return p.split(".").slice(0, -1).join(".");
        return p;
      });
      public_path = pathParts.join("/");
    }
    // try destroy using derived public_id
    await cloudinary.uploader.destroy(public_path, { resource_type: "image" });
  } catch (e) {
    // best-effort: if cloudinary delete fails, log and continue
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

/**
 * Create product
 * Expects multipart/form-data:
 * - mainImage (file) required
 * - images (multiple files) optional
 * - body fields: name, description, basePrice, category, gender, badges, tags, variants (JSON string)
 */
// controllers/productController.js (only the createProduct function)
// replace your existing createProduct with this
// controllers/productController.js (replace createProduct with this)
const createProduct = async (req, res) => {
  try {
    // debug: what arrived
    console.log(">>> multer files keys:", Object.keys(req.files || {}));
    console.log(">>> raw req.body keys:", Object.keys(req.body || {}));
    console.log(">>> raw req.body.variants:", req.body.variants);

    const {
      name,
      description,
      basePrice,
      category,
      gender,
      badges,
      tags,
      variants: variantsRaw,
      slug: incomingSlug,
    } = req.body;

    // basic validation
    if (!name || !description || !basePrice || !category) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (!mongoose.isValidObjectId(category)) {
      return res.status(400).json({ success: false, message: "Invalid category id" });
    }

    // optional: ensure category exists
    const cat = await Category.findById(category);
    if (!cat) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (!gender || !ALLOWED_GENDERS.includes(gender)) {
      return res.status(400).json({ success: false, message: `gender is required and must be one of: ${ALLOWED_GENDERS.join(", ")}` });
    }

    // slug
    const slug = (incomingSlug || name)
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // unique slug check
    const exists = await Product.findOne({ slug });
    if (exists) return res.status(409).json({ success: false, message: "Product slug already exists" });

    // mainImage (required)
    if (!req.files || !req.files.mainImage || !req.files.mainImage[0]) {
      return res.status(400).json({ success: false, message: "mainImage file is required" });
    }
    const mainFile = req.files.mainImage[0];
    const mainUpload = await uploadBufferToCloudinary(mainFile.buffer, `products/${slug}/main`);
    const mainImageUrl = mainUpload?.secure_url || mainUpload?.url || "";

    // gallery images (optional) -> store in product.images
    const galleryImages = [];
    if (req.files && Array.isArray(req.files.images)) {
      for (let i = 0; i < req.files.images.length; i++) {
        const f = req.files.images[i];
        const r = await uploadBufferToCloudinary(f.buffer, `products/${slug}/gallery-${Date.now()}-${i}`);
        galleryImages.push(r?.secure_url || r?.url || "");
      }
    }

    // variant images (optional) -> these are uploaded in one flat list by the client as "variantImages"
    const variantImageUrls = [];
    if (req.files && Array.isArray(req.files.variantImages)) {
      for (let i = 0; i < req.files.variantImages.length; i++) {
        const f = req.files.variantImages[i];
        const r = await uploadBufferToCloudinary(f.buffer, `products/${slug}/variant-${Date.now()}-${i}`);
        variantImageUrls.push(r?.secure_url || r?.url || "");
      }
    }

    // parse variants JSON - tolerant: accept array or JSON string
    let parsedVariants = [];
    if (variantsRaw) {
      try {
        const raw = typeof variantsRaw === "string" ? JSON.parse(variantsRaw) : variantsRaw;
        if (!Array.isArray(raw)) throw new Error("variants must be an array");
        // map incoming variant -> normalized variant with images[] using helper
        parsedVariants = raw.map((v) => buildVariantFromIncoming(v, variantImageUrls));
      } catch (err) {
        console.error("variants parse error:", err);
        return res.status(400).json({ success: false, message: "Invalid variants JSON" });
      }
    } else {
      return res.status(400).json({ success: false, message: "At least one variant is required." });
    }

    // ensure at least one variant present
    if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
      return res.status(400).json({ success: false, message: "At least one variant is required." });
    }

    // badges/tags normalization
    const badgesArr = badges ? (Array.isArray(badges) ? badges : String(badges).split(",").map(s => s.trim()).filter(Boolean)) : [];
    const tagsArr = tags ? (Array.isArray(tags) ? tags : String(tags).split(",").map(s => s.trim()).filter(Boolean)) : [];

    // create product
    const product = await Product.create({
      name: String(name).trim(),
      slug,
      description,
      basePrice: Number(basePrice),
      category,
      gender,
      badges: badgesArr,
      mainImage: mainImageUrl,
      images: galleryImages,        // gallery images
      variants: parsedVariants,     // **each variant has `image` array per your schema**
      isActive: req.body.isActive === "false" ? false : true,
      tags: tagsArr,
      soldCount: 0,
    });

    console.log("Created product id:", product._id, "variants:", parsedVariants.map(v => ({ color: v.color, imagesCount: Array.isArray(v.images) ? v.images.length : (Array.isArray(v.image) ? v.image.length : 0) })));

    return res.status(201).json({ success: true, product });
  } catch (err) {
    console.error("createProduct error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


/**
 * List products
 */
const listProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .populate("category", "name") // <-- populate category name
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
    return res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const updateProduct = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  try {
    const p = await Product.findById(id);
    if (!p) return res.status(404).json({ success: false, message: "Not found" });
     
    // update base fields
    if (req.body.name) p.name = req.body.name.trim();
    if (req.body.description) p.description = req.body.description;
    if (req.body.basePrice) p.basePrice = Number(req.body.basePrice);
     if (req.body.category) {
  const newCat = req.body.category;
  if (!mongoose.isValidObjectId(newCat)) {
    return res.status(400).json({ success: false, message: "Invalid category id" });
  }
  const cat = await Category.findById(newCat);
  if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
  p.category = newCat;
}

    // gender update (validate)
    if (typeof req.body.gender !== "undefined") {
      if (!ALLOWED_GENDERS.includes(req.body.gender)) {
        return res.status(400).json({ success: false, message: `gender must be one of: ${ALLOWED_GENDERS.join(", ")}` });
      }
      p.gender = req.body.gender;
    }

    if (req.body.badges) p.badges = Array.isArray(req.body.badges) ? req.body.badges : String(req.body.badges).split(",").map(s => s.trim()).filter(Boolean);
    if (req.body.tags) p.tags = Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags).split(",").map(s => s.trim()).filter(Boolean);
    if (typeof req.body.isActive !== "undefined") p.isActive = req.body.isActive === "false" ? false : Boolean(req.body.isActive);

    // replace mainImage if provided
    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      const f = req.files.mainImage[0];
      const result = await uploadBufferToCloudinary(f.buffer, `products/${p.slug}/main`);
      p.mainImage = result?.secure_url || result?.url || p.mainImage;
    }

    // handle removeImages (array of remote URLs marked for deletion)
    let removeImages = [];
    if (req.body.removeImages) {
      try {
        removeImages = typeof req.body.removeImages === "string" ? JSON.parse(req.body.removeImages) : req.body.removeImages;
        if (!Array.isArray(removeImages)) removeImages = [];
      } catch (err) {
        removeImages = [];
      }
    }

    if (removeImages.length > 0) {
      // best-effort delete from cloudinary and remove from product.images and variants
      for (const url of removeImages) {
        try {
          await deleteRemoteImageByUrl(url);
        } catch (e) {
          console.warn("failed to delete remote image", url, e?.message || e);
        }
      }

      // remove references from p.images
      p.images = (p.images || []).filter((u) => !removeImages.includes(u));

      // remove references inside variants' images arrays (if you store them)
      if (Array.isArray(p.variants) && p.variants.length) {
        p.variants = p.variants.map((vv) => {
          if (Array.isArray(vv.images) && vv.images.length) {
            return { ...vv, images: vv.images.filter((u) => !removeImages.includes(u)) };
          }
          return vv;
        });
      }
    }

    // Upload new gallery images if provided -> these will replace p.images
    // Note: we support replacing p.images entirely with newly uploaded images if req.files.images provided.
    let newImages = null;
    if (req.files && req.files.images) {
      newImages = [];
      for (let i = 0; i < req.files.images.length; i++) {
        const f = req.files.images[i];
        const result = await uploadBufferToCloudinary(f.buffer, `products/${p.slug}/image-${Date.now()}-${i}`);
        newImages.push(result?.secure_url || result?.url || "");
      }
      // replace p.images with newImages
      p.images = newImages;
    }

    // parse & set variants if provided
    if (req.body.variants) {
      try {
        const parsed = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
        if (Array.isArray(parsed)) {
          // Determine sourceImages for mapping imageIndices:
          // prefer newly uploaded images (newImages) otherwise current p.images
          const sourceImages = Array.isArray(newImages) ? newImages : (Array.isArray(p.images) ? p.images : []);
          const mapped = parsed.map(v => buildVariantFromIncoming(v, sourceImages));
          if (!Array.isArray(mapped) || mapped.length === 0) {
            return res.status(400).json({ success: false, message: "At least one variant is required." });
          }
          p.variants = mapped;
        } else {
          return res.status(400).json({ success: false, message: "Invalid variants payload" });
        }
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid variants JSON" });
      }
    }

    await p.save();
    return res.json({ success: true, product: p });
  } catch (err) {
    console.error("updateProduct error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
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
      category,        // category _id
      search = "",
      sort = "new",
      page = 1,
      limit = 24,
    } = req.query;

    // Build base filter (only active products)
    const filter = { isActive: true };

    // filter by category id if provided
    if (category) {
      // allow objectId or string - assume client sends _id
      filter.category = category;
    }

    // simple text search on name/description/tags
    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ];
    }

    // sorting
    let sortObj = { createdAt: -1 }; // default -> newest
    if (sort === "price-asc") sortObj = { basePrice: 1 };
    else if (sort === "price-desc") sortObj = { basePrice: -1 };
    else if (sort === "bestselling") sortObj = { soldCount: -1 };

    const pg = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(100, Number(limit) || 24));
    const skip = (pg - 1) * lim;

    // total count for pagination
    const total = await Product.countDocuments(filter);

    // fetch products, populate category (only _id & name)
    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(lim)
      .select("-__v") // omit __v
      .populate({ path: "category", select: "_id name" })
      .lean();

    return res.json({
      success: true,
      meta: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
      products,
    });
  } catch (error) {
    console.error("getUserProducts error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
module.exports = {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  toggleProduct,
  getShopProducts
};
