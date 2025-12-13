const Category= require("../Models/categoryModel")
const cloudinary= require("../Config/cloudinary")
const streamifier=require("streamifier")
const { uploadBufferToCloudinary} = require("../Utils/cloudinaryHelper"); // see helper below


const createCategory = async (req, res) => {
  try {
    const nameRaw = req.body.name || "";
    const name = nameRaw.trim();
    const description = req.body.description || "";

    console.log("name and description:", JSON.stringify({ nameRaw, name, description }));

    if (!name) {
      return res.status(400).json({ message: "Category name is not provided" });
    }

    // case-insensitive exact match (safer)
    const existing = await Category.findOne({
      name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" }
    });

    console.log("findOne returned:", existing);
    if (existing) {
      return res.status(400).json({ message: "Category already exists" });
    }

    let imageUrl = "";
    console.log("RELOADED cloudinary require -> typeof:", typeof cloudinary);
console.log("cloudinary keys:", cloudinary && Object.keys(cloudinary).slice(0,20));
console.log("cloudinary.uploader:", cloudinary && cloudinary.uploader);
    if (req.file && req.file.buffer) {
      const publicIdSafe = name.toLowerCase().replace(/[^a-z0-9\-]/g, "-").substring(0, 200);
      // make sure uploadBufferToCloudinary returns a promise and we await it
      const result = await uploadBufferToCloudinary(req.file.buffer, publicIdSafe);
      imageUrl = result?.secure_url || result?.url || "";
    }

    const category = await Category.create({
      name,
      description,
      image: imageUrl,
      isActive: true,
    });

    return res.status(201).json({ success: true, category });
  } catch (err) {
    console.error("createCategory error:", err);
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate key — category exists" });
    }
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const getCategories = async(req,res)=>{
    try {
        const categories=await Category.find().sort({createdAt:-1}).lean()
        res.json({success:true,categories})
    } catch (error) {
        console.error("getCategories error:",err);
            res.status(500).json({ success: false, message: "Server error" });

    }
}
const getCategoriesUser=async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select("_id name image") // only what public UI needs
      .lean();
    return res.json({ success: true, categories });
  } catch (error) {
    console.error("getCategoriesPublic error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
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
    if (!id) return res.status(400).json({ success: false, message: "Category id required" });

    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    // normalize fields
    const nameRaw = req.body.name;
    if (typeof nameRaw === "string") {
      const name = nameRaw.trim();
      if (!name) return res.status(400).json({ success: false, message: "Name cannot be empty" });

      // check duplicates excluding current doc (case-insensitive exact)
      const dup = await Category.findOne({
        name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
        _id: { $ne: id },
      });

      if (dup) return res.status(400).json({ success: false, message: "Another category with this name exists" });

      category.name = name;
    }

    if (typeof req.body.description === "string") {
      category.description = req.body.description;
    }

    if (typeof req.body.isActive !== "undefined") {
      // allow string "true"/"false" etc.
      const val = req.body.isActive;
      category.isActive = val === "true" || val === true ? true : val === "false" || val === false ? false : category.isActive;
    }

    // If new file provided, upload and replace image URL
    if (req.file && req.file.buffer) {
      const publicIdSafe = (category.name || "category").toLowerCase().replace(/[^a-z0-9\-]/g, "-").substring(0, 200);
      const result = await uploadBufferToCloudinary(req.file.buffer, publicIdSafe);
      const imageUrl = result?.secure_url || result?.url || "";
      // OPTIONAL: delete old Cloudinary public_id if you store it separately
      // e.g. if you saved public_id in model, call cloudinary.uploader.destroy(oldPublicId)
      category.image = imageUrl;
    }

    await category.save();
    return res.json({ success: true, category });
  } catch (err) {
    console.error("updateCategory error:", err);
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate key — category exists" });
    }
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
};

module.exports={createCategory,getCategories,toggleCategory,updateCategory,getCategoriesUser}