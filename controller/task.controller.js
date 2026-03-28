import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { Task } from "../model/task.model.js";
import { Project } from "../model/project.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { buildProjectScope, getProjectForUser } from "../utils/projectAccess.js";
import { createNotification, createNotificationsForUsers } from "../utils/notification.js";
import { ensureChatRoom } from "../utils/chat.js";

const getTaskScope = async (user, requestedCategory) => {
  const projectScope = buildProjectScope(user, requestedCategory);
  const scopedProjectIds = await Project.find(projectScope).distinct("_id");

  const scopedProjectQuery = {
    project: { $in: scopedProjectIds },
  };

  if (user.role === "admin") {
    return scopedProjectQuery;
  }
  if (user.role === "manager") {
    return {
      ...scopedProjectQuery,
      manager: user._id,
    };
  }
  return {
    ...scopedProjectQuery,
    $or: [{ client: user._id }, { clientUsers: user._id }],
  };
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

  const project = await getProjectForUser(projectId, req.user);
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
    clientUsers: project.clientUsers || [project.client],
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
    participants: [req.user._id, project.siteManager, ...(project.clientUsers || [project.client])],
    createdBy: req.user._id,
    title: `${task.taskName} Discussion`,
  });

  await createNotificationsForUsers(
    project.clientUsers || [project.client],
    (userId) => ({
      user: userId,
      project: project._id,
      task: task._id,
      title: "New Task Assigned",
      message: `Task created: ${task.taskName}`,
      type: "task_assigned",
    }),
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Task created successfully",
    data: task,
  });
});

export const getTasks = catchAsync(async (req, res) => {
  const { projectId, status, approvalStatus, category } = req.query;
  const query = await getTaskScope(req.user, category);

  if (projectId) {
    await getProjectForUser(projectId, req.user, category);
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
    .populate("clientUsers", "name email")
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
  const taskScope = await getTaskScope(req.user, req.query.category);
  const task = await Task.findOne({ _id: taskId, ...taskScope })
    .populate("project", "projectName projectCode")
    .populate("manager", "name email")
    .populate("client", "name email")
    .populate("clientUsers", "name email");

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
  await getProjectForUser(task.project, req.user);

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
    await createNotificationsForUsers(
      task.clientUsers || [task.client],
      (userId) => ({
        user: userId,
        task: task._id,
        project: task.project,
        title: "Task Awaiting Approval",
        message: `${task.taskName} is ready for your review`,
        type: "task_approval_needed",
      }),
    );
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
  await getProjectForUser(task.project, req.user);

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

  await createNotificationsForUsers(
    task.clientUsers || [task.client],
    (userId) => ({
      user: userId,
      task: task._id,
      project: task.project,
      title: "Task Resubmitted",
      message: `${task.taskName} has been resubmitted for approval`,
      type: "task_approval_needed",
    }),
  );

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
  const task = await Task.findOne({
    _id: taskId,
    $or: [{ client: req.user._id }, { clientUsers: req.user._id }],
  });

  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }
  await getProjectForUser(task.project, req.user);
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

  const task = await Task.findOne({
    _id: taskId,
    $or: [{ client: req.user._id }, { clientUsers: req.user._id }],
  });
  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }
  await getProjectForUser(task.project, req.user);
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
  if (!["admin", "manager"].includes(req.user.role)) {
    throw new AppError(httpStatus.FORBIDDEN, "Only admin or manager can update task status");
  }

  const { taskId } = req.params;
  const { status } = req.body;

  if (!["not-started", "in-progress", "completed"].includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid status value");
  }

  const projectScope = buildProjectScope(req.user);
  const scopedProjectIds = await Project.find(projectScope).distinct("_id");

  const task = await Task.findOne(
    req.user.role === "admin"
      ? {
          _id: taskId,
          admin: req.user._id,
          project: { $in: scopedProjectIds },
        }
      : {
          _id: taskId,
          manager: req.user._id,
          project: { $in: scopedProjectIds },
        },
  );

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
