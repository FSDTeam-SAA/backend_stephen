import httpStatus from "http-status";
import { User } from "../model/user.model.js";
import { Project } from "../model/project.model.js";
import { Task } from "../model/task.model.js";
import { ProjectUpdate } from "../model/projectUpdate.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { resolveScopedCategory } from "../utils/category.js";

const getAdminDashboard = async (category) => {
  const projectScope = { category };

  const [
    scopedProjectIds,
    totalProjects,
    finishedProjects,
    activeProjects,
    totalManagers,
    totalClients,
  ] = await Promise.all([
    Project.find(projectScope).distinct("_id"),
    Project.countDocuments(projectScope),
    Project.countDocuments({ ...projectScope, projectStatus: "finished" }),
    Project.countDocuments({ ...projectScope, projectStatus: "active" }),
    User.countDocuments({ role: "manager", category, isActive: true }),
    User.countDocuments({ role: "client", category, isActive: true }),
  ]);

  const pendingApprovals = scopedProjectIds.length
    ? await Task.countDocuments({
        approvalStatus: "pending",
        project: { $in: scopedProjectIds },
      })
    : 0;

  const financialStats = await Project.aggregate([
    { $match: projectScope },
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

const getManagerDashboard = async (userId, category) => {
  const projectScope = { siteManager: userId, category };

  const projects = await Project.find(projectScope).select(
    "projectName projectCode projectStatus progress startDate endDate",
  );

  const scopedProjectIds = projects.map((project) => project._id);
  const taskScope = scopedProjectIds.length
    ? { manager: userId, project: { $in: scopedProjectIds } }
    : { manager: userId, _id: null };

  const [openTasks, pendingApprovals, rejectedTasks, recentUpdates] = await Promise.all([
    Task.countDocuments({ ...taskScope, status: { $ne: "completed" } }),
    Task.countDocuments({ ...taskScope, approvalStatus: "pending" }),
    Task.countDocuments({ ...taskScope, approvalStatus: "rejected" }),
    ProjectUpdate.find({
      uploadedBy: userId,
      project: { $in: scopedProjectIds },
    })
      .sort({ createdAt: -1 })
      .limit(5),
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

const getClientDashboard = async (userId, category) => {
  const projects = await Project.find({
    category,
    $or: [{ client: userId }, { clientUsers: userId }],
  }).sort({ createdAt: -1 });

  const latestProjectIds = projects.map((project) => project._id);
  const tasksQuery = latestProjectIds.length
    ? {
        approvalStatus: "pending",
        project: { $in: latestProjectIds },
        $or: [{ client: userId }, { clientUsers: userId }],
      }
    : { _id: null };

  const tasks = await Task.find(tasksQuery)
    .select("taskName status approvalStatus project submittedForApprovalAt")
    .populate("project", "projectName projectCode");

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
      tasksAwaitingApproval: tasks.length,
    },
    projects,
    tasksAwaitingApproval: tasks,
    latestUpdates,
    financialSummary,
  };
};

export const getDashboard = catchAsync(async (req, res) => {
  const category = resolveScopedCategory(req.user, req.query.category);
  let data;
  if (req.user.role === "admin") {
    data = await getAdminDashboard(category);
  } else if (req.user.role === "manager") {
    data = await getManagerDashboard(req.user._id, category);
  } else {
    data = await getClientDashboard(req.user._id, category);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard data fetched",
    data,
  });
});
