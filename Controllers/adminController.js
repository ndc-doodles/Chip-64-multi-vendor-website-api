const bcrypt = require("bcrypt");
const User = require("../Models/userModel");
const sendTokens = require("../Utils/sendTokens");
const Order=require("../Models/orderModel")
const Payout=require("../Models/payoutModel")
const Vendor=require("../Models/vendorModel")
const mongoose = require("mongoose");

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;


    const user = await User.findOne({ email }).select("+password");
      console.log(user)
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied - not admin" });
    }

    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return sendTokens(user, res);
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("-password") // extra safety
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      users,
    })
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    })
  }
}
const blockUser = async (req, res) => {
  try {
    const { id } = req.params

    const user = await User.findByIdAndUpdate(
      id,
      { isBlocked: true },
      { new: true }
    )

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }
    res.status(200).json({
      success: true,
      message: "User blocked successfully",
      user,
    })
  } catch (error) {
    console.error("Block user error:", error)
    res.status(500).json({ message: "Server error" })
  }
}
const unblockUser = async (req, res) => {
  try {
    const { id } = req.params

    const user = await User.findByIdAndUpdate(
      id,
      { isBlocked: false },
      { new: true }
    )

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.status(200).json({
      success: true,
      message: "User unblocked successfully",
      user,
    })
  } catch (error) {
    console.error("Unblock user error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

/* ---------------- GET ALL VENDORS ---------------- */
const getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find()
      .select("name email phone isBlocked status createdAt")
      .sort({ createdAt: -1 });

    res.json({ success: true, vendors });
  } catch (err) {
    console.error("Get vendors error:", err);
    res.status(500).json({ message: "Failed to fetch vendors" });
  }
};

/* ---------------- GET VENDOR BY ID ---------------- */
const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid vendor ID" });
    }

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json({ success: true, vendor });
  } catch (err) {
    console.error("Get vendor error:", err);
    res.status(500).json({ message: "Failed to fetch vendor" });
  }
};

/* ---------------- BLOCK VENDOR ---------------- */
const blockVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true ,
         status: "suspended"
      },
      
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json({ success: true, message: "Vendor blocked" });
  } catch (err) {
    res.status(500).json({ message: "Failed to block vendor" });
  }
};

/* ---------------- UNBLOCK VENDOR ---------------- */
const unblockVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false,
         status: "verified"
       },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json({ success: true, message: "Vendor unblocked" });
  } catch (err) {
    res.status(500).json({ message: "Failed to unblock vendor" });
  }
};
const approveVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        status: "verified",
        isBlocked: false,
      },
      { new: true }
    );

    res.json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ message: "Approve failed" });
  }
};

// REJECT
const rejectVendor = async (req, res) => {
  try {
  

    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Rejection reason required" });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        rejectionReason: reason,
        isBlocked: true,
      },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json({ success: true, vendor });
  } catch (err) {
    console.error("FULL ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
const getWalletLedger = async (req, res) => {
  try {
    const ledger = [];

    // 1️⃣ Commission entries from orders
    const orders = await Order.find({
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    }).sort({ createdAt: 1 });

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.totalCommission > 0) {
          ledger.push({
            type: "COMMISSION",
            reference: order.orderNumber,
            amount: item.totalCommission, // ✅ always positive
            createdAt: order.createdAt,
          });
        }
      });
    });

    // 2️⃣ Calculate running balance
    let balance = 0;
    const ledgerWithBalance = ledger.map((entry) => {
      balance += entry.amount;
      return {
        ...entry,
        balanceAfter: balance,
      };
    });

    // latest first
    res.json(ledgerWithBalance.reverse());
  } catch (err) {
    console.error("Wallet ledger error:", err);
    res.status(500).json({ message: "Failed to load wallet ledger" });
  }
};

const getAdminWallet = async (req, res) => {
  try {
    // 1️⃣ Aggregate commissions & pending vendor earnings
    const orderAgg = await Order.aggregate([
      { $unwind: "$items" },
      {
        $match: {
          paymentStatus: "PAID",
          orderStatus: "CONFIRMED",
        },
      },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: "$items.totalCommission" },
          pendingVendorLiability: {
            $sum: {
              $cond: [
                { $eq: ["$items.isSettled", false] },
                "$items.vendorEarning",
                0,
              ],
            },
          },
        },
      },
    ]);

    // 2️⃣ Total paid to vendors
    const payoutAgg = await Payout.aggregate([
      { $match: { status: "COMPLETED" } },
      {
        $group: {
          _id: null,
          totalPaidToVendors: { $sum: "$amount" },
        },
      },
    ]);

    const totalCommission = orderAgg[0]?.totalCommission || 0;
    const pendingVendorLiability =
      orderAgg[0]?.pendingVendorLiability || 0;
    const totalPaidToVendors =
      payoutAgg[0]?.totalPaidToVendors || 0;

    // 3️⃣ Platform balance
    const balance = totalCommission ;

    res.json({
      balance,
      totalCommission,
      totalPaidToVendors,
      pendingVendorLiability,
    });
  } catch (err) {
    console.error("Admin wallet error:", err);
    res.status(500).json({ message: "Failed to load admin wallet" });
  }
};

// ===============================
// ADMIN DASHBOARD OVERVIEW
// ===============================
const getDashboardOverview = async (req, res) => {
  try {
    const { range = "daily" } = req.query;

    /* =====================================================
       1️⃣ COUNTS (parallel — fastest)
    ===================================================== */
    const [
      totalUsers,
      totalVendors,
      pendingVendors,
      totalOrders,
    ] = await Promise.all([
      User.countDocuments({ role: "user", isDeleted: false }),
      Vendor.countDocuments({ status: "verified" }),
      Vendor.countDocuments({ status: "pending" }),
      Order.countDocuments(),
    ]);



    /* =====================================================
       2️⃣ SALES + COMMISSION (parallel aggregations)
    ===================================================== */
    const [salesAgg, commissionAgg] = await Promise.all([

      // TOTAL SALES
      Order.aggregate([
        { $match: { paymentStatus: "PAID" } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$totalAmount" },
          },
        },
      ]),

      // TOTAL COMMISSION (items array)
      Order.aggregate([
        { $match: { paymentStatus: "PAID" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: "$items.totalCommission" },
          },
        },
      ]),
    ]);

    const totalSales = salesAgg[0]?.totalSales || 0;
    const totalCommission = commissionAgg[0]?.totalCommission || 0;



    /* =====================================================
       3️⃣ DATE-BASED REVENUE CHART (FRONTEND FRIENDLY)
    ===================================================== */

    const groupBy =
      range === "monthly"
        ? { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
        : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };

    const revenueChart = await Order.aggregate([
      { $match: { paymentStatus: "PAID" } },

      {
        $group: {
          _id: groupBy,
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },

      { $sort: { _id: 1 } },

      {
        $project: {
          _id: 0,
          date: "$_id",
          revenue: 1,
          orders: 1,
        },
      },
    ]);



    /* =====================================================
       4️⃣ RECENT ORDERS
    ===================================================== */
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("user", "name email")
      .select("orderNumber totalAmount paymentStatus createdAt");



    /* =====================================================
       5️⃣ RECENT VENDOR REQUESTS
    ===================================================== */
    const recentVendors = await Vendor.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("storeName email phone createdAt");



    /* =====================================================
       RESPONSE
    ===================================================== */
    res.json({
      success: true,

      stats: {
        totalSales,
        totalCommission,
        totalOrders,
        totalUsers,
        totalVendors,
        pendingVendors,
      },

      revenueChart,
      recentOrders,
      recentVendors,
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard overview",
    });
  }
};



module.exports = { adminLogin,unblockUser,blockUser,getUsers,getAllVendors,blockVendor,unblockVendor,getVendorById,approveVendor,rejectVendor
  ,getAdminWallet,getWalletLedger,getDashboardOverview};
