const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g., CHURN_SPIKE, PAYMENT_FAILURES, QOE_DEGRADATION
    severity: { type: String, default: "info" }, // info | warning | critical
    title: { type: String, required: true },
    message: { type: String },
    data: { type: Object },
    status: { type: String, default: "open" }, // open | acknowledged | resolved
    createdByRule: { type: String }, // rule name/id
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

AlertSchema.index({ createdAt: -1 });
AlertSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model("Alert", AlertSchema);


