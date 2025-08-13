const mongoose = require("mongoose");

const ListSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true },
    type: { type: String }, // movie, series, or both
    genre: { type: String },
    content: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie' }]
  },
  { 
    timestamps: true,
    collection: 'lists'
  }
);

// Performance indexes
ListSchema.index({ type: 1, genre: 1 });
ListSchema.index({ title: 1 });

module.exports = mongoose.model("List", ListSchema);
