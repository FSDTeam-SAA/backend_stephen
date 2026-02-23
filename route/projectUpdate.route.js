import express from "express";
import {
  addUpdateComment,
  createProjectUpdate,
  getProjectUpdates,
  getUpdateComments,
  shareProjectUpdate,
  toggleUpdateLike,
} from "../controller/projectUpdate.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", upload.array("images", 10), createProjectUpdate);
router.get("/project/:projectId", getProjectUpdates);
router.patch("/:updateId/like", toggleUpdateLike);
router.post("/:updateId/share", shareProjectUpdate);
router.post("/:updateId/comments", addUpdateComment);
router.get("/:updateId/comments", getUpdateComments);

export default router;
