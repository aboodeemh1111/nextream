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

module.exports = mongoose.model("List", ListSchema);
