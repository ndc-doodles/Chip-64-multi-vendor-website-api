const Vendor=require("../Models/vendorModel")
const sendTokens=require("../Utils/sendTokens")
const bcrypt=require("bcrypt")
const Product=require("../Models/productModel")
const {uploadBufferToCloudinary}=require("../Utils/cloudinaryHelper")
const Category=require("../Models/categoryModel")
const mongoose=require("mongoose")
const slugify=require("slugify")
const Order=require("../Models/orderModel")

function sanitizeAttributes(attrs = {}) {
  const clean = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (
      typeof key === "string" &&
      typeof value === "string" &&
      key.trim() !== "" &&
      value.trim() !== ""
    ) {
      clean[key.trim()] = value.trim();
    }
  }

  return clean;
}

const vendorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 2️⃣ find vendor
    const vendor = await Vendor.findOne({ email, isBlocked: false }).select("+password");
    
    if (!vendor) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3️⃣ check password
    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
     const vendorWithRole={
        ...vendor.toObject(),
        role:"vendor",
     };
      return sendTokens(vendorWithRole,res)
    }
    catch(err){
      console.error("Vendor login error",err)
      return res.status(500).json({message:"Server Error"})
    }
}
const listVendorProducts = async (req, res) => {
  try {
    const vendorId = req.vendor.id;

    const products = await Product.find({ vendorId })
      .populate("category", "name")
      .sort({ createdAt: -1 });

    return res.json({ success: true, products });
  } catch (err) {
    console.error("listVendorProducts error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
const createVendorProduct = async (req, res) => {
  try {
    const vendorId = req.vendor.id;

    const {
      name,
      description,
      basePrice,
      category,
      tags,
      isActive,
      variants,
      brand
    
    } = req.body;

    /* ------------------ Basic validation ------------------ */
    if (!name || !description || !basePrice || !category || !brand) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (!mongoose.isValidObjectId(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }
       if (!mongoose.isValidObjectId(brand)) {
      return res.status(400).json({ message: "Invalid category" });
    }

   if (!req.files?.mainImage?.[0]) {
  return res.status(400).json({ message: "Main image is required" });
}

const mainImageFile = req.files.mainImage[0];


    /* ------------------ Slug ------------------ */
   
// ❌ Block if SAME vendor already has this product
const sameVendorProduct = await Product.findOne({
  vendorId,
  slug: baseSlug
});

if (sameVendorProduct) {
  return res.status(409).json({
    message: "You already added this product"
  });
}

// ✅ If other vendor already used slug → increment
let slug = baseSlug;
let counter = 1;

while (await Product.findOne({ slug })) {
  slug = `${baseSlug}-${counter++}`;
}

    const productId = new mongoose.Types.ObjectId();


    /* ------------------ Upload main image ------------------ */
   const mainUpload = await uploadBufferToCloudinary(
  mainImageFile.buffer,
  `products/${vendorId}/main`,
  `main-${productId}`
);//changed


    /* ------------------ Parse variants ------------------ */
    let parsedVariants = [];
    if (variants) {
      parsedVariants = JSON.parse(variants);
    }

    /* ------------------ Upload variant images ------------------ */
    
    const allVariantFiles = req.files?.variantImages || [];
let imageCursor = 0;

const finalVariants = [];

for (const v of parsedVariants) {
  const count = Number(v.imageCount || 0);
  const variantImages = [];

  const filesSlice = allVariantFiles.slice(
    imageCursor,
    imageCursor + count
  );

  imageCursor += count;
for (let i = 0; i < filesSlice.length; i++) {
  const file = filesSlice[i];

  const upload = await uploadBufferToCloudinary(
    file.buffer,
    `products/${vendorId}/variants`,
    `variant-${Date.now()}-${i}`
  );

  variantImages.push(upload.secure_url);
}//changed

  finalVariants.push({
    sku: v.sku || "",
    price: v.price ?? null,
    stock: Number(v.stock || 0),
    images: variantImages,     // ✅ WILL NOT BE EMPTY
    attributes: sanitizeAttributes(v.attributes) 
  });
}



    /* ------------------ Create product ------------------ */
    const product = await Product.create({
      _id:productId,
      name: name.trim(),
      slug,
      description,
      vendorId,
      category,
      basePrice: Number(basePrice),
      mainImage: mainUpload.secure_url || mainUpload.url,
      variants: finalVariants,
      isActive: isActive !== "false",
      brand,
      tags: Array.isArray(tags)
        ? tags
        : tags
        ? tags.split(",").map((t) => t.trim())
        : [],
    });

    return res.status(201).json({
      success: true,
      product,
    });
  } catch (err) {
    console.error("createProduct error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const listVendorCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      vendorId: req.vendor.id,
    })
      .sort({ parentCategory: 1, name: 1 });

    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
const createCategoryVendor = async (req, res) => {
  try {
    const vendorId = req.vendor.id;

    const { name, description, parentCategory, isActive } = req.body;

    // 1️⃣ Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const isSubCategory = !!parentCategory;

    // 2️⃣ Validate parent category if child
    if (isSubCategory) {
      if (!mongoose.isValidObjectId(parentCategory)) {
        return res.status(400).json({ message: "Invalid parent category id" });
      }

      const parent = await Category.findOne({
        _id: parentCategory,
        vendorId,
        parentCategory: null, // must be a parent category
      });

      if (!parent) {
        return res.status(404).json({
          message: "Parent category not found or not owned by vendor",
        });
      }
    }

    // 3️⃣ Enforce image rules
    if (isSubCategory && req.file) {
      return res.status(400).json({
        message: "Sub categories cannot have images",
      });
    }

    // 4️⃣ Upload image ONLY for parent category
    let imageUrl = "";
    if (!isSubCategory && req.file) {
      const upload = await uploadBufferToCloudinary(
        req.file.buffer,
        `categories/${vendorId}/${Date.now()}`
      );
      imageUrl = upload.secure_url || upload.url;
    }

    // 5️⃣ Generate slug
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // 6️⃣ Prevent duplicate category per vendor + parent
    const exists = await Category.findOne({
      name: name.trim(),
      vendorId,
      parentCategory: isSubCategory ? parentCategory : null,
    });

    if (exists) {
      return res.status(409).json({
        message: "Category already exists under this parent",
      });
    }

    // 7️⃣ Create category
    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description || "",
      image: imageUrl, // empty for sub-category
      parentCategory: isSubCategory ? parentCategory : null,
      vendorId,
      isActive: isActive !== "false",
    });

    return res.status(201).json({
      success: true,
      category,
    });
  } catch (err) {
    console.error("createCategoryVendor error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const updateCategoryVendor = async (req, res) => {
  try {
    const vendorId = req.vendor.id;
    const { id } = req.params;

    const { name, description, parentCategory, isActive } = req.body;

    // 1️⃣ Validate category id
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    // 2️⃣ Find category (vendor-owned)
    const category = await Category.findOne({ _id: id, vendorId });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const isSubCategory = !!parentCategory;

    // 3️⃣ Validate parent category (if child)
    if (isSubCategory) {
      if (!mongoose.isValidObjectId(parentCategory)) {
        return res.status(400).json({ message: "Invalid parent category id" });
      }

      const parent = await Category.findOne({
        _id: parentCategory,
        vendorId,
        parentCategory: null,
      });

      if (!parent) {
        return res.status(404).json({
          message: "Parent category not found or not owned by vendor",
        });
      }
    }

    // 4️⃣ Enforce image rules
    if (isSubCategory && req.file) {
      return res.status(400).json({
        message: "Sub categories cannot have images",
      });
    }

    // 5️⃣ Upload image ONLY for parent category
    if (!isSubCategory && req.file) {
      const upload = await uploadBufferToCloudinary(
        req.file.buffer,
        `categories/${vendorId}/${Date.now()}`
      );
      category.image = upload.secure_url || upload.url;
    }

    // 6️⃣ Update fields
    if (name && name.trim()) {
      category.name = name.trim();
      category.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    category.description = description || "";
    category.parentCategory = isSubCategory ? parentCategory : null;
    category.isActive = isActive !== "false";

    // 7️⃣ Save
    await category.save();

    return res.json({
      success: true,
      category,
    });
  } catch (err) {
    console.error("updateCategoryVendor error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const toggleVendorCategory = async (req, res) => {
  try {
    const vendorId = req.vendor.id;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    const category = await Category.findOne({
      _id: id,
      vendorId,
    });

    if (!category) {
      return res.status(404).json({
        message: "Category not found or not owned by vendor",
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    return res.json({
      success: true,
      category,
    });
  } catch (err) {
    console.error("toggleVendorCategory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const updateVendorProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const {
      name,
      description,
      basePrice,
      category,
      tags,
      isActive,
      variants,
      brand
    } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let hasChanges = false;

    /* ---------------- BASIC FIELDS ---------------- */

    if (name && name.trim() !== product.name) {
      product.name = name.trim();
      product.slug = slugify(name, { lower: true, strict: true });
      hasChanges = true;
    }

    if (description && description !== product.description) {
      product.description = description;
      hasChanges = true;
    }

    if (basePrice && Number(basePrice) !== product.basePrice) {
      product.basePrice = Number(basePrice);
      hasChanges = true;
    }

    if (category && category.toString() !== product.category.toString()) {
      if (!mongoose.isValidObjectId(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      product.category = category;
      hasChanges = true;
    }

    if (brand && brand.toString() !== product.brand?.toString()) {
      if (!mongoose.isValidObjectId(brand)) {
        return res.status(400).json({ message: "Invalid brand" });
      }
      product.brand = brand;
      hasChanges = true;
    }

    if (typeof isActive !== "undefined") {
      const next = isActive !== "false";
      if (next !== product.isActive) {
        product.isActive = next;
        hasChanges = true;
      }
    }

    if (tags) {
      const nextTags = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim());

      if (JSON.stringify(nextTags) !== JSON.stringify(product.tags)) {
        product.tags = nextTags;
        hasChanges = true;
      }
    }

    /* ---------------- MAIN IMAGE ---------------- */

    if (req.files?.mainImage?.[0]) {
      const upload = await uploadBufferToCloudinary(
        req.files.mainImage[0].buffer,
        `products/${product.vendorId}/main`,
        `main-${product._id}`
      );

      product.mainImage = upload.secure_url;
      hasChanges = true;
    }

    /* ---------------- VARIANTS ---------------- */

    let parsedVariants = [];
    if (variants) parsedVariants = JSON.parse(variants);

    if (parsedVariants.length) {
      const allVariantFiles = req.files?.variantImages || [];
      let imageCursor = 0;
      const finalVariants = [];

      for (let i = 0; i < parsedVariants.length; i++) {
        const v = parsedVariants[i];
        const existingVariant = product.variants[i];

        let images = existingVariant?.images
          ? [...existingVariant.images]
          : [];

        /* REMOVE DELETED IMAGES */
        if (Array.isArray(v.removedImages) && v.removedImages.length) {
          images = images.filter(
            (img) => !v.removedImages.includes(img)
          );
          hasChanges = true;
        }

        /* ADD NEW IMAGES USING imageCount (CREATE-LIKE) */
        const count = Number(v.imageCount || 0);

        const filesSlice = allVariantFiles.slice(
          imageCursor,
          imageCursor + count
        );

        imageCursor += count;

        for (let j = 0; j < filesSlice.length; j++) {
          const file = filesSlice[j];

          const upload = await uploadBufferToCloudinary(
            file.buffer,
            `products/${product.vendorId}/variants`,
            `variant-${Date.now()}-${j}`
          );

          images.push(upload.secure_url);
        }

        finalVariants.push({
          sku: v.sku || "",
          price: v.price ?? null,
          stock: Number(v.stock || 0),
          images: images.slice(0, 4),
          attributes: sanitizeAttributes(v.attributes),
        });
      }

      if (
        JSON.stringify(finalVariants) !==
        JSON.stringify(product.variants)
      ) {
        product.variants = finalVariants;
        hasChanges = true;
      }
    }

    /* ---------------- NOTHING CHANGED ---------------- */

    if (!hasChanges) {
      return res.status(409).json({
        success: false,
        message: "No changes were detected. The product remains unchanged.",
      });
    }

    /* ---------------- SAVE ---------------- */

    await product.save();

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (err) {
    console.error("updateProduct error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const toggleVendorProductStatus=async(req,res)=>{
    try {
      const vendorId=req.vendor.id;
      const{id}=req.params;
      const product= await Product.findOne({
        _id:id,
        vendorId
      })
      if (!product) {
      return res.status(404).json({
        message: "Product not found or not owned by vendor",
      });
    }
     product.isActive = !product.isActive;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product ${product.isActive ? "activated" : "deactivated"}`,
      product,
    });

    } catch (error) {
            console.error("Toggle product error:", error);
    return res.status(500).json({
      message: "Server error",
    });

    }
}

const registerVendor = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      storeName,
      storeDescription,
      businessType,
      panNumber,
      gstNumber,
      addressLine1,
      city,
      state,
      pincode,
      accountHolderName,
      accountNumber,
      ifsc,
      bankName,
      upiId,
      agreements,
    } = req.body;

    /* ---------- BASIC VALIDATION ---------- */
    if (
      !name ||
      !email ||
      !password ||
      !storeName ||
      !businessType ||
      !panNumber
    ) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    /* ---------- DUPLICATE CHECK ---------- */
    const exists = await Vendor.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Vendor already exists" });
    }

    /* ---------- HASH PASSWORD ---------- */
    const hashedPassword = await bcrypt.hash(password, 10);

    /* ---------- AGREEMENTS ---------- */
    const parsedAgreements = JSON.parse(agreements || "{}");

const agreementPayload = {
  sellerAgreement: Boolean(parsedAgreements.sellerAgreement),
  commission: Boolean(parsedAgreements.commission),
  returns: Boolean(parsedAgreements.returns),
  rules: Boolean(parsedAgreements.rules),
  acceptedAt: new Date(),
  acceptedIp: req.ip,
};

// 🔒 Ensure ALL agreements are accepted
if (
  !agreementPayload.sellerAgreement ||
  !agreementPayload.commission ||
  !agreementPayload.returns ||
  !agreementPayload.rules
) {
  return res
    .status(400)
    .json({ message: "All agreements must be accepted" });
}

    /* ---------- KYC UPLOADS ---------- */
    const docs = {};

    if (req.files?.panCard?.[0]) {
      const upload = await uploadBufferToCloudinary(
        req.files.panCard[0].buffer,
        "vendors",
        `pan-${email}`
      );
      docs.panCard = upload.secure_url;
    }

    if (req.files?.idProof?.[0]) {
      const upload = await uploadBufferToCloudinary(
        req.files.idProof[0].buffer,
        "vendors",
        `id-${email}`
      );
      docs.idProof = upload.secure_url;
    }

    if (req.files?.bankProof?.[0]) {
      const upload = await uploadBufferToCloudinary(
        req.files.bankProof[0].buffer,
        "vendors",
        `bank-${email}`
      );
      docs.bankProof = upload.secure_url;
    }

    if (req.files?.gstCertificate?.[0]) {
      const upload = await uploadBufferToCloudinary(
        req.files.gstCertificate[0].buffer,
        "vendors",
        `gst-${email}`
      );
      docs.gstCertificate = upload.secure_url;
    }
    const baseSlug = storeName
  .toLowerCase()
  .trim()
  .replace(/\s+/g, "-")
  .replace(/[^a-z0-9-]/g, "");

let storeSlug = baseSlug;
let count = 1;

while (await Vendor.exists({ storeSlug })) {
  storeSlug = `${baseSlug}-${count++}`;
}


    /* ---------- CREATE VENDOR ---------- */
    const vendor = await Vendor.create({
      name,
      email,
      phone,
      password: hashedPassword,
      storeName,
      storeSlug,
      storeDescription,
      businessType,
      panNumber,
      gstNumber,
      address: {
        line1: addressLine1,
        city,
        state,
        pincode,
      },
      bankDetails: {
        accountHolderName,
        accountNumber,
        ifsc,
        bankName,
        upiId,
      },
      documents: docs,
      agreements: {
        ...parsedAgreements,
        acceptedAt: new Date(),
        acceptedIp: req.ip,
      },
      status: "pending",
      isBlocked: false,
    });

    return res.status(201).json({
      success: true,
      message: "Vendor registration submitted for approval",
      vendorId: vendor._id,
    });
  } catch (err) {
  console.error("Vendor register error:", err);

  // 🔒 Duplicate email
  if (err.code === 11000 && err.keyPattern?.email) {
    return res.status(409).json({
      message: "A seller account with this email already exists",
    });
  }

  return res.status(500).json({
    message: "Unable to register seller. Please try again later.",
  });
}

};

const getVendorDashboard = async (req, res) => {
  try {
    const vendorId = req.vendor.id;

    const orders = await Order.find({
      "items.vendorId": vendorId,
    }).sort({ createdAt: -1 });

    let totalOrders = 0;
    let placed = 0;
    let confirmed = 0;
    let shipped = 0;
    let delivered = 0;
    let revenue = 0;

    const recentOrders = [];

    const deriveStatus = (items) => {
      if (items.every(i => i.status === "DELIVERED")) return "DELIVERED";
      if (items.some(i => i.status === "SHIPPED")) return "SHIPPED";
      if (items.some(i => i.status === "CONFIRMED")) return "CONFIRMED";
      return "PLACED";
    };

    orders.forEach(order => {
      const vendorItems = order.items.filter(
        i => String(i.vendorId) === String(vendorId)
      );

      if (!vendorItems.length) return;

      totalOrders++;

      const orderStatus = deriveStatus(vendorItems);

      if (orderStatus === "DELIVERED") delivered++;
      else if (orderStatus === "SHIPPED") shipped++;
      else if (orderStatus === "CONFIRMED") confirmed++;
      else placed++;

      vendorItems.forEach(i => {
        if (i.status === "DELIVERED") {
          revenue += i.price * i.qty;
        }
      });

      recentOrders.push({
        _id: order._id,
        orderNumber: order.orderNumber,
        items: vendorItems,
        status: orderStatus,
        createdAt: order.createdAt,
      });
    });
    const salesByDate = await Order.aggregate([
  { $unwind: "$items" },
  {
    $match: {
      "items.vendorId": vendorId,
      "items.status": "DELIVERED",
    },
  },
  {
    $group: {
      _id: {
        $dateToString: {
          format: "%Y-%m-%d",
          date: "$createdAt",
        },
      },
      revenue: {
        $sum: { $multiply: ["$items.price", "$items.qty"] },
      },
      orders: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
  { $limit: 30 },
]);


    // 🔥 TOP PRODUCTS (FROM PRODUCT COLLECTION)
    const topProducts = await Product.find({
      vendorId,
      isActive: true,
      soldCount: { $gt: 0 },
    })
      .sort({ soldCount: -1 })
      .limit(3)
      .select("name soldCount basePrice")
      .lean();

    const formattedTopProducts = topProducts.map(p => ({
      _id: p._id,
      name: p.name,
      sold: p.soldCount,
      revenue: p.soldCount * p.basePrice,
    }));

    // 🔥 LOW STOCK
    const lowStockProducts = await Product.find({
      vendorId,
      isActive: true,
      stock: { $lte: 5 },
    }).select("name stock");

    res.json({
      stats: {
        totalOrders,
        placed,
        confirmed,
        shipped,
        delivered,
        revenue,
      },
      recentOrders: recentOrders.slice(0, 5),
      topProducts: formattedTopProducts,
      lowStockProducts,
      salesByDate
    });

  } catch (err) {
    console.error("Vendor dashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
const getVendorOrderById = async (req, res) => {
  const vendorId = req.vendor.id
  const { orderId } = req.params

  const order = await Order.findOne({
    _id: orderId,
    "items.vendorId": vendorId,
  })
    .populate("user", "name email")
    .lean()

  if (!order) {
    return res.status(404).json({ message: "Order not found" })
  }

  // 🔥 keep ONLY vendor items
  order.items = order.items.filter(
    i => String(i.vendorId) === String(vendorId)
  )

  res.json({ order })
}
const getVendorProfile = async (req, res) => {
  const vendor = await Vendor.findById(req.vendor.id).select("-password");
  res.json({ vendor });
};
const updateVendorBank = async (req, res) => {
  const vendor = await Vendor.findByIdAndUpdate(
    req.vendor.id,
    { bankDetails: req.body.bankDetails },
    { new: true }
  ).select("-password");

  res.json({ vendor });
};
const updateVendorProfile = async (req, res) => {
  console.log(req.body)
  const vendor = await Vendor.findByIdAndUpdate(
    req.vendor.id,
    { $set: req.body },
    { new: true }
  ).select("-password");

  res.json({ vendor });
};
const changeVendorPassword = async (req, res) => {
  try {
    const vendorId = req.vendor.id;
    const { oldPassword, newPassword } = req.body;
    console.log(oldPassword,newPassword)
    
    // 1️⃣ Basic validation
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
     
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    // 2️⃣ Get vendor
    const vendor = await Vendor.findById(vendorId).select("+password");
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // 3️⃣ Check old password
    console.log(vendor)
    const isMatch = await bcrypt.compare(oldPassword, vendor.password);
    console.log(isMatch)
    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    // 4️⃣ Prevent same password
    const isSame = await bcrypt.compare(newPassword, vendor.password);
    if (isSame) {
      return res
        .status(400)
        .json({ message: "New password must be different" });
    }

    // 5️⃣ Hash & save new password
    const salt = await bcrypt.genSalt(10);
    vendor.password = await bcrypt.hash(newPassword, salt);
    await vendor.save();

    // 6️⃣ Success
    res.json({
      success: true,
      message: "Password updated successfully",
    });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
};

module.exports={vendorLogin,listVendorProducts,createVendorProduct,createCategoryVendor,listVendorCategories,updateCategoryVendor,toggleVendorCategory,updateVendorProduct,toggleVendorProductStatus,registerVendor,getVendorDashboard,getVendorOrderById,getVendorProfile,
  updateVendorBank,updateVendorProfile,changeVendorPassword
}

