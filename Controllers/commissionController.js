const CommissionSlab=require("../Models/commissionSlabModel")

const getCommissionSlabs = async (req, res) => {
  const slabs = await CommissionSlab.find().sort({ minPrice: 1 });
  res.json({ slabs });
};

const createCommissionSlab = async (req, res) => {
  let { minPrice, maxPrice, flatCommission } = req.body;
  console.log(req.body)
   minPrice = Number(minPrice);
  maxPrice = Number(maxPrice);
  flatCommission = Number(flatCommission);

  if (minPrice >= maxPrice) {
    return res.status(400).json({ message: "Invalid price range" });
  }

  const overlap = await CommissionSlab.findOne({
    isActive: true,
    $or: [
      { minPrice: { $lte: maxPrice }, maxPrice: { $gte: minPrice } },
    ],
  });

  if (overlap) {
    return res
      .status(400)
      .json({ message: "Commission slab range overlaps existing slab" });
  }

  const slab = await CommissionSlab.create({
    minPrice,
    maxPrice,
    flatCommission,
  });

  res.json({ success: true, slab });
};

const updateCommissionSlab = async (req, res) => {
  const { id } = req.params;
  const { minPrice, maxPrice, flatCommission, isActive } = req.body;

  const slab = await CommissionSlab.findById(id);
  if (!slab) {
    return res.status(404).json({ message: "Slab not found" });
  }

  slab.minPrice = minPrice ?? slab.minPrice;
  slab.maxPrice = maxPrice ?? slab.maxPrice;
  slab.flatCommission = flatCommission ?? slab.flatCommission;
  slab.isActive = isActive ?? slab.isActive;

  await slab.save();

  res.json({ success: true, slab });
};

const toggleCommissionSlab = async (req, res) => {
  const { id } = req.params;

  const slab = await CommissionSlab.findById(id);
  if (!slab) {
    return res.status(404).json({ message: "Slab not found" });
  }

  slab.isActive = !slab.isActive;
  await slab.save();

  res.json({ success: true, isActive: slab.isActive });
};

module.exports={toggleCommissionSlab,updateCommissionSlab,createCommissionSlab,getCommissionSlabs}