import express from "express";

import authRoute from "../route/auth.route.js";
import userRoute from "../route/user.route.js";
import adminDashboardRoute from "../route/admin.route.js";

const router = express.Router();

// Mounting the routes
router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/admin/dashboard", adminDashboardRoute);

export default router;
