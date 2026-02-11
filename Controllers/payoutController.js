const Order=require("../Models/orderModel")
const Payout=require("../Models/payoutModel")
const Vendor= require("../Models/vendorModel")
const PayoutRequest=require("../Models/payoutrequestModel")

const settleVendorPayout = async (req, res) => {
  const { vendorId, referenceId, method, note } = req.body;

  if (!vendorId || !method) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // 1️⃣ Fetch vendor
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    return res.status(404).json({ message: "Vendor not found" });
  }

  // 2️⃣ Find unpaid order items
  const orders = await Order.find({
    paymentStatus: "PAID",
    "items.vendorId": vendorId,
    "items.isSettled": false,
  });

  if (!orders.length) {
    return res.status(400).json({ message: "No pending payouts" });
  }

  let totalPaid = 0;
  let settledItemCount = 0;
  const settledOrderIds = new Set();

  // 3️⃣ Mark items as settled
  for (const order of orders) {
    let orderTouched = false;

    order.items.forEach(item => {
      if (
        item.vendorId.toString() === vendorId &&
        item.isSettled === false
      ) {
        item.isSettled = true;
        item.settledAt = new Date();

        totalPaid += item.vendorEarning;
        settledItemCount++;
        orderTouched = true;
      }
    });

    if (orderTouched) {
      settledOrderIds.add(order._id.toString());
      await order.save();
    }
  }

  // 4️⃣ Wallet safety check
  if (vendor.walletBalance < totalPaid) {
    return res.status(400).json({
      message: "Insufficient vendor wallet balance",
    });
  }

  // 5️⃣ Deduct vendor wallet
  vendor.walletBalance -= totalPaid;
  await vendor.save();

  // 6️⃣ Create payout ledger
  const payout = await Payout.create({
    vendorId,
    orders: Array.from(settledOrderIds),
    amount: totalPaid,
    method,
    referenceId: referenceId || null,
    note: note || null,
    processedBy: req.user.id,
    status: "COMPLETED",
  });

  res.json({
    success: true,
    payoutId: payout._id,
    totalPaid,
    settledItems: settledItemCount,
    remainingWalletBalance: vendor.walletBalance,
  });
};

const getVendorPayouts = async (req, res) => {
  const orders = await Order.find({ paymentStatus: "PAID" })
    .populate("items.vendorId", "storeName email");

  const map = {};

  orders.forEach(order => {
    order.items.forEach(item => {
      const vendor = item.vendorId;
      if (!vendor) return;

      const vid = vendor._id.toString();

      if (!map[vid]) {
        map[vid] = {
          vendorId: vid,
          name: vendor.storeName,   // ✅ ADD
          email: vendor.email,      // ✅ ADD
          delivered: 0,
          commission: 0,
          payable: 0,
          paid: 0,
          pending: 0,
        };
      }

      map[vid].delivered += item.price * item.qty;
      map[vid].commission += item.totalCommission;
      map[vid].payable += item.vendorEarning;

      if (item.isSettled) {
        map[vid].paid += item.vendorEarning;
      } else {
        map[vid].pending += item.vendorEarning;
      }
    });
  });

  res.json(Object.values(map));
};
const getPayoutHistory = async (req, res) => {
  const payouts = await Payout.find()
    .populate("vendorId", "storeName email")
    .sort({ createdAt: -1 });

  const formatted = payouts.map(p => ({
    id: p._id,
    vendor: {
      name: p.vendorId.storeName,
      email: p.vendorId.email,
    },
    gross: p.amount,               // already net actually
    commission: null,              // optional (can calculate later)
    net: p.amount,
    method: p.method,
    date: p.createdAt,
    status: p.status,
    refId: p.referenceId || "N/A",
  }));

  res.json(formatted);
};


const getVendorWallet = async (req, res) => {
  try {
    const vendorId = req.vendor.id;
    console.log(vendorId)

    // 1️⃣ Fetch vendor wallet
    const vendor = await Vendor.findById(vendorId).select("walletBalance");
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // 2️⃣ Total earned from PAID orders
    const orders = await Order.find({
      paymentStatus: "PAID",
      "items.vendorId": vendorId,
    });

    let totalEarned = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.vendorId.toString() === vendorId) {
          totalEarned += item.vendorEarning;
        }
      });
    });

    // 3️⃣ Total paid from payouts
    const payouts = await Payout.find({
      vendorId,
      status: "COMPLETED",
    });

    const totalPaid = payouts.reduce(
      (sum, p) => sum + p.amount,
      0
    );
    console.log(vendor.walletBalance)

    // 4️⃣ Response
    res.json({
      balance: vendor.walletBalance,     // ✅ SOURCE OF TRUTH
      totalEarned,                        // analytics
      totalPaid,                          // payouts done
      pendingAmount: vendor.walletBalance
    });

  } catch (err) {
    console.error("Vendor wallet error:", err);
    res.status(500).json({ message: "Failed to load wallet" });
  }
};

const getVendorWalletLedger = async (req, res) => {
  try {
    const vendorId = req.vendor.id;

    // 1️⃣ Check vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const ledger = [];

    // 2️⃣ COMMISSION ENTRIES (credits)
    const orders = await Order.find({
      paymentStatus: "PAID",
      "items.vendorId": vendorId,
    }).sort({ createdAt: 1 });

    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.vendorId.toString() === vendorId) {
          ledger.push({
            type: "COMMISSION",
            reference: order.orderNumber,
            amount: item.vendorEarning,   // ✅ credit
            createdAt: order.createdAt,
          });
        }
      });
    });

    // 3️⃣ PAYOUT ENTRIES (debits)
    const payouts = await Payout.find({
      vendorId,
      status: "COMPLETED",
    }).sort({ createdAt: 1 });

    payouts.forEach(payout => {
      ledger.push({
        type: "PAYOUT",
        reference: payout.referenceId || payout._id.toString(),
        amount: -payout.amount,          // ✅ debit
        createdAt: payout.createdAt,
      });
    });

    // 4️⃣ Sort by date
    ledger.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    // 5️⃣ Running balance (derived)
    let runningBalance = 0;
    const ledgerWithBalance = ledger.map(entry => {
      runningBalance += entry.amount;
      return {
        ...entry,
        balanceAfter: runningBalance,
      };
    });

    // 6️⃣ Latest first
    res.json(ledgerWithBalance.reverse());

  } catch (err) {
    console.error("Vendor wallet ledger error:", err);
    res.status(500).json({ message: "Failed to load wallet ledger" });
  }
};


const requestPayout = async (req, res) => {
  const vendorId = req.vendor.id;

  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    return res.status(404).json({ message: "Vendor not found" });
  }

  if (vendor.walletBalance <= 0) {
    return res.status(400).json({ message: "No balance available" });
  }

  // prevent duplicate pending requests
  const existing = await PayoutRequest.findOne({
    vendorId,
    status: "PENDING",
  });

  if (existing) {
    return res.status(400).json({
      message: "You already have a pending payout request",
    });
  }

  const request = await PayoutRequest.create({
    vendorId,
    amount: vendor.walletBalance,
  });

  res.json({
    success: true,
    requestId: request._id,
    amount: request.amount,
  });
};
const approvePayoutRequest = async (req, res) => {
  const { requestId } = req.params;
  const { method, referenceId, note } = req.body;

  const request = await PayoutRequest.findById(requestId);
  if (!request || request.status !== "PENDING") {
    return res.status(400).json({ message: "Invalid payout request" });
  }

  // 👇 REUSE EXISTING LOGIC
  req.body.vendorId = request.vendorId;
  req.body.note = note || "Payout via request";

  await settleVendorPayout(req, res);

  // 👇 ONLY STATUS UPDATE
  request.status = "APPROVED";
  request.processedBy = req.user.id;
  request.processedAt = new Date();
  await request.save();
};
const getPayoutRequests = async (req, res) => {
  try {
    const { status } = req.query; // optional filter

    const filter = {};
    if (status) {
      filter.status = status.toUpperCase();
    }

    const requests = await PayoutRequest.find(filter)
      .populate("vendorId", "storeName email walletBalance")
      .sort({ createdAt: -1 });

    const formatted = requests.map(r => ({
      requestId: r._id,
      vendor: {
        id: r.vendorId._id,
        name: r.vendorId.storeName,
        email: r.vendorId.email,
        walletBalance: r.vendorId.walletBalance,
      },
      amount: r.amount,
      status: r.status,
      requestedAt: r.createdAt,
      processedAt: r.processedAt || null,
    }));

    res.json(formatted);

  } catch (err) {
    console.error("Admin payout request fetch error:", err);
    res.status(500).json({ message: "Failed to load payout requests" });
  }
};



module.exports={getVendorPayouts,settleVendorPayout,getPayoutHistory
  ,getVendorWallet,getVendorWalletLedger,requestPayout,getPayoutRequests
  ,approvePayoutRequest
}