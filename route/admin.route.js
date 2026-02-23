import express from "express";
import {
  assignManagerToProject,
  createManager,
  createProject,
  getAllProjects,
  getFinancialOverview,
  getManagers,
} from "../controller/admin.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

router.use(protect, isAdmin);

router.post("/managers", upload.single("avatar"), createManager);
router.get("/managers", getManagers);

router.post("/projects", createProject);
router.get("/projects", getAllProjects);
router.patch("/projects/:projectId/assign-manager", assignManagerToProject);

router.get("/financial-overview", getFinancialOverview);

export default router;
