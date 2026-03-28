import httpStatus from "http-status";
import AppError from "../errors/AppError.js";

const CATEGORY_ALIASES = {
  construction: "construction",
  interior: "interior",
  nvf: "construction",
  tbs: "interior",
};

const CATEGORY_HELP_TEXT = "Allowed categories: construction (NVF), interior (TBS)";

const hasInput = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

export const normalizeCategory = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return CATEGORY_ALIASES[key] || "";
};

export const resolveRequiredCategory = (value) => {
  const category = normalizeCategory(value);
  if (!category) {
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid category. ${CATEGORY_HELP_TEXT}`);
  }
  return category;
};

export const resolveScopedCategory = (user, requestedCategory) => {
  const userCategory = normalizeCategory(user?.category);

  if (!userCategory) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account category is not configured. Contact support.",
    );
  }

  if (!hasInput(requestedCategory)) {
    return userCategory;
  }

  const normalizedRequestedCategory = normalizeCategory(requestedCategory);
  if (!normalizedRequestedCategory) {
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid category. ${CATEGORY_HELP_TEXT}`);
  }

  if (normalizedRequestedCategory !== userCategory) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Category mismatch. You can access only your own app category.",
    );
  }

  return userCategory;
};

export const isCategoryProvided = hasInput;
