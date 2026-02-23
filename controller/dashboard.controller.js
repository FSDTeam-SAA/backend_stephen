import httpStatus from "http-status";
import { User } from "../model/user.model.js";
import { Project } from "../model/project.model.js";
import { Task } from "../model/task.model.js";
import { ProjectUpdate } from "../model/projectUpdate.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

const getAdminDashboard = async () => {
  const [totalProjects, finishedProjects, activeProjects, totalManagers, totalClients, pendingApprovals] =
    await Promise.all([
      Project.countDocuments({}),
      Project.countDocuments({ projectStatus: "finished" }),
      Project.countDocuments({ projectStatus: "active" }),
      User.countDocuments({ role: "manager", isActive: true }),
      User.countDocuments({ role: "client", isActive: true }),
      Task.countDocuments({ approvalStatus: "pending" }),
    ]);

  const financialStats = await Project.aggregate([
    {
      $group: {
        _id: null,
        totalBudget: { $sum: "$projectBudget" },
        totalPaid: { $sum: "$totalPaid" },
        remainingBudget: { $sum: "$remainingBudget" },
      },
    },
  ]);

  return {
    summary: {
      totalProjects,
      finishedProjects,
      activeProjects,
      totalManagers,
      totalClients,
      pendingApprovals,
    },
    financials: financialStats[0] || { totalBudget: 0, totalPaid: 0, remainingBudget: 0 },
  };
};

const getManagerDashboard = async (userId) => {
  const [projects, openTasks, pendingApprovals, rejectedTasks, recentUpdates] = await Promise.all([
    Project.find({ siteManager: userId }).select(
      "projectName projectCode projectStatus progress startDate endDate",
    ),
    Task.countDocuments({ manager: userId, status: { $ne: "completed" } }),
    Task.countDocuments({ manager: userId, approvalStatus: "pending" }),
    Task.countDocuments({ manager: userId, approvalStatus: "rejected" }),
    ProjectUpdate.find({ uploadedBy: userId }).sort({ createdAt: -1 }).limit(5),
  ]);

  return {
    summary: {
      totalProjects: projects.length,
      activeTasks: openTasks,
      awaitingClientApproval: pendingApprovals,
      rejectedTasks,
    },
    projects,
    recentUpdates,
  };
};

const getClientDashboard = async (userId) => {
  const [projects, tasksAwaitingApproval] = await Promise.all([
    Project.find({ client: userId }).sort({ createdAt: -1 }),
    Task.find({ client: userId, approvalStatus: "pending" })
      .select("taskName status approvalStatus project submittedForApprovalAt")
      .populate("project", "projectName projectCode"),
  ]);

  const latestProjectIds = projects.map((project) => project._id);
  const latestUpdates = await ProjectUpdate.find({ project: { $in: latestProjectIds } })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("project", "projectName");

  const financialSummary = projects.map((project) => ({
    projectId: project._id,
    projectName: project.projectName,
    budget: project.projectBudget,
    paid: project.totalPaid,
    remaining: project.remainingBudget,
  }));

  return {
    summary: {
      totalProjects: projects.length,
      tasksAwaitingApproval: tasksAwaitingApproval.length,
    },
    projects,
    tasksAwaitingApproval,
    latestUpdates,
    financialSummary,
  };
};

export const getDashboard = catchAsync(async (req, res) => {
  let data;
  if (req.user.role === "admin") {
    data = await getAdminDashboard();
  } else if (req.user.role === "manager") {
    data = await getManagerDashboard(req.user._id);
  } else {
    data = await getClientDashboard(req.user._id);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard data fetched",
    data,
  });
});
