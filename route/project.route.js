import express from "express";
import {
  addProjectProgressUpdate,
  getProjectDetails,
  getProjectFinancialSummary,
  getProjects,
  updatePhasePaymentStatus,
  updateProjectStatus,
} from "../controller/project.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getProjects);
router.get("/:projectId", getProjectDetails);
router.patch("/:projectId/status", updateProjectStatus);
router.post("/:projectId/progress", addProjectProgressUpdate);
router.patch("/:projectId/phase-payment", updatePhasePaymentStatus);
router.get("/:projectId/financial-summary", getProjectFinancialSummary);

export default router;
