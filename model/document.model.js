import { Schema, model } from "mongoose";

const projectUpdateSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    category: {
      type: String,
      enum: ["drawings", "invoices", "reports", "contracts"],
      required: true,
    },
    document: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export const Document = model("Document", projectUpdateSchema);
