import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    name: { type: String },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      validator: {
        validator: function (value) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
      },
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["client", "manager", "admin"],
      default: "admin",
      index: true,
    },
    avatar: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    otp: {
      hash: { type: String, default: "" },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
      lastSentAt: { type: Date, default: null },
    },
    verificationInfo: {
      verified: { type: Boolean, default: false },
      token: { type: String, default: "" },
    },
    password_reset_token: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    isEmailVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const saltRounds = Number(process.env.bcrypt_salt_round) || 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }

  next();
});

userSchema.statics.isUserExistsByEmail = async function (email) {
  return await this.findOne({ email }).select("+password");
};

userSchema.statics.isOTPVerified = async function (id) {
  const user = await this.findById(id).select("+verificationInfo");
  return user?.verificationInfo.verified;
};

userSchema.statics.isPasswordMatched = async function (
  plainTextPassword,
  hashPassword,
) {
  return await bcrypt.compare(plainTextPassword, hashPassword);
};

userSchema.statics.findByPhone = async function (phone) {
  return await this.findOne({ phone });
};

export const User = mongoose.model("User", userSchema);
