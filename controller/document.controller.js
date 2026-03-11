import mongoose from "mongoose";
import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { DOCUMENT_CATEGORIES, Document } from "../model/document.model.js";
import { Project } from "../model/project.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";
import { getProjectForUser } from "../utils/projectAccess.js";
import { createNotification } from "../utils/notification.js";
import { getIO } from "../utils/socket.js";

const DOCUMENT_CATEGORY_ALIASES = {
  drawing: "drawings",
  drawings: "drawings",
  invoice: "invoices",
  invoices: "invoices",
  report: "reports",
  reports: "reports",
  contract: "contracts",
  contracts: "contracts",
};

const normalizeDocumentCategory = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return DOCUMENT_CATEGORY_ALIASES[key] || key;
};

export const uploadProjectDocument = catchAsync(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new AppError(httpStatus.FORBIDDEN, "Only admin can upload documents");
  }

  const { projectId, category, title } = req.body;
  const normalizedCategory = normalizeDocumentCategory(category);

  if (!projectId || !category || !title || !req.file) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Project, category, title and file are required",
    );
  }
  if (!DOCUMENT_CATEGORIES.includes(normalizedCategory)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid document category. Allowed values: ${DOCUMENT_CATEGORIES.join(", ")}`,
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
    category: normalizedCategory,
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
      message: `${title} added under ${normalizedCategory}`,
      type: "new_document",
    }),
    createNotification({
      user: project.createdBy,
      project: project._id,
      title: "New Document Uploaded",
      message: `${title} added under ${normalizedCategory}`,
      type: "new_document",
    }),
  ]);

  const populatedDocument = await Document.findById(document._id).populate(
    "uploadedBy",
    "name email avatar role",
  );

  try {
    const io = getIO();
    io.to(`project_${project._id}`).emit(
      "project:documentUploaded",
      populatedDocument,
    );
  } catch (error) {
    console.error("Error emitting project:documentUploaded:", error);
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Document uploaded successfully",
    data: populatedDocument || document,
  });
});

export const getProjectDocuments = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const { category } = req.query;
  await getProjectForUser(projectId, req.user);

  const query = { project: projectId };
  if (category) {
    const normalizedCategory = normalizeDocumentCategory(category);
    if (!DOCUMENT_CATEGORIES.includes(normalizedCategory)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid document category. Allowed values: ${DOCUMENT_CATEGORIES.join(", ")}`,
      );
    }
    query.category = normalizedCategory;
  }

  const documents = await Document.find(query)
    .populate("uploadedBy", "name email")
    .sort({ createdAt: -1 });

  const countsByCategory = DOCUMENT_CATEGORIES.reduce((acc, item) => {
    acc[item] = 0;
    return acc;
  }, {});

  const groupedDocuments = DOCUMENT_CATEGORIES.reduce((acc, item) => {
    acc[item] = [];
    return acc;
  }, {});

  const totals = await Document.aggregate([
    { $match: { project: new mongoose.Types.ObjectId(projectId) } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  for (const row of totals) {
    if (row?._id && Object.prototype.hasOwnProperty.call(countsByCategory, row._id)) {
      countsByCategory[row._id] = row.count;
    }
  }

  for (const doc of documents) {
    if (groupedDocuments[doc.category]) {
      groupedDocuments[doc.category].push(doc);
    }
  }

  const totalCount = Object.values(countsByCategory).reduce(
    (sum, value) => sum + value,
    0,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Documents fetched",
    data: {
      totalCount,
      counts: countsByCategory,
      documents: groupedDocuments,
    },
  });
});
