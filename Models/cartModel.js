const mongoose= require("mongoose")
const {Schema}=mongoose
const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: false }, // optional if your variant is not separate collection
    name: { type: String, required: true }, // snapshot
    slug: { type: String, required: false },
    image: { type: String, required: false }, // snapshot (main or variant image)
    qty: { type: Number, required: true, default: 1, min: 1 },
    price: {
      type: Number,
      required: true,
    },
   
    addedAt: { type: Date, default: Date.now },
    color: { type: String, required: false, default: "" },
    size: { type: String, required: false, default: "" },
    options: { type: [{ name: String, value: String }], default: [] },

  },
  { _id: true }
);

const cartSchema = new Schema(
  {
    // associate a cart with a user (preferred) OR a sessionId for guest carts
    user: { type: Schema.Types.ObjectId, ref: "User", index: true, required: false },
    sessionId: { type: String, index: true, required: false },

    // items array
    items: { type: [cartItemSchema], default: [] },

    // cached totals for performance (you may keep them in sync in controllers)
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
// add after cartSchema.methods.recalculate = function () { ... }

//
// Instance methods
//

/**
 * Add an item snapshot to the cart (or increment qty if same product+variant exists).
 * itemSnapshot must contain: { productId, price, qty (optional), name, slug, image, variantId (optional) }
 */
// replace your existing cartSchema.methods.addItem with this

cartSchema.methods.addItem = async function (itemSnapshot) {
  if (!itemSnapshot || !itemSnapshot.productId || typeof itemSnapshot.price === "undefined") {
    throw new Error("Invalid item snapshot: productId and price required");
  }

  const productId = String(itemSnapshot.productId);
  const variantId = itemSnapshot.variantId ? String(itemSnapshot.variantId) : null;
  const sizeSnap = itemSnapshot.size ? String(itemSnapshot.size) : "";
  const colorSnap = itemSnapshot.color ? String(itemSnapshot.color) : "";

  // find existing line that matches product + variant + size + color
  const existingIndex = this.items.findIndex((it) => {
    const sameProduct = String(it.productId) === productId;
    const sameVariant = variantId ? String(it.variantId) === variantId : !it.variantId;
    const sameSize = (it.size || "") === sizeSnap;
    const sameColor = (it.color || "") === colorSnap;
    return sameProduct && sameVariant && sameSize && sameColor;
  });

  if (existingIndex >= 0) {
    const line = this.items[existingIndex];
    line.qty = Number(line.qty || 0) + Number(itemSnapshot.qty || 1);
    // update snapshot fields in case price/image/name changed
    line.price = Number(itemSnapshot.price);
    if (itemSnapshot.name) line.name = itemSnapshot.name;
    if (itemSnapshot.slug) line.slug = itemSnapshot.slug;
    if (itemSnapshot.image) line.image = itemSnapshot.image;
    // update new snapshots as well
    if (typeof itemSnapshot.size !== "undefined") line.size = itemSnapshot.size;
    if (typeof itemSnapshot.color !== "undefined") line.color = itemSnapshot.color;
    if (Array.isArray(itemSnapshot.options) && itemSnapshot.options.length) line.options = itemSnapshot.options;
  } else {
    this.items.push({
      productId: itemSnapshot.productId,
      variantId: itemSnapshot.variantId,
      name: itemSnapshot.name || "",
      slug: itemSnapshot.slug || "",
      image: itemSnapshot.image || "",
      qty: Number(itemSnapshot.qty || 1),
      price: Number(itemSnapshot.price),
      size: itemSnapshot.size || "",
      color: itemSnapshot.color || "",
      options: Array.isArray(itemSnapshot.options) ? itemSnapshot.options : [],
    });
  }

  this.recalculate();
  await this.save();
  return this;
};


/**
 * Update quantity of a cart item (by cart subdocument _id).
 * If qty <= 0, the item will be removed.
 */
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