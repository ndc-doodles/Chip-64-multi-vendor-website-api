
const COMMISSION_SLABS = [
  {
    minPrice: 0,
    maxPrice: 99,
    flatCommission: 5, 
    isActive: true,
  },
  {
    minPrice: 100,
    maxPrice: 299,
    flatCommission: 15,
    isActive: true,
  },
  {
    minPrice: 300,
    maxPrice: 999,
    flatCommission: 30,
    isActive: true,
  },
  {
    minPrice: 1000,
    maxPrice: 9999,
    flatCommission: 60,
    isActive: true,
  },
  {
    minPrice: 10000,
    maxPrice: Infinity,
    flatCommission: 100,
    isActive: true,
  },
];

module.exports = {
  COMMISSION_SLABS,
};
