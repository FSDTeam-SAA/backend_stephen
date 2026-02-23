import mongoose, { Schema, model } from "mongoose";

const updateImageSchema = new Schema(
  {
    public_id: { type: String, default: "" },
    url: { type: String, required: true },
  },
  { _id: false },
);

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
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    images: [updateImageSchema],

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
projectUpdateSchema.index({ uploadedBy: 1, createdAt: -1 });

projectUpdateSchema.pre("save", function (next) {
  this.stats.likeCount = this.likes.length;
  next();
});

export const ProjectUpdate = model("ProjectUpdate", projectUpdateSchema);
