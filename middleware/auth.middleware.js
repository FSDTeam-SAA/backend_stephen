import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { User } from "./../model/user.model.js";
import catchAsync from "../utils/catchAsync.js";
import { createToken } from "../utils/authToken.js";

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
    const refreshTokens = getRefreshTokensFromRequest(req);
    if (!refreshTokens.length) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid token");
    }

    for (const refreshToken of refreshTokens) {
      let decodedRefreshToken;
      try {
        decodedRefreshToken = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET,
        );
      } catch (refreshError) {
        continue;
      }

      const candidateUser = await User.findById(decodedRefreshToken._id);
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
