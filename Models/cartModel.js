const mongoose= require("mongoose")
const {Schema}=mongoose

const cartItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    
  vendorId: {
    type: Schema.Types.ObjectId,
    ref: "Vendor",
    required: true,
  },
  variantId: {
  type: Schema.Types.ObjectId,
  required: true
},

    // snapshots
    name: { type: String, required: true },
    slug: { type: String },

    sku: { type: String, default: "" }, 

    image: { type: String, default: "" },

    qty: { type: Number, required: true, min: 1, default: 1 },

    price: { type: Number, required: true },

    attributes: {
      type: Map,
      of: String,
      default: {},
    },

    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const cartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true, required: false },
    sessionId: { type: String, index: true, required: false },

    items: { type: [cartItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },

    // optional flags
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

cartSchema.methods.recalculate = function () {
  this.subtotal = (this.items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  return this.subtotal;
};
function normalizeAttributes(attrs = {}) {
  return Object.keys(attrs)
    .sort()
    .reduce((acc, k) => {
      acc[k] = attrs[k];
      return acc;
    }, {});
}
cartSchema.methods.addItem = async function (itemSnapshot) {
  if (
    !itemSnapshot ||
    !itemSnapshot.productId ||
    !itemSnapshot.vendorId ||
    typeof itemSnapshot.price === "undefined"
  ) {
    throw new Error("Invalid item snapshot");
  }

  const productId = String(itemSnapshot.productId);
  const vendorId = String(itemSnapshot.vendorId);
  const attrs = itemSnapshot.attributes || {};
  const variantId = String(itemSnapshot.variantId);


 const existingIndex = this.items.findIndex(it =>
  String(it.productId) === productId &&
  String(it.variantId) === variantId
);

  if (existingIndex >= 0) {
    const line = this.items[existingIndex];
    line.qty += Number(itemSnapshot.qty || 1);
    line.price = Number(itemSnapshot.price);
    line.image = itemSnapshot.image || line.image;
  } else {
    this.items.push({
      productId: itemSnapshot.productId,
      vendorId: itemSnapshot.vendorId,
      name: itemSnapshot.name,
      slug: itemSnapshot.slug,
      image: itemSnapshot.image || "",
      qty: Number(itemSnapshot.qty || 1),
      price: Number(itemSnapshot.price),
      attributes: itemSnapshot.attributes || {},
      sku: itemSnapshot.sku || "",
      variantId:itemSnapshot.variantId
    });
  }

  this.recalculate();
  await this.save();
  return this;
};




cartSchema.methods.updateItemQty = async function (cartItemId, qty) {
  const idx = this.items.findIndex((it) => String(it._id) === String(cartItemId));
  if (idx === -1) throw new Error("Cart item not found");

  if (!Number.isFinite(Number(qty)) || Number(qty) < 0) throw new Error("Invalid qty");

  if (Number(qty) === 0) {
    this.items.splice(idx, 1);
  } else {
    this.items[idx].qty = Number(qty);
  }

  this.recalculate();
  await this.save();
  return this;
};

/**
 * Remove an item by cartItemId
 */
cartSchema.methods.removeItem = async function (cartItemId) {
  const idx = this.items.findIndex((it) => String(it._id) === String(cartItemId));
  if (idx !== -1) this.items.splice(idx, 1);
  this.recalculate();
  await this.save();
  return this;
};

/**
 * Clear cart
 */
cartSchema.methods.clearCart = async function () {
  this.items = [];
  this.subtotal = 0;
  await this.save();
  return this;
};

//
// Static helpers
//

/**
 * Find or create cart for a user or sessionId
 * Pass either { userId } (preferred) or { sessionId }.
 */
cartSchema.statics.findOrCreateFor = async function ({ userId }) {
  if (!userId) throw new Error("userId required");

  let cart = await this.findOne({ user: userId });
  if (!cart) cart = await this.create({ user: userId });

  return cart;
};


const Cart=mongoose.model("Cart",cartSchema)

module.exports =Cart