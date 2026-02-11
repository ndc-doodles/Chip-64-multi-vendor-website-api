const CommissionSlab = require("../Models/commissionSlabModel");

const getCommissionForPrice = async (price) => {
  const slab = await CommissionSlab.findOne({
    isActive: true,
    minPrice: { $lte: price },
    maxPrice: { $gte: price },
  });

  return slab ? slab.flatCommission : 0;
};

module.exports = { getCommissionForPrice };