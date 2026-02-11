const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      select: false,
    },

    googleId: {
      type: String,
    },
    recentlyViewedProducts: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  }
],
    

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isDeleted:{
      type:Boolean,
      default:false
    },
    deletedAt:{
      type:Date,
      default:null
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
      tokenVersion: {
      type: Number,
      default: 0,
    },

    // ✅ RECENT LOGIN ACTIVITY (CORRECT PLACE)
    recentLogins: [
      {
        device: String,      // Chrome on Windows
        location: String,    // Kannur, India
        ip: String,
        loggedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);
//for saving user with hashing password
userSchema.pre("save", async function () {
  // if password is not modified or doesn't exist, skip hashing
  if (!this.isModified("password") || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};



const User=mongoose.model("User",userSchema)

module.exports =User