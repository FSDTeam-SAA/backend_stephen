import { Schema, model } from "mongoose";

const documentSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["drawings", "invoices", "reports", "contracts"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    document: {
      public_id: { type: String, default: "" },
      url: { type: String, required: true },
    },
    meta: {
      fileName: { type: String, trim: true, default: "" },
      size: { type: Number, default: 0 },
      mimeType: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true },
);

documentSchema.index({ project: 1, createdAt: -1 });

export const Document = model("Document", documentSchema);
