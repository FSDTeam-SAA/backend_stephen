import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { Project } from "../model/project.model.js";
import { ProjectUpdate } from "../model/projectUpdate.model.js";
import { Comment } from "../model/comment.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";
import { getProjectForUser } from "../utils/projectAccess.js";
import { createNotification } from "../utils/notification.js";

export const createProjectUpdate = catchAsync(async (req, res) => {
  if (req.user.role !== "manager") {
    throw new AppError(httpStatus.FORBIDDEN, "Only manager can post updates");
  }

  const { projectId, description } = req.body;
  if (!projectId || !description) {
    throw new AppError(httpStatus.BAD_REQUEST, "Project and description are required");
  }

  const project = await Project.findOne({ _id: projectId, siteManager: req.user._id });
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, "Project not found or not assigned to manager");
  }

  const files = req.files || [];
  const uploadedImages = [];

  for (const file of files) {
    const uploaded = await uploadOnCloudinary(file.buffer, { folder: "project_updates" });
    uploadedImages.push({
      public_id: uploaded.public_id,
      url: uploaded.secure_url,
    });
  }

  const update = await ProjectUpdate.create({
    project: project._id,
    uploadedBy: req.user._id,
    description,
    images: uploadedImages,
  });

  await Promise.all([
    createNotification({
      user: project.client,
      project: project._id,
      update: update._id,
      title: "New Site Update",
      message: `New update posted on ${project.projectName}`,
      type: "site_update",
    }),
    createNotification({
      user: project.createdBy,
      project: project._id,
      update: update._id,
      title: "New Site Update",
      message: `Manager posted an update on ${project.projectName}`,
      type: "site_update",
    }),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Project update posted",
    data: update,
  });
});

export const getProjectUpdates = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  await getProjectForUser(projectId, req.user);

  const updates = await ProjectUpdate.find({ project: projectId })
    .populate("uploadedBy", "name avatar role")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project updates fetched",
    data: updates,
  });
});

export const toggleUpdateLike = catchAsync(async (req, res) => {
  const { updateId } = req.params;
  const update = await ProjectUpdate.findById(updateId);
  if (!update) {
    throw new AppError(httpStatus.NOT_FOUND, "Update not found");
  }

  await getProjectForUser(update.project, req.user);

  const userId = req.user._id.toString();
  const alreadyLiked = update.likes.some((id) => id.toString() === userId);

  if (alreadyLiked) {
    update.likes = update.likes.filter((id) => id.toString() !== userId);
  } else {
    update.likes.push(req.user._id);
  }

  update.stats.likeCount = update.likes.length;
  await update.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: alreadyLiked ? "Like removed" : "Update liked",
    data: update,
  });
});

export const shareProjectUpdate = catchAsync(async (req, res) => {
  const { updateId } = req.params;
  const update = await ProjectUpdate.findById(updateId);
  if (!update) {
    throw new AppError(httpStatus.NOT_FOUND, "Update not found");
  }

  await getProjectForUser(update.project, req.user);

  update.stats.shareCount += 1;
  await update.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Share recorded",
    data: { shareCount: update.stats.shareCount },
  });
});

export const addUpdateComment = catchAsync(async (req, res) => {
  const { updateId } = req.params;
  const { comment } = req.body;

  if (!comment) {
    throw new AppError(httpStatus.BAD_REQUEST, "Comment is required");
  }

  const update = await ProjectUpdate.findById(updateId);
  if (!update) {
    throw new AppError(httpStatus.NOT_FOUND, "Update not found");
  }

  const project = await getProjectForUser(update.project, req.user);

  const createdComment = await Comment.create({
    update: update._id,
    user: req.user._id,
    comment,
  });

  update.stats.commentCount += 1;
  await update.save();

  if (req.user._id.toString() !== update.uploadedBy.toString()) {
    await createNotification({
      user: update.uploadedBy,
      project: project._id,
      update: update._id,
      title: "New Comment on Update",
      message: `${req.user.name} commented on an update`,
      type: "site_update",
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Comment added",
    data: createdComment,
  });
});

export const getUpdateComments = catchAsync(async (req, res) => {
  const { updateId } = req.params;
  const update = await ProjectUpdate.findById(updateId);
  if (!update) {
    throw new AppError(httpStatus.NOT_FOUND, "Update not found");
  }

  await getProjectForUser(update.project, req.user);

  const comments = await Comment.find({ update: updateId })
    .populate("user", "name avatar role")
    .sort({ createdAt: 1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comments fetched",
    data: comments,
  });
});
