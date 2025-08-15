const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    title: { type: String },
    body: { type: String },
    icon: { type: String },
    image: { type: String },
    deepLink: { type: String },
    topic: { type: String },
    data: { type: Object, default: {} },
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "opened"],
      default: "queued",
    },
    read: { type: Boolean, default: false },
    sentAt: { type: Date },
    openedAt: { type: Date },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);


