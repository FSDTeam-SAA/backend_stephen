import multer from "multer";

const storage = multer.memoryStorage();

const normalizeMimeType = (value) => String(value || "").trim().toLowerCase();

const mediaFileFilter = (req, file, cb) => {
  const mimeType = normalizeMimeType(file.mimetype);
  const isAllowed =
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType === "application/pdf";

  if (!isAllowed) {
    cb(new Error("Only image, video or PDF files are allowed"), false);
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "text/plain",
  "text/csv",
]);

const DOCUMENT_EXTENSIONS_REGEX =
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|rtf|txt|csv|jpe?g|png|gif|webp|bmp|svg|mp4|mov|avi|mkv|webm)$/i;

const documentFileFilter = (req, file, cb) => {
  const mimeType = normalizeMimeType(file.mimetype);
  const originalName = String(file.originalname || "").trim().toLowerCase();
  const hasAllowedExtension = DOCUMENT_EXTENSIONS_REGEX.test(originalName);
  const isAllowed =
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    DOCUMENT_MIME_TYPES.has(mimeType) ||
    (mimeType === "application/octet-stream" && hasAllowedExtension);

  if (!isAllowed) {
    cb(
      new Error(
        "Only image, video, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT and CSV files are allowed",
      ),
      false,
    );
    return;
  }

  cb(null, true);
};

export const uploadDocumentFile = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

export default upload;
