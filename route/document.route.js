import express from "express";
import { getProjectDocuments, uploadProjectDocument } from "../controller/document.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadDocumentFile } from "../middleware/multer.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", uploadDocumentFile.single("document"), uploadProjectDocument);
router.get("/project/:projectId", getProjectDocuments);

export default router;
