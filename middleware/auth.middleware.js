import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { User } from "./../model/user.model.js";
import catchAsync from "../utils/catchAsync.js";

export const protect = catchAsync(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Access token is required");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (error) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token");
  }

  const user = await User.findById(decoded._id);
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
