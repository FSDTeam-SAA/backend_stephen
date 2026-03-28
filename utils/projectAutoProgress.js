const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

export const calculateAutoProgressPercent = ({
  startDate,
  endDate,
  now = new Date(),
}) => {
  const normalizedStartDate = toUtcDateOnly(startDate);
  const normalizedEndDate = toUtcDateOnly(endDate);
  const normalizedToday = toUtcDateOnly(now);

  if (!normalizedStartDate || !normalizedEndDate || !normalizedToday) {
    return 0;
  }

  if (normalizedEndDate < normalizedStartDate) {
    return 0;
  }

  if (normalizedToday < normalizedStartDate) {
    return 0;
  }

  if (normalizedToday >= normalizedEndDate) {
    return 100;
  }

  const totalDays =
    Math.floor((normalizedEndDate.getTime() - normalizedStartDate.getTime()) / MS_PER_DAY) + 1;
  const elapsedDays =
    Math.floor((normalizedToday.getTime() - normalizedStartDate.getTime()) / MS_PER_DAY) + 1;

  if (totalDays <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
};

const AUTO_PROGRESS_NAME = "Auto Timeline Progress";

export const syncAutoProgressForProject = async (
  project,
  {
    updatedBy,
    trigger = "cron",
    now = new Date(),
  } = {},
) => {
  const currentPercent = Number(project.progress || 0);
  const calculatedPercent = calculateAutoProgressPercent({
    startDate: project.startDate,
    endDate: project.endDate,
    now,
  });
  const nextPercent = Math.max(currentPercent, calculatedPercent);

  if (currentPercent === nextPercent) {
    return {
      updated: false,
      previousPercent: currentPercent,
      nextPercent,
      project,
    };
  }

  const actorId = updatedBy || project.createdBy || project.siteManager || project.client;
  if (!actorId) {
    return {
      updated: false,
      previousPercent: currentPercent,
      nextPercent,
      project,
    };
  }

  project.progressUpdates.push({
    progressName: AUTO_PROGRESS_NAME,
    percent: nextPercent,
    note: `Auto day-wise update (${trigger})`,
    updatedBy: actorId,
    updatedAt: now,
  });

  if (nextPercent >= 100) {
    project.projectStatus = "finished";
  }

  await project.save();

  return {
    updated: true,
    previousPercent: currentPercent,
    nextPercent,
    project,
  };
};
