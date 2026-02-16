import { Schema, model } from "mongoose";

const projectUpdateSchema = new Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    images: [
      {
        public_id: String,
        url: String,
      },
    ],

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    stats: {
      shareCount: {
        type: Number,
        default: 0,
      },
      commentCount: {
        type: Number,
        default: 0,
      },
      likeCount: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true },
);

projectUpdateSchema.index({ project: 1, createdAt: -1 });

export const ProjectUpdate = model("ProjectUpdate", projectUpdateSchema);
