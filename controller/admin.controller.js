import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { User } from "../model/user.model.js";
import { Project } from "../model/project.model.js";
import { Manager } from "../model/manager.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { ensureChatRoom } from "../utils/chat.js";
import { createNotification } from "../utils/notification.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";

const generateProjectCode = () =>
  `PRJ-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

const normalizeProjectPhases = (phases = [], phase1 = []) => {
  console.log(phase1)
  if (!Array.isArray(phases) || phases.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Add at least one phase to the project"
    );
  }

  const uniquePhaseNames = new Set();

  const normalizedPhases = phases.map((phase, index) => {
    const previousPhase = phase1[index];

    const phaseName = String(phase.phaseName || "").trim();
    const amount = Number(phase.amount);

    const dueDate =
      previousPhase?.dueDate || phase.dueDate || phase.paymentDate;

    const paymentStatus =
      previousPhase?.paymentStatus || phase.paymentStatus || "unpaid";

    const parsedDueDate = new Date(dueDate);

    if (
      !phaseName ||
      Number.isNaN(amount) ||
      amount < 0 ||
      Number.isNaN(parsedDueDate.getTime())
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Each phase must include a valid name, amount, and payment date"
      );
    }

    const normalizedName = phaseName.toLowerCase();

    if (uniquePhaseNames.has(normalizedName)) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Phase names must be unique within a project"
      );
    }

    uniquePhaseNames.add(normalizedName);

    return {
      phaseName,
      amount,
      dueDate,
      paymentStatus,
      notes: String(phase.notes || "").trim(),
    };
  });

  return normalizedPhases;
};

const calculateProjectBudget = (phases = []) =>
  phases.reduce((sum, phase) => sum + Number(phase.amount || 0), 0);

export const createManager = catchAsync(async (req, res) => {
  const { name, email, password, phone, category } = req.body;

  if ((!name || !email || !password, !category)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Name, email and password are required",
    );
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError(httpStatus.CONFLICT, "Manager email already exists");
  }

  const uploaded = await uploadOnCloudinary(req.file.buffer, {
    folder: "manager_avatars",
  });

  const managerUser = await User.create({
    name,
    email,
    password,
    avatar: {
      public_id: uploaded.public_id,
      url: uploaded.secure_url,
    },
    phone: phone || "",
    role: "manager",
    category,
    isEmailVerified: true,
  });

  await Manager.findOneAndUpdate(
    { user: managerUser._id },
    { user: managerUser._id },
    { upsert: true, new: true },
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Manager created successfully",
    data: {
      _id: managerUser._id,
      name: managerUser.name,
      email: managerUser.email,
      role: managerUser.role,
      avatar: managerUser.avatar,
      phone: managerUser.phone,
      category: managerUser.category,
    },
  });
});

export const getManagers = catchAsync(async (req, res) => {
  const managers = await User.find({ role: "manager", isActive: true })
    .select("name email phone avatar assignedProjects createdAt")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Managers fetched",
    data: managers,
  });
});

export const deleteManager = catchAsync(async (req, res) => {
  const { managerId } = req.params;

  const manager = await User.findOne({
    _id: managerId,
    role: "manager",
    isActive: true,
  });

  if (!manager) {
    throw new AppError(httpStatus.NOT_FOUND, "Manager not found");
  }

  await Promise.all([
    User.findByIdAndUpdate(managerId, {
      $set: {
        isActive: false,
        refreshToken: "",
      },
    }),
    Manager.deleteOne({ user: managerId }),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Manager deleted successfully",
    data: null,
  });
});

export const createProject = catchAsync(async (req, res) => {
  const {
    projectName,
    category,
    phases = [],
    startDate,
    endDate,
    address,
    siteManagerId,
    clientName,
    clientEmail,
    clientPassword,
  } = req.body;

  const missingFields = [
    !String(projectName || "").trim() ? "projectName" : null,
    !String(category || "").trim() ? "category" : null,
    !String(startDate || "").trim() ? "startDate" : null,
    !String(endDate || "").trim() ? "endDate" : null,
    !String(address || "").trim() ? "address" : null,
    !String(siteManagerId || "").trim() ? "siteManagerId" : null,
    !String(clientName || "").trim() ? "clientName" : null,
    !String(clientEmail || "").trim() ? "clientEmail" : null,
  ].filter(Boolean);

  if (missingFields.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Missing required project fields: ${missingFields.join(", ")}`,
    );
  }

  const manager = await User.findOne({ _id: siteManagerId, role: "manager" });
  if (!manager) {
    throw new AppError(httpStatus.NOT_FOUND, "Assigned manager not found");
  }

  const normalizedPhases = normalizeProjectPhases(phases);
  const numericProjectBudget = calculateProjectBudget(normalizedPhases);

  let clientUser = await User.findOne({ email: clientEmail.toLowerCase() });
  let isNewClient = false;

  if (!clientUser) {
    if (!clientPassword) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Client password is required when creating a new client account",
      );
    }

    clientUser = await User.create({
      name: clientName,
      email: clientEmail,
      password: clientPassword,
      role: "client",
      category,
      isEmailVerified: true,
    });
    isNewClient = true;
  } else if (clientUser.role !== "client") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Provided client email belongs to a non-client account",
    );
  }

  const project = await Project.create({
    projectCode: generateProjectCode(),
    clientName,
    clientEmail: clientEmail.toLowerCase(),
    projectName,
    category,
    phases: normalizedPhases,
    projectBudget: numericProjectBudget,
    startDate,
    endDate,
    address,
    siteManager: manager._id,
    client: clientUser._id,
    createdBy: req.user._id,
  });

  await Promise.all([
    User.findByIdAndUpdate(manager._id, {
      $addToSet: { assignedProjects: project._id },
    }),
    User.findByIdAndUpdate(clientUser._id, {
      $addToSet: { assignedProjects: project._id },
    }),
  ]);

  await ensureChatRoom({
    entityId: project._id,
    entityType: "Project",
    participants: [req.user._id, manager._id, clientUser._id],
    createdBy: req.user._id,
    title: `${project.projectName} Group Chat`,
  });

  await Promise.all([
    createNotification({
      user: manager._id,
      project: project._id,
      title: "New Project Assigned",
      message: `You have been assigned to project: ${project.projectName}`,
      type: "task_assigned",
    }),
    createNotification({
      user: clientUser._id,
      project: project._id,
      title: "Project Created",
      message: `Your project "${project.projectName}" is now active`,
      type: "task_assigned",
    }),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Project created successfully",
    data: {
      project,
      clientAccount: {
        isNewClient,
        email: clientUser.email,
        name: clientUser.name,
        category: clientUser.category,
      },
    },
  });
});

export const updateProject = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const {
    clientName,
    projectName,
    category,
    phases = [],
    startDate,
    endDate,
    address,
    siteManagerId,
  } = req.body;

  const missingFields = [
    !String(clientName || "").trim() ? "clientName" : null,
    !String(projectName || "").trim() ? "projectName" : null,
    !String(category || "").trim() ? "category" : null,
    !String(startDate || "").trim() ? "startDate" : null,
    !String(endDate || "").trim() ? "endDate" : null,
    !String(address || "").trim() ? "address" : null,
    !String(siteManagerId || "").trim() ? "siteManagerId" : null,
  ].filter(Boolean);

  if (missingFields.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Missing required project fields: ${missingFields.join(", ")}`,
    );
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, "Project not found");
  }

  const manager = await User.findOne({ _id: siteManagerId, role: "manager" });
  if (!manager) {
    throw new AppError(httpStatus.NOT_FOUND, "Assigned manager not found");
  }

  const normalizedPhases = normalizeProjectPhases(phases,project.phases);
  const previousManagerId = project.siteManager?.toString();

  project.clientName = String(clientName).trim();
  project.projectName = String(projectName).trim();
  project.category = String(category).trim();
  project.phases = normalizedPhases;
  project.projectBudget = calculateProjectBudget(normalizedPhases);
  project.startDate = startDate;
  project.endDate = endDate;
  project.address = String(address).trim();
  project.siteManager = manager._id;

  await project.save();

  await Promise.all([
    User.findByIdAndUpdate(manager._id, {
      $addToSet: { assignedProjects: project._id },
    }),
    project.client
      ? User.findByIdAndUpdate(project.client, {
          $set: { name: project.clientName },
          $addToSet: { assignedProjects: project._id },
        })
      : Promise.resolve(),
  ]);

  if (previousManagerId && previousManagerId !== manager._id.toString()) {
    await User.findByIdAndUpdate(previousManagerId, {
      $pull: { assignedProjects: project._id },
    });
  }

  const groupChat = await ensureChatRoom({
    entityId: project._id,
    entityType: "Project",
    participants: [project.createdBy, manager._id, project.client].filter(
      Boolean,
    ),
    createdBy: project.createdBy,
    title: `${project.projectName} Group Chat`,
  });

  groupChat.participants = [
    ...new Set([
      ...(groupChat.participants || []).map((id) => id.toString()),
      manager._id.toString(),
      project.createdBy.toString(),
      project.client?.toString(),
    ].filter(Boolean)),
  ];
  await groupChat.save();

  if (previousManagerId && previousManagerId !== manager._id.toString()) {
    await createNotification({
      user: manager._id,
      project: project._id,
      title: "Project Assignment Updated",
      message: `You are now assigned to "${project.projectName}"`,
      type: "task_assigned",
    });
  }

  const updatedProject = await Project.findById(project._id)
    .populate("siteManager", "name email")
    .populate("client", "name email");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project updated successfully",
    data: updatedProject,
  });
});

export const assignManagerToProject = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const { siteManagerId } = req.body;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, "Project not found");
  }

  const manager = await User.findOne({ _id: siteManagerId, role: "manager" });
  if (!manager) {
    throw new AppError(httpStatus.NOT_FOUND, "Manager not found");
  }

  const previousManager = project.siteManager?.toString();
  project.siteManager = manager._id;
  await project.save();

  await User.findByIdAndUpdate(manager._id, {
    $addToSet: { assignedProjects: project._id },
  });
  if (previousManager && previousManager !== manager._id.toString()) {
    await User.findByIdAndUpdate(previousManager, {
      $pull: { assignedProjects: project._id },
    });
  }

  const groupChat = await ensureChatRoom({
    entityId: project._id,
    entityType: "Project",
    participants: [project.createdBy, manager._id, project.client],
    createdBy: project.createdBy,
    title: `${project.projectName} Group Chat`,
  });

  groupChat.participants = [
    ...new Set([
      ...(groupChat.participants || []).map((id) => id.toString()),
      manager._id.toString(),
      project.client.toString(),
      project.createdBy.toString(),
    ]),
  ];
  await groupChat.save();

  await createNotification({
    user: manager._id,
    project: project._id,
    title: "Project Assignment Updated",
    message: `You are now assigned to "${project.projectName}"`,
    type: "task_assigned",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Manager assigned successfully",
    data: project,
  });
});

export const getAllProjects = catchAsync(async (req, res) => {
  const { status, search, manager } = req.query;
  const query = {};

  if (status) {
    query.projectStatus = status;
  }

  if (search) {
    query.$text = { $search: search };
  }

  if (manager) {
    query.siteManager = manager;
  }

  const projects = await Project.find(query)
    .populate("siteManager", "name email")
    .populate("client", "name email")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Projects fetched",
    data: projects,
  });
});

export const getFinancialOverview = catchAsync(async (req, res) => {
  const projects = await Project.find({}).populate("client")

  const totals = projects.reduce(
    (acc, project) => {
      acc.totalBudget += Number(project.projectBudget || 0);
      acc.totalPaid += Number(project.totalPaid || 0);
      acc.remainingBalance += Number(project.remainingBudget || 0);
      return acc;
    },
    { totalBudget: 0, totalPaid: 0, remainingBalance: 0 },
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Financial overview fetched",
    data: {
      totals,
      projects,
    },
  });
});
