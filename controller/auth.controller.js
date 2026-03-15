import AppError from "../errors/AppError.js";
import { createToken, verifyToken } from "../utils/authToken.js";
import catchAsync from "../utils/catchAsync.js";
import { generateOTP, hashOTP, isOtpExpired } from "../utils/commonMethod.js";
import httpStatus from "http-status";
import sendResponse from "../utils/sendResponse.js";
import { sendEmail } from "../utils/sendEmail.js";
import { User } from "./../model/user.model.js";

const normalizeToken = (tokenLike) => {
  if (typeof tokenLike !== "string") {
    return undefined;
  }

  const normalized = tokenLike.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.startsWith("Bearer ")) {
    return normalized.split(" ")[1]?.trim();
  }

  return normalized;
};

const getRefreshTokensFromRequest = (req) => {
  const refreshTokenFromCookie = normalizeToken(req.cookies?.refreshToken);
  const refreshTokenFromBody = normalizeToken(req.body?.refreshToken);
  const refreshTokenFromHeader = normalizeToken(req.headers["x-refresh-token"]);
  const refreshTokenFromAuthorization = normalizeToken(req.headers.authorization);

  return [
    ...new Set(
      [
        refreshTokenFromCookie,
        refreshTokenFromBody,
        refreshTokenFromHeader,
        refreshTokenFromAuthorization,
      ].filter(Boolean),
    ),
  ];
};

const getRefreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 365,
  };
};

export const register = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return next(new AppError(400, "Name, email and password are required"));
  }

  // Check existing user
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError(409, "Email already registered"));
  }

  const existingAdminCount = await User.countDocuments({ role: "admin" });
  let resolvedRole = "client";
  if (role === "admin" && existingAdminCount === 0) {
    resolvedRole = "admin";
  } else if (role === "manager") {
    resolvedRole = "manager";
  }

  const user = await User.create({
    name,
    email,
    password,
    role: resolvedRole,
    isEmailVerified: true,
  });

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Registration successful. You can now log in.",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password, category } = req.body;

  if (!email || !password) {
    return next(new AppError(400, "Email, password are required"));
  }

  // Explicitly select password
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new AppError(404, "User not found"));
  }

  if (user?.category !== category) {
    return next(new AppError(404, "Category mismatch"));
  }

  const isPasswordValid = await User.isPasswordMatched(password, user.password);

  if (!isPasswordValid) {
    return next(new AppError(401, "Invalid email or password"));
  }

  if (!user.isEmailVerified) {
    return next(
      new AppError(403, "Email not verified. Please verify your email."),
    );
  }

  const jwtPayload = {
    _id: user._id,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_EXPIRES_IN,
  );

  const refreshToken = createToken(
    jwtPayload,
    process.env.JWT_REFRESH_SECRET,
    process.env.JWT_REFRESH_EXPIRES_IN,
  );

  // Save refresh token in DB
  user.refreshToken = refreshToken;
  await user.save();

  // Secure cookie
  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Login successful",
    data: {
      accessToken,
      refreshToken,
      name: user.name,
      email: user.email,
      role: user.role,
      _id: user._id,
      category: user.category,
    },
  });
});

export const forgetPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError(400, "Email is required"));
  }

  const user = await User.findOne({ email });
  if (!user) return next(new AppError(404, "User not found"));

  const now = Date.now();
  const lastSent = user.otp?.lastSentAt ? user.otp.lastSentAt.getTime() : 0;

  if (now - lastSent < 60 * 1000) {
    return next(new AppError(429, "Please wait before requesting another OTP"));
  }

  const rawOtp = generateOTP(6);

  user.otp = {
    hash: hashOTP(rawOtp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    attempts: 0,
    lastSentAt: new Date(),
  };

  await user.save();

  await sendEmail(
    user.email,
    "Reset Password",
    `Your password reset OTP is ${rawOtp}`,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP sent to your email successfully",
    data: null,
  });
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const { email, otp, password, confirmPassword } = req.body;

  if (!email || !otp || !password) {
    return next(new AppError(400, "Email, OTP and password are required"));
  }

  if (password !== confirmPassword) {
    return next(new AppError(400, "Passwords do not match"));
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) return next(new AppError(404, "User not found"));

  if (!user.otp?.hash || isOtpExpired(user.otp.expiresAt)) {
    return next(new AppError(400, "OTP is invalid or expired"));
  }

  if (user.otp.attempts >= 5) {
    return next(new AppError(429, "Too many attempts. Request a new OTP."));
  }

  const isValid = hashOTP(otp) === user.otp.hash;
  user.otp.attempts += 1;

  if (!isValid) {
    await user.save();
    return next(new AppError(400, "Invalid OTP"));
  }

  user.password = password;

  user.otp = {
    hash: "",
    expiresAt: null,
    attempts: 0,
    lastSentAt: null,
  };

  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password reset successfully",
    data: null,
  });
});

export const verifyOTP = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new AppError(400, "Email, OTP and are required"));
  }

  const user = await User.findOne({ email });
  if (!user) return next(new AppError(404, "User not found"));

  if (!user.otp?.hash || isOtpExpired(user.otp.expiresAt)) {
    return next(new AppError(400, "Invalid or expired OTP"));
  }

  if (user.otp.attempts >= 5) {
    return next(new AppError(429, "Too many attempts. Request a new OTP."));
  }

  const isValid = hashOTP(otp) === user.otp.hash;
  user.otp.attempts += 1;

  if (!isValid) {
    await user.save();
    return next(new AppError(400, "Invalid OTP"));
  }

  user.isEmailVerified = true;
  user.otp = {
    hash: "",
    expiresAt: null,
    attempts: 0,
    lastSentAt: null,
  };

  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "OTP verified successfully",
    data: { email },
  });
});

export const changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Old password and new password are required",
    );
  }
  if (oldPassword === newPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Old password and new password cannot be same",
    );
  }
  const user = await User.findById({ _id: req.user?._id }).select("+password");

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isPasswordMatched = await User.isPasswordMatched(
    oldPassword,
    user.password,
  );
  if (!isPasswordMatched) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
  }

  user.password = newPassword;
  await user.save();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed",
    data: "",
  });
});

export const refreshToken = catchAsync(async (req, res) => {
  const refreshTokens = getRefreshTokensFromRequest(req);

  if (!refreshTokens.length) {
    throw new AppError(400, "Refresh token is required");
  }

  let user = null;

  for (const refreshToken of refreshTokens) {
    let decoded;
    try {
      decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      continue;
    }

    const candidateUser = await User.findById(decoded._id);
    if (!candidateUser || !candidateUser.isActive) {
      continue;
    }

    if (candidateUser.refreshToken !== refreshToken) {
      continue;
    }

    user = candidateUser;
    break;
  }

  if (!user) {
    throw new AppError(401, "Invalid refresh token");
  }

  const jwtPayload = {
    _id: user._id,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_ACCESS_EXPIRES_IN,
  );

  const stableRefreshToken = user.refreshToken;
  res.cookie("refreshToken", stableRefreshToken, getRefreshCookieOptions());

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Token refreshed successfully",
    data: { accessToken: accessToken, refreshToken: stableRefreshToken },
  });
});

export const logout = catchAsync(async (req, res) => {
  const user = req.user?._id;
  await User.findByIdAndUpdate(
    user,
    { refreshToken: "" },
    { new: true },
  );
  res.clearCookie("refreshToken", getRefreshCookieOptions());
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
    data: "",
  });
});
