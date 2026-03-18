import express from "express";
import {
  addUpdateComment,
  createProjectUpdate,
  getProjectUpdates,
  getUpdateComments,
  shareProjectUpdate,
  toggleUpdateLike,
  updateProjectUpdate,
} from "../controller/projectUpdate.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();
const updateMediaUpload = upload.fields([
  { name: "images", maxCount: 10 },
  { name: "videos", maxCount: 5 },
  { name: "media", maxCount: 15 },
]);

router.use(protect);

router.post("/", updateMediaUpload, createProjectUpdate);
router.patch("/:updateId", updateMediaUpload, updateProjectUpdate);
router.get("/project/:projectId", getProjectUpdates);
router.patch("/:updateId/like", toggleUpdateLike);
router.post("/:updateId/share", shareProjectUpdate);
router.post("/:updateId/comments", addUpdateComment);
router.get("/:updateId/comments", getUpdateComments);

export default router;
