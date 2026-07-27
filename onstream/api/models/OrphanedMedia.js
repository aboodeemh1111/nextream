const mongoose = require("mongoose");

// Legacy Firebase blobs cannot be deleted from here: the backend has no Firebase
// Storage credentials and deliberately should not get any. When a document that
// still points at Firebase is deleted, the URL is recorded here instead so the
// blobs can be cleaned up out of band once the backfill is done.
const OrphanedMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, index: true },
    model: { type: String },
    docId: { type: String },
    field: { type: String },
    reason: { type: String, default: "document-deleted" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrphanedMedia", OrphanedMediaSchema);
