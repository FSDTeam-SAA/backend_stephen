import httpStatus from "http-status";
import { User } from "../model/user.model.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/commonMethod.js";
import AppError from "../errors/AppError.js";
import sendResponse from "../utils/sendResponse.js";
import catchAsync from "../utils/catchAsync.js";

export const getProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "-password -refreshToken -verificationInfo -password_reset_token",
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile fetched",
    data: user,
  });
});

export const updateProfile = catchAsync(async (req, res) => {
  const { name, phone, address, bio, removeAvatar, email, adminChangeEmail } =
    req.body;

  const user = await User.findById(req.user._id).select(
    "-password -refreshToken -verificationInfo -password_reset_token -otp",
  );

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = address;
  if (bio) user.bio = bio;

  const nextRequestedEmail = String(adminChangeEmail || email || "")
    .trim()
    .toLowerCase();

  const normalizedEmail = String(nextRequestedEmail || "")
    .trim()
    .toLowerCase();

  if (normalizedEmail && normalizedEmail !== user.email) {
    if (req.user.role !== "admin") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Only admin can change email",
      );
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isValidEmail) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid email format");
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    }).select("_id");

    if (existingUser) {
      throw new AppError(httpStatus.CONFLICT, "Email already in use");
    }

    user.email = normalizedEmail;
  }

  if (req.file) {
    const previousPublicId = user.avatar?.public_id;
    const upload = await uploadOnCloudinary(req.file.buffer, {
      folder: "user_avatars",
    });
    user.avatar = { public_id: upload.public_id, url: upload.secure_url };
    if (previousPublicId) {
      await deleteFromCloudinary(previousPublicId);
    }
  } else if (
    String(removeAvatar || "").toLowerCase() === "true" &&
    user.avatar?.public_id
  ) {
    await deleteFromCloudinary(user.avatar.public_id);
    user.avatar = { public_id: "", url: "" };
  }

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Updated",
    data: user,
  });
});

export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword)
    throw new AppError(httpStatus.BAD_REQUEST, "Passwords don't match");

  const user = await User.findById(req.user._id).select("+password");

  if (!(await User.isPasswordMatched(currentPassword, user.password))) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Current password wrong");
  }
  user.password = newPassword;

  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed",
  });
});
