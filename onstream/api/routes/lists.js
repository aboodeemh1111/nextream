const router = require("express").Router();
const List = require("../models/List");
const verify = require("../verifyToken");
const AuditLog = require("../models/AuditLog");

// CREATE LIST
router.post("/", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  const newList = new List(req.body);
  try {
    const savedList = await newList.save();
    // Audit log
    try {
      await AuditLog.create({
        userId: req.user.id,
        action: "LIST_CREATE",
        entityType: "List",
        entityId: savedList._id.toString(),
        metadata: { body: req.body },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch {}
    res.status(201).json(savedList);
  } catch (err) {
    res.status(500).json(err);
  }
});

// UPDATE LIST
router.put("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    const updatedList = await List.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).populate('content');
    // Audit log
    try {
      await AuditLog.create({
        userId: req.user.id,
        action: "LIST_UPDATE",
        entityType: "List",
        entityId: req.params.id,
        metadata: { body: req.body },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch {}
    res.status(200).json(updatedList);
  } catch (err) {
    res.status(500).json(err);
  }
});

// DELETE LIST
router.delete("/:id", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    await List.findByIdAndDelete(req.params.id);
    try {
      await AuditLog.create({
        userId: req.user.id,
        action: "LIST_DELETE",
        entityType: "List",
        entityId: req.params.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch {}
    res.status(200).json("The list has been deleted");
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET LIST BY ID
router.get("/find/:id", verify, async (req, res) => {
  try {
    const list = await List.findById(req.params.id).populate('content');
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET ALL LISTS (FOR ADMIN) with pagination
router.get("/all", verify, async (req, res) => {
  try {
    // Log the request for debugging
    console.log(`GET /lists/all request from user ID: ${req.user.id}, isAdmin: ${req.user.isAdmin}`);
    
    if (!req.user.isAdmin) {
      console.log(`Access denied for user ${req.user.id} - not an admin`);
      return res.status(403).json({
        message: "You are not allowed to access this resource. Admin privileges required.",
        error: "Forbidden"
      });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || "50", 10), 1), 200);
    const [lists, total] = await Promise.all([
      List.find().populate('content').sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      List.countDocuments(),
    ]);
    console.log(`Successfully retrieved ${lists.length} lists for admin user ${req.user.id}`);
    res.status(200).json({ data: lists, page, pageSize, total });
  } catch (err) {
    console.error(`Error in GET /lists/all:`, err);
    res.status(500).json({
      message: "Failed to retrieve lists",
      error: err.message
    });
  }
});

// GET LISTS BY TYPE AND/OR GENRE (FOR USERS)
router.get("/", verify, async (req, res) => {
  const typeQuery = req.query.type;
  const genreQuery = req.query.genre;
  try {
    let lists;
    if (typeQuery && genreQuery) {
      lists = await List.find({
        type: typeQuery,
        genre: genreQuery
      }).populate('content').limit(10);
    } else if (typeQuery) {
      lists = await List.find({
        type: typeQuery
      }).populate('content').limit(10);
    } else {
      lists = await List.find().populate('content').limit(10);
    }
    res.status(200).json(lists);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ADD MOVIE TO LIST
router.post("/:listId/movies/:movieId", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    const list = await List.findById(req.params.listId);
    if (!list.content.includes(req.params.movieId)) {
      await List.findByIdAndUpdate(
        req.params.listId,
        { $push: { content: req.params.movieId } },
        { new: true }
      );
      res.status(200).json("Movie has been added to the list");
    } else {
      res.status(400).json("Movie already in the list");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// REMOVE MOVIE FROM LIST
router.delete("/:listId/movies/:movieId", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    await List.findByIdAndUpdate(
      req.params.listId,
      { $pull: { content: req.params.movieId } }
    );
    res.status(200).json("Movie has been removed from the list");
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
