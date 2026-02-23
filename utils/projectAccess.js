import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { Project } from "../model/project.model.js";

export const buildProjectScope = (user) => {
  if (user.role === "admin") {
    return {};
  }

  if (user.role === "manager") {
    return { siteManager: user._id };
  }

  if (user.role === "client") {
    return { client: user._id };
  }

  throw new AppError(httpStatus.FORBIDDEN, "Invalid role");
};

export const getProjectForUser = async (projectId, user) => {
  const scope = buildProjectScope(user);
  const project = await Project.findOne({ _id: projectId, ...scope });

  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, "Project not found or not accessible");
  }

  return project;
};
