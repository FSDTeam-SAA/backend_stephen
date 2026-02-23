import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { Document } from "../model/document.model.js";
import { Project } from "../model/project.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";
import { getProjectForUser } from "../utils/projectAccess.js";
import { createNotification } from "../utils/notification.js";

export const uploadProjectDocument = catchAsync(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new AppError(httpStatus.FORBIDDEN, "Only admin can upload documents");
  }

  const { projectId, category, title } = req.body;
  if (!projectId || !category || !title || !req.file) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Project, category, title and file are required",
    );
  }

  const project = await Project.findOne({ _id: projectId });
  if (!project) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Project not found or not assigned",
    );
  }

  const uploaded = await uploadOnCloudinary(req.file.buffer, {
    folder: "project_documents",
  });

  const document = await Document.create({
    project: project._id,
    category,
    title,
    uploadedBy: req.user._id,
    document: {
      public_id: uploaded.public_id,
      url: uploaded.secure_url,
    },
    meta: {
      fileName: req.file.originalname || "",
      size: req.file.size || 0,
      mimeType: req.file.mimetype || "",
    },
  });

  await Promise.all([
    createNotification({
      user: project.client,
      project: project._id,
      title: "New Document Uploaded",
      message: `${title} added under ${category}`,
      type: "new_document",
    }),
    createNotification({
      user: project.createdBy,
      project: project._id,
      title: "New Document Uploaded",
      message: `${title} added under ${category}`,
      type: "new_document",
    }),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Document uploaded successfully",
    data: document,
  });
});

export const getProjectDocuments = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const { category } = req.query;
  await getProjectForUser(projectId, req.user);

  const query = { project: projectId };
  if (category) {
    query.category = category;
  }

  const documents = await Document.find(query)
    .populate("uploadedBy", "name email")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Documents fetched",
    data: documents,
  });
});
