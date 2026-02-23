import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { Task } from "../model/task.model.js";
import { Project } from "../model/project.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { getProjectForUser } from "../utils/projectAccess.js";
import { createNotification } from "../utils/notification.js";
import { ensureChatRoom } from "../utils/chat.js";

const getTaskScope = (user) => {
  if (user.role === "admin") {
    return {};
  }
  if (user.role === "manager") {
    return { manager: user._id };
  }
  return { client: user._id };
};

export const createTask = catchAsync(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new AppError(httpStatus.FORBIDDEN, "Only admin can create tasks");
  }

  const { projectId, taskName, taskDate, dueDate, description, priority } =
    req.body;
  if (!projectId || !taskName || !taskDate || !description) {
    throw new AppError(httpStatus.BAD_REQUEST, "Missing required task fields");
  }

  const project = await Project.findOne({ _id: projectId });
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, "Project not found");
  }

  const task = await Task.create({
    project: project._id,
    taskName,
    taskDate,
    dueDate: dueDate || null,
    description,
    priority: priority || "medium",
    manager: project.siteManager,
    client: project.client,
    admin: req.user._id,
    activities: [
      {
        action: "task_created",
        note: "Task created by admin",
        actedBy: req.user._id,
      },
    ],
  });

  await ensureChatRoom({
    entityId: task._id,
    entityType: "Task",
    participants: [req.user._id, project.client],
    createdBy: req.user._id,
    title: `${task.taskName} Discussion`,
  });

  await createNotification({
    user: project.client,
    project: project._id,
    task: task._id,
    title: "New Task Assigned",
    message: `Task created: ${task.taskName}`,
    type: "task_assigned",
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Task created successfully",
    data: task,
  });
});

export const getTasks = catchAsync(async (req, res) => {
  const { projectId, status, approvalStatus } = req.query;
  const query = { ...getTaskScope(req.user) };

  if (projectId) {
    await getProjectForUser(projectId, req.user);
    query.project = projectId;
  }
  if (status) {
    query.status = status;
  }
  if (approvalStatus) {
    query.approvalStatus = approvalStatus;
  }

  const tasks = await Task.find(query)
    .populate("project", "projectName projectCode progress")
    .populate("manager", "name email")
    .populate("client", "name email")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tasks fetched",
    data: tasks,
  });
});

export const getTaskDetails = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.findOne({ _id: taskId, ...getTaskScope(req.user) })
    .populate("project", "projectName projectCode")
    .populate("manager", "name email")
    .populate("client", "name email");

  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task details fetched",
    data: task,
  });
});

export const updateTaskByManager = catchAsync(async (req, res) => {
  if (req.user.role !== "manager") {
    throw new AppError(httpStatus.FORBIDDEN, "Only manager can update task");
  }

  const { taskId } = req.params;
  const { taskName, description, status, priority, dueDate, taskDate } =
    req.body;

  const task = await Task.findOne({ _id: taskId, manager: req.user._id });
  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }

  if (taskName) task.taskName = taskName;
  if (description) task.description = description;
  if (priority) task.priority = priority;
  if (dueDate !== undefined) task.dueDate = dueDate || null;
  if (taskDate) task.taskDate = taskDate;

  if (status) {
    task.status = status;
    if (status !== "completed") {
      task.approvedAt = null;
      task.rejectedAt = null;
    }
  }

  task.activities.push({
    action: "task_updated",
    note: `Task updated. Current status: ${task.status}`,
    actedBy: req.user._id,
  });

  await task.save();

  if (task.approvalStatus === "pending") {
    await createNotification({
      user: task.client,
      task: task._id,
      project: task.project,
      title: "Task Awaiting Approval",
      message: `${task.taskName} is ready for your review`,
      type: "task_approval_needed",
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task updated successfully",
    data: task,
  });
});

export const resubmitTaskForApproval = catchAsync(async (req, res) => {
  if (req.user.role !== "manager") {
    throw new AppError(httpStatus.FORBIDDEN, "Only manager can resubmit tasks");
  }

  const { taskId } = req.params;
  const task = await Task.findOne({ _id: taskId, manager: req.user._id });

  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }

  task.status = "completed";
  task.approvalStatus = "pending";
  task.submittedForApprovalAt = new Date();
  task.rejectionReason = "";
  task.rejectedAt = null;
  task.activities.push({
    action: "task_resubmitted",
    note: "Task resubmitted for client approval",
    actedBy: req.user._id,
  });

  await task.save();

  await createNotification({
    user: task.client,
    task: task._id,
    project: task.project,
    title: "Task Resubmitted",
    message: `${task.taskName} has been resubmitted for approval`,
    type: "task_approval_needed",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task resubmitted for approval",
    data: task,
  });
});

export const approveTask = catchAsync(async (req, res) => {
  if (req.user.role !== "client") {
    throw new AppError(httpStatus.FORBIDDEN, "Only client can approve tasks");
  }

  const { taskId } = req.params;
  const task = await Task.findOne({ _id: taskId, client: req.user._id });

  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }
  if (task.status !== "completed" || task.approvalStatus !== "pending") {
    throw new AppError(httpStatus.BAD_REQUEST, "Task is not awaiting approval");
  }

  task.approvalStatus = "approved";
  task.approvedAt = new Date();
  task.rejectedAt = null;
  task.activities.push({
    action: "task_approved",
    note: "Client approved the task",
    actedBy: req.user._id,
  });

  await task.save();

  await createNotification({
    user: task.manager,
    task: task._id,
    project: task.project,
    title: "Task Approved",
    message: `${task.taskName} has been approved`,
    type: "task_approved",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task approved successfully",
    data: task,
  });
});

export const rejectTask = catchAsync(async (req, res) => {
  if (req.user.role !== "client") {
    throw new AppError(httpStatus.FORBIDDEN, "Only client can reject tasks");
  }

  const { taskId } = req.params;
  const { reason } = req.body;
  if (!reason) {
    throw new AppError(httpStatus.BAD_REQUEST, "Rejection reason is required");
  }

  const task = await Task.findOne({ _id: taskId, client: req.user._id });
  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }
  if (task.status !== "completed" || task.approvalStatus !== "pending") {
    throw new AppError(httpStatus.BAD_REQUEST, "Task is not awaiting approval");
  }

  task.approvalStatus = "rejected";
  task.status = "in-progress";
  task.rejectionReason = reason;
  task.rejectedAt = new Date();
  task.activities.push({
    action: "task_rejected",
    note: reason,
    actedBy: req.user._id,
  });

  await task.save();

  await createNotification({
    user: task.manager,
    task: task._id,
    project: task.project,
    title: "Task Rejected",
    message: `${task.taskName} was rejected: ${reason}`,
    type: "task_rejected",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task rejected and returned to manager",
    data: task,
  });
});

export const updateTaskStatus = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;

  if (!["not-started", "in-progress", "completed"].includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid status value");
  }

  const task = await Task.findOne({
    _id: taskId,
    $or: [{ manager: req.user._id }, { client: req.user._id }],
  });

  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }

  task.status = status;
  task.activities.push({
    action: "status_updated",
    note: `Status changed to ${status}`,
    actedBy: req.user._id,
  });

  await task.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task status updated",
    data: task,
  });
});
