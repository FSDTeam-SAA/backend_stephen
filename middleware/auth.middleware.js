import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { User } from "./../model/user.model.js";
import catchAsync from "../utils/catchAsync.js";
import { createToken } from "../utils/authToken.js";

const getRefreshTokenFromRequest = (req) => {
  const refreshTokenFromBody = req.body?.refreshToken;
  const refreshTokenFromCookie = req.cookies?.refreshToken;
  const refreshTokenFromHeader = req.headers["x-refresh-token"];

  return (
    refreshTokenFromBody || refreshTokenFromCookie || refreshTokenFromHeader
  );
};

export const protect = catchAsync(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Access token is required");
  }

  let user;
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    user = await User.findById(decoded._id);
  } catch (error) {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token");
    }

    let decodedRefreshToken;
    try {
      decodedRefreshToken = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET,
      );
    } catch (refreshError) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token");
    }

    user = await User.findById(decodedRefreshToken._id);
    if (!user || !user.isActive || user.refreshToken !== refreshToken) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token");
    }

    const jwtPayload = {
      _id: user._id,
      email: user.email,
      role: user.role,
    };

    const newAccessToken = createToken(
      jwtPayload,
      process.env.JWT_ACCESS_SECRET,
      process.env.JWT_ACCESS_EXPIRES_IN,
    );

    res.setHeader("x-access-token", newAccessToken);
    res.setHeader("access-token-refreshed", "true");
  }

  if (!user || !user.isActive) {
    throw new AppError(httpStatus.UNAUTHORIZED, "User not found or inactive");
  }

  req.user = user;
  next();
});

export const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Access denied. Requires role: ${roles.join(", ")}`,
    );
  }
  next();
};

export const isAdmin = allowRoles("admin");
