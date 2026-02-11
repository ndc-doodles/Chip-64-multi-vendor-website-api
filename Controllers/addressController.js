const Address=require("../Models/addressModel")

const createAddress = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    if (!fullName || !phone || !line1 || !city || !state || !postalCode) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // If new address is default → unset old default
    if (isDefault) {
      await Address.updateMany(
        { user: req.user.id },
        { isDefault: false }
      );
    }

    const address = await Address.create({
      user: req.user.id,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country: country || "India",
      isDefault: !!isDefault,
    });

    res.status(201).json({
      success: true,
      message: "Address added",
      address,
    });
  } catch (err) {
    console.error("createAddress error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const getMyAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.id })
      .sort({ isDefault: -1, createdAt: -1 });

    res.json({
      success: true,
      addresses,
    });
  } catch (err) {
    console.error("getMyAddresses error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (req.body.isDefault) {
      await Address.updateMany(
        { user: req.user.id },
        { isDefault: false }
      );
    }

    Object.assign(address, req.body);
    await address.save();

    res.json({
      success: true,
      message: "Address updated",
      address,
    });
  } catch (err) {
    console.error("updateAddress error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}; 
const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOneAndDelete({
      _id: id,
      user: req.user.id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    res.json({
      success: true,
      message: "Address deleted",
    });
  } catch (err) {
    console.error("deleteAddress error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await Address.updateMany(
      { user: req.user.id },
      { isDefault: false }
    );

    address.isDefault = true;
    await address.save();

    res.json({
      success: true,
      message: "Default address set",
    });
  } catch (err) {
    console.error("setDefaultAddress error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
module.exports={updateAddress,deleteAddress,getMyAddresses,setDefaultAddress,createAddress}