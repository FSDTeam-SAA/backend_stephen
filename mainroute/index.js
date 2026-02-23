import express from "express";

import authRoute from "../route/auth.route.js";
import userRoute from "../route/user.route.js";
import adminRoute from "../route/admin.route.js";
import dashboardRoute from "../route/dashboard.route.js";
import projectRoute from "../route/project.route.js";
import taskRoute from "../route/task.route.js";
import projectUpdateRoute from "../route/projectUpdate.route.js";
import documentRoute from "../route/document.route.js";
import chatRoute from "../route/chat.route.js";
import notificationRoute from "../route/notification.route.js";

const router = express.Router();

// Mounting the routes
router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/admin", adminRoute);
router.use("/admin/dashboard", adminRoute);
router.use("/dashboard", dashboardRoute);
router.use("/projects", projectRoute);
router.use("/tasks", taskRoute);
router.use("/updates", projectUpdateRoute);
router.use("/documents", documentRoute);
router.use("/chats", chatRoute);
router.use("/notifications", notificationRoute);

export default router;
