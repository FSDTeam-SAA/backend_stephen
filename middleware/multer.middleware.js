import multer from "multer";

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const isAllowed =
    String(file.mimetype || "").startsWith("image/") ||
    file.mimetype === "application/pdf";

  if (!isAllowed) {
    cb(new Error("Only image or PDF files are allowed"), false);
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export default upload;
