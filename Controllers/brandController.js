const Brand = require("../Models/brandModel");
const slugify = require("slugify");
const BrandRequest=require("../Models/brandRequestModel")
const {uploadBufferToCloudinary}=require("../Utils/cloudinaryHelper")
const sendEmail=require("../Config/nodeMailer")
const {
    getBrandApprovedEmailHtml,getBrandRejectedEmailHtml
}
=require("../Utils/emailContentProvider")
const createBrand = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Brand name is required",
      });
    }

    const existing = await Brand.findOne({
      name: new RegExp(`^${name}$`, "i"),
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Brand already exists",
      });
    }

    let logo = "";

    // 🔥 UPLOAD TO CLOUDINARY
    if (req.file) {
     const result = await uploadBufferToCloudinary(
  req.file.buffer,
  "chip/brands",
  slugify(name, { lower: true })
);

      logo = result.secure_url;
    }

    const brand = await Brand.create({
      name: name.trim(),
      slug: slugify(name, { lower: true }),
      description: description || "",
      logo, // ✅ Cloudinary URL
      isApproved: true,
      isActive: true,
      createdBy: req.adminId || null,
    });

    return res.status(201).json({
      success: true,
      brand,
    });
  } catch (err) {
    console.error("createBrand error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getBrandRequests = async (req, res) => {
  try {
    const requests = await BrandRequest.find()
      .populate("vendorId", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      requests,
    });
  } catch (err) {
    console.error("getBrandRequests error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const approveBrandRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const request = await BrandRequest.findById(id).populate("vendorId","name email");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Brand request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Request already processed",
      });
    }

    // Prevent duplicate brands
    const existingBrand = await Brand.findOne({
      name: new RegExp(`^${request.brandName}$`, "i"),
    });

    if (existingBrand) {
      return res.status(409).json({
        success: false,
        message: "Brand already exists",
      });
    }

    const brand = await Brand.create({
      name: request.brandName,
      slug: slugify(request.brandName, { lower: true }),
      description: request.description,
      logo: request.logo || "",
      isApproved: true,
      isActive: true,
    });

    request.status = "approved";
    await request.save();


    if (request.vendorId?.email) {
      await sendEmail(
        request.vendorId.email,
        "Your brand has been approved 🎉",
        getBrandApprovedEmailHtml({
          name: request.vendorId.name,
          brandName: request.brandName,
        })
      );
    }

    res.json({
      success: true,
      message: "Brand approved",
      brand,
    });
  } catch (err) {
    console.error("approveBrandRequest error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const rejectBrandRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    const request = await BrandRequest.findById(id)
      .populate("vendorId", "email name");

    if (!request) {
      return res.status(404).json({ success: false, message: "Brand request not found" });
    }

    // 🗑 SECOND REJECTION → DELETE
    if (request.status === "rejected") {
      await BrandRequest.findByIdAndDelete(id);
      return res.json({
        success: true,
        message: "Rejected request deleted",
      });
    }

    // ❌ Cannot reject approved
    if (request.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Approved request cannot be rejected",
      });
    }

    // ❌ FIRST REJECTION
    request.status = "rejected";
    request.adminNote = adminNote || "";
    await request.save();

    // 📧 SEND REJECTION EMAIL
  
    if (request.vendorId?.email) {
      await sendEmail(
        request.vendorId.email,
        "Brand request rejected",
        getBrandRejectedEmailHtml({
          name: request.vendorId.name,
          brandName: request.brandName,
          adminNote,
        })
      );
    }

    res.json({ success: true, message: "Brand request rejected" });
  } catch (err) {
    console.error("rejectBrandRequest error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ isApproved: true })
      .select("name slug logo isActive")
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      brands,
    });
  } catch (err) {
    console.error("getBrands error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const getBrandsVendor = async (req, res) => {
  try {
    const brands = await Brand.find({ isApproved: true })
      .select("name slug logo isActive")
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      brands,
    });
  } catch (err) {
    console.error("getBrands error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const vendorRequestBrand = async (req, res) => {
  try {
    const { brandName, description } = req.body;

    if (!brandName) {
      return res.status(400).json({
        success: false,
        message: "Brand name is required",
      });
    }

    let logo = "";

    if (req.file) {
      const upload = await uploadBufferToCloudinary(
        req.file.buffer,
        "chip/brands/requests"
      );
      logo = upload.secure_url;
    }
    const vendor=req.vendor.id
    const request = await BrandRequest.create({
      brandName,
      description,
      logo,
      vendorId: vendor,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      request,
    });
  } catch (err) {
    console.error("vendorRequestBrand error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports={rejectBrandRequest,approveBrandRequest,getBrandRequests,createBrand,getBrands,getBrandsVendor,vendorRequestBrand}