const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ---------------- BANK DETAILS ---------------- */
const vendorBankSchema = new Schema(
  {
    accountHolderName: String,
    accountNumber: String,
    ifsc: String,
    bankName: String,
    upiId: String,
  },
  { _id: false }
);

/* ---------------- KYC DOCUMENTS ---------------- */
const vendorDocumentsSchema = new Schema(
  {
    panCard: { type: String, required: true },       // file URL
    idProof: { type: String, required: true },       // Aadhaar / DL / Passport
    bankProof: { type: String, required: true },     // cancelled cheque / passbook
    gstCertificate: { type: String },                // optional
  },
  { _id: false }
);

/* ---------------- ADDRESS ---------------- */
const addressSchema = new Schema(
  {
    line1: String,
    city: String,
    state: String,
    pincode: String,
  },
  { _id: false }
);

/* ---------------- AGREEMENTS ---------------- */
const agreementSchema = new Schema(
  {
    sellerAgreementAccepted: Boolean,
    commissionAccepted: Boolean,
    returnPolicyAccepted: Boolean,
    platformRulesAccepted: Boolean,
    acceptedAt: Date,
    acceptedIp: String,
  },
  { _id: false }
);

/* ---------------- MAIN VENDOR SCHEMA ---------------- */
const vendorSchema = new Schema(
  {
    /* BASIC INFO */
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      default: "vendor", // frontend can call this Seller
    },

    /* AUTH */
    password: {
      type: String,
      required: true,
      select: false,
    },

    /* STORE INFO */
    storeName: {
      type: String,
      required: true,
    },

    storeSlug: {
      type: String,
      unique: true,
      index: true,
    },

    storeDescription: String,
    storeLogo: String,

    /* BUSINESS INFO */
    businessType: {
      type: String,
      enum: ["individual", "proprietorship", "llp", "pvt_ltd"],
      required: true,
    },

    panNumber: {
      type: String,
      required: true,
    },

    gstNumber: {
      type: String,
    },

    address: addressSchema,

    /* KYC */
    documents: vendorDocumentsSchema,

    /* BANK */
    bankDetails: vendorBankSchema,

  

    /* WALLET */
    walletBalance: {
      type: Number,
      default: 0,
    },

    /* STATUS CONTROL */
    status: {
      type: String,
      enum: ["pending", "verified", "rejected", "suspended"],
      default: "pending",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
    rejectionReason: {
  type: String,
  default: null,
},

    agreements: agreementSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
