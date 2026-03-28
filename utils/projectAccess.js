import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { Project } from "../model/project.model.js";
import { resolveScopedCategory } from "./category.js";

export const buildProjectScope = (user, requestedCategory) => {
  const category = resolveScopedCategory(user, requestedCategory);
  const categoryScope = { category };

  if (user.role === "admin") {
    return categoryScope;
  }

  if (user.role === "manager") {
    return { ...categoryScope, siteManager: user._id };
  }

  if (user.role === "client") {
    return {
      ...categoryScope,
      $or: [{ client: user._id }, { clientUsers: user._id }],
    };
  }

  throw new AppError(httpStatus.FORBIDDEN, "Invalid role");
};

export const getProjectForUser = async (projectId, user, requestedCategory) => {
  const scope = buildProjectScope(user, requestedCategory);
  const project = await Project.findOne({ _id: projectId, ...scope });

  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, "Project not found or not accessible");
  }

  return project;
};
