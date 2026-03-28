import cron from "node-cron";
import { Project } from "../model/project.model.js";
import { syncAutoProgressForProject } from "./projectAutoProgress.js";

const isCronEnabled = () =>
  String(process.env.AUTO_PROGRESS_CRON_ENABLED || "true").toLowerCase() !== "false";

const shouldRunOnBoot = () =>
  String(process.env.AUTO_PROGRESS_RUN_ON_STARTUP || "true").toLowerCase() !== "false";

const getCronSchedule = () => process.env.AUTO_PROGRESS_CRON_SCHEDULE || "5 0 * * *";

const getCronTimezone = () => process.env.AUTO_PROGRESS_CRON_TIMEZONE || "Asia/Dhaka";

export const runProjectAutoProgressSync = async (trigger = "cron") => {
  const projects = await Project.find({ projectStatus: "active" });

  let updatedCount = 0;
  for (const project of projects) {
    const result = await syncAutoProgressForProject(project, { trigger });
    if (result.updated) {
      updatedCount += 1;
    }
  }

  return {
    scannedCount: projects.length,
    updatedCount,
  };
};

export const startProjectAutoProgressCron = () => {
  if (!isCronEnabled()) {
    console.log("Auto progress cron disabled");
    return;
  }

  const schedule = getCronSchedule();
  const timezone = getCronTimezone();

  cron.schedule(
    schedule,
    async () => {
      try {
        const stats = await runProjectAutoProgressSync("cron");
        console.log(
          `[AutoProgress][cron] scanned=${stats.scannedCount} updated=${stats.updatedCount}`,
        );
      } catch (error) {
        console.error("[AutoProgress][cron] failed:", error);
      }
    },
    { timezone },
  );

  console.log(`Auto progress cron started on "${schedule}" (${timezone})`);
};

export const runAutoProgressSyncOnStartup = async () => {
  if (!isCronEnabled() || !shouldRunOnBoot()) {
    return;
  }

  try {
    const stats = await runProjectAutoProgressSync("startup");
    console.log(
      `[AutoProgress][startup] scanned=${stats.scannedCount} updated=${stats.updatedCount}`,
    );
  } catch (error) {
    console.error("[AutoProgress][startup] failed:", error);
  }
};
