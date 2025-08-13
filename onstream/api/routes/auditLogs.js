const router = require("express").Router();
const verify = require("../verifyToken");
const AuditLog = require("../models/AuditLog");

// List audit logs (admin)
router.get("/", verify, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
  try {
    const { action, entityType, page = 1, pageSize = 50 } = req.query;
    const query = {};
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    const size = Math.min(Math.max(parseInt(pageSize, 10), 1), 200);
    const p = Math.max(parseInt(page, 10), 1);
    const [data, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip((p - 1) * size).limit(size).lean(),
      AuditLog.countDocuments(query),
    ]);
    res.status(200).json({ data, page: p, pageSize: size, total });
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;


