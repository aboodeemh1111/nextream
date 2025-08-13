const router = require("express").Router();
const verify = require("../verifyToken");
const Alert = require("../models/Alert");

// List alerts (admin)
router.get("/", verify, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
  try {
    const { status, type, page = 1, pageSize = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    const size = Math.min(Math.max(parseInt(pageSize, 10), 1), 200);
    const p = Math.max(parseInt(page, 10), 1);
    const [data, total] = await Promise.all([
      Alert.find(query).sort({ createdAt: -1 }).skip((p - 1) * size).limit(size).lean(),
      Alert.countDocuments(query),
    ]);
    res.status(200).json({ data, page: p, pageSize: size, total });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Create alert (admin)
router.post("/", verify, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
  try {
    const alert = await Alert.create(req.body);
    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Update alert status (admin)
router.put("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json("You are not allowed!");
  try {
    const update = { ...req.body };
    if (update.status === "acknowledged") update.acknowledgedAt = new Date();
    if (update.status === "resolved") update.resolvedAt = new Date();
    const alert = await Alert.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    res.status(200).json(alert);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;


