import express from "express";
import {
  approveTask,
  createTask,
  getTaskDetails,
  getTasks,
  rejectTask,
  resubmitTaskForApproval,
  updateTaskByManager,
  updateTaskStatus,
} from "../controller/task.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createTask);
router.get("/", getTasks);
router.get("/:taskId", getTaskDetails);
router.patch("/:taskId", updateTaskByManager);
router.patch("/:taskId/resubmit", resubmitTaskForApproval);
router.patch("/:taskId/approve", approveTask);
router.patch("/:taskId/reject", rejectTask);
router.patch("/:taskId/status", updateTaskStatus);

export default router;
