const Category= require("../Models/categoryModel")
const cloudinary= require("../Config/cloudinary")
const streamifier=require("streamifier")
const { uploadBufferToCloudinary} = require("../Utils/cloudinaryHelper"); // see helper below
const slugify=require("slugify")
const mongoose=require("mongoose")
const createCategory = async (req, res) => {
  try {
    const { name, description, parentCategory, isActive } = req.body;

    // 1️⃣ Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const trimmedName = name.trim();
    const isSubCategory = !!parentCategory;

    // 2️⃣ Validate parent category (if sub-category)
    if (isSubCategory) {
      if (!mongoose.isValidObjectId(parentCategory)) {
        return res.status(400).json({ message: "Invalid parent category id" });
      }

      const parent = await Category.findOne({
        _id: parentCategory,
        parentCategory: null, // must be a parent category
      });

      if (!parent) {
        return res.status(404).json({
          message: "Parent category not found",
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
    "categories",
    `category-${Date.now()}`
  );//changed

  imageUrl = upload.secure_url;
}


    // 5️⃣ Generate slug (GLOBAL)
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // 6️⃣ Prevent duplicate category (GLOBAL)
    const exists = await Category.findOne({
      name: { $regex: `^${escapeRegExp(trimmedName)}$`, $options: "i" },
      parentCategory: isSubCategory ? parentCategory : null,
    });

    if (exists) {
      return res.status(409).json({
        message: "Category already exists under this parent",
      });
    }

    // 7️⃣ Create category
    const category = await Category.create({
      name: trimmedName,
      slug,
      description: description || "",
      image: imageUrl, // empty for sub-category
      parentCategory: isSubCategory ? parentCategory : null,
      isActive: isActive !== "false",
    });

    return res.status(201).json({
      success: true,
      category,
    });
  } catch (err) {
    console.error("createCategory error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Server error",
    });
  }
};


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const getCategories = async(req,res)=>{
    try {
        const categories=await Category.find().populate("parentCategory","_id name slug").sort({createdAt:-1}).lean()
        res.json({success:true,categories})
    } catch (error) {
        console.error("getCategories error:",err);
            res.status(500).json({ success: false, message: "Server error" });

    }
}
const getCategoriesUser=async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ priorityOrder:1 })
      .select("_id name image parentCategory slug") 
      .lean();
    return res.json({ success: true, categories });
  } catch (error) {
    console.error("getCategoriesPublic error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
const getShopCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("_id name parentCategory")
      .lean();

    // parents only
    const parents = categories.filter(
      (c) => c.parentCategory === null
    );

    const formatted = parents.map((parent) => ({
      id: parent._id,
      name: parent.name,
      subcategories: categories
        .filter(
          (c) =>
            c.parentCategory &&
            c.parentCategory.toString() === parent._id.toString()
        )
        .map((child) => ({
          id: child._id,
          name: child.name,
        })),
    }));

    res.json({
      success: true,
      categories: formatted,
    });
  } catch (err) {
    console.error("getShopCategories error:", err);
    res.status(500).json({ success: false });
  }
};

const toggleCategory=async (req,res)=>{
    try {
        const {id}=req.params;
        const cat= await Category.findById(id)
        if(!cat){
            return res.status(404).json({success:false,message:"Category not Found"})
        }
        cat.isActive=!cat.isActive
        await cat.save()
        return res.json({success : true , category:cat})
    } catch (error) {
        console.error("Toggle error",err)
        return res.status(500).json({success:false,message:"Server Error"})
    }
}

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentCategory, isActive } = req.body;

    // 1️⃣ Validate category id
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    // 2️⃣ Find category (GLOBAL, admin-owned)
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const isSubCategory = !!parentCategory;

    // 3️⃣ Validate parent category (if sub-category)
    if (isSubCategory) {
      if (!mongoose.isValidObjectId(parentCategory)) {
        return res.status(400).json({ message: "Invalid parent category id" });
      }

      const parent = await Category.findOne({
        _id: parentCategory,
        parentCategory: null, // must be a parent category
      });

      if (!parent) {
        return res.status(404).json({
          message: "Parent category not found",
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
    "categories",
    `category-${Date.now()}`
  );

  category.image = upload.secure_url;
}


    // 6️⃣ Update name & slug (with duplicate check)
    if (name && name.trim()) {
      const trimmedName = name.trim();

      const exists = await Category.findOne({
        name: { $regex: `^${escapeRegExp(trimmedName)}$`, $options: "i" },
        parentCategory: isSubCategory ? parentCategory : null,
        _id: { $ne: id },
      });

      if (exists) {
        return res.status(409).json({
          message: "Category already exists under this parent",
        });
      }

      category.name = trimmedName;
      category.slug = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    // 7️⃣ Update remaining fields
    category.description = description || "";
    category.parentCategory = isSubCategory ? parentCategory : null;
    category.isActive = isActive !== "false";

    // 8️⃣ Save
    await category.save();

    return res.json({
      success: true,
      category,
    });
  } catch (err) {
    console.error("updateCategory error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Server error",
    });
  }
};

module.exports={createCategory,getCategories,toggleCategory,updateCategory,getCategoriesUser,getShopCategories}