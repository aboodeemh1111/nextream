const router = require("express").Router();
const Movie = require("../models/Movie");
const User = require("../models/User");
const List = require("../models/List");
const verify = require("../verifyToken");

// GET DASHBOARD STATS
router.get("/stats", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json("You are not allowed!");
  }

  try {
    // Get user count and new users
    const totalUsers = await User.countDocuments();
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const newUsers = await User.countDocuments({
      createdAt: { $gte: lastMonth }
    });

    const previousMonthUsers = await User.countDocuments({
      createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
    });

    const newUsersChange = previousMonthUsers > 0 
      ? ((newUsers - previousMonthUsers) / previousMonthUsers) * 100 
      : 100;

    // Get movie count
    const totalMovies = await Movie.countDocuments();

    // Get list count
    const totalLists = await List.countDocuments();

    // Calculate total views (sum of views across all movies)
    const viewsAggregation = await Movie.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$views" }
        }
      }
    ]);
    const totalViews = viewsAggregation.length > 0 ? viewsAggregation[0].totalViews : 0;

    // Get popular movies
    const popularMovies = await Movie.find()
      .sort({ views: -1 })
      .limit(5)
      .select("_id title views img");

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id username email profilePic createdAt isAdmin");

    res.status(200).json({
      userCount: totalUsers,
      movieCount: totalMovies,
      listCount: totalLists,
      totalViews: totalViews,
      newUsers: newUsers,
      newUsersChange: newUsersChange,
      popularMovies: popularMovies,
      recentUsers: recentUsers
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({
      error: "Failed to fetch dashboard statistics",
      details: err.message
    });
  }
});

module.exports = router; 