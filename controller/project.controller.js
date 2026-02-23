import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { Project } from "../model/project.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { buildProjectScope, getProjectForUser } from "../utils/projectAccess.js";
import { createNotification } from "../utils/notification.js";

export const getProjects = catchAsync(async (req, res) => {
  const { status, search } = req.query;
  const scope = buildProjectScope(req.user);
  const query = { ...scope };

  if (status) {
    query.projectStatus = status;
  }

  if (search) {
    query.$text = { $search: search };
  }

  const projects = await Project.find(query)
    .populate("siteManager", "name email avatar")
    .populate("client", "name email avatar")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Projects fetched",
    data: projects,
  });
});

export const getProjectDetails = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const scope = buildProjectScope(req.user);
  const project = await Project.findOne({ _id: projectId, ...scope })
    .populate("siteManager", "name email avatar")
    .populate("client", "name email avatar")
    .populate("createdBy", "name email");

  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, "Project not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project details fetched",
    data: project,
  });
});

export const addProjectProgressUpdate = catchAsync(async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    throw new AppError(httpStatus.FORBIDDEN, "Only admin/manager can update progress");
  }

  const { projectId } = req.params;
  const { progressName, percent, note } = req.body;

  if (!progressName || percent === undefined) {
    throw new AppError(httpStatus.BAD_REQUEST, "Progress name and percent are required");
  }

  const project = await getProjectForUser(projectId, req.user);

  project.progressUpdates.push({
    progressName,
    percent: Number(percent),
    note: note || "",
    updatedBy: req.user._id,
    updatedAt: new Date(),
  });

  if (Number(percent) >= 100) {
    project.projectStatus = "finished";
  }

  await project.save();

  if (req.user.role === "manager") {
    await createNotification({
      user: project.client,
      project: project._id,
      title: "Project Progress Updated",
      message: `${project.projectName} progress updated: ${progressName}`,
      type: "site_update",
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Progress updated successfully",
    data: project,
  });
});

export const updateProjectStatus = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const { projectStatus } = req.body;

  if (!["active", "finished"].includes(projectStatus)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid project status");
  }

  const project = await getProjectForUser(projectId, req.user);

  if (req.user.role === "client") {
    throw new AppError(httpStatus.FORBIDDEN, "Client cannot update project status");
  }

  project.projectStatus = projectStatus;
  await project.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project status updated",
    data: project,
  });
});

export const updatePhasePaymentStatus = catchAsync(async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    throw new AppError(httpStatus.FORBIDDEN, "Only admin/manager can update phase payments");
  }

  const { projectId } = req.params;
  const { phaseName, paymentStatus, notes } = req.body;

  if (!phaseName || !["paid", "unpaid"].includes(paymentStatus)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Phase name and valid payment status required");
  }

  const project = await getProjectForUser(projectId, req.user);
  const phase = project.phases.find((item) => item.phaseName === phaseName);

  if (!phase) {
    throw new AppError(httpStatus.NOT_FOUND, "Phase not found in project");
  }

  phase.paymentStatus = paymentStatus;
  phase.paidAt = paymentStatus === "paid" ? new Date() : null;
  if (notes) {
    phase.notes = notes;
  }

  await project.save();

  await createNotification({
    user: project.client,
    project: project._id,
    title: "Payment Phase Updated",
    message: `${phase.phaseName} payment marked as ${phase.paymentStatus}`,
    type: "payment_reminder",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Phase payment updated",
    data: project,
  });
});

export const getProjectFinancialSummary = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await getProjectForUser(projectId, req.user);

  const totalBudget = Number(project.projectBudget || 0);
  const totalPaid = Number(project.totalPaid || 0);
  const remainingBalance = Math.max(totalBudget - totalPaid, 0);
  const paidPercentage = totalBudget > 0 ? Number(((totalPaid / totalBudget) * 100).toFixed(2)) : 0;

  const alerts = [];
  if (totalPaid > totalBudget) {
    const exceededBy = Number((((totalPaid - totalBudget) / totalBudget) * 100).toFixed(2));
    alerts.push(`Budget exceeded by ${exceededBy}%`);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Financial summary fetched",
    data: {
      totalBudget,
      totalPaid,
      remainingBalance,
      paidPercentage,
      phases: project.phases,
      alerts,
    },
  });
});
