const router = require("express").Router();
const User = require("../models/User");
const Movie = require("../models/Movie");
const verify = require("../verifyToken");
const mongoose = require("mongoose");

// Helper function to get date range
const getDateRange = (period) => {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'day':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case '6months':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 6);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1); // Default to 1 month
  }
  
  return { startDate, endDate: now };
};

// GET USER ENGAGEMENT METRICS
router.get("/user-engagement", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      message: "You are not allowed to access this resource. Admin privileges required.",
      error: "Forbidden"
    });
  }

  try {
    const period = req.query.period || 'month'; // Default to month
    const { startDate, endDate } = getDateRange(period);
    
    // Get active users (users who have logged in within the period)
    const activeUsers = await User.countDocuments({
      updatedAt: { $gte: startDate, $lte: endDate }
    });
    
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Calculate average watch time per user
    // This assumes you have a watchHistory field in your User model with timestamps
    const usersWithWatchHistory = await User.find({
      'watchHistory.0': { $exists: true }
    });
    
    let totalWatchTime = 0;
    let totalCompletions = 0;
    let totalStarts = 0;
    
    usersWithWatchHistory.forEach(user => {
      if (user.watchHistory && user.watchHistory.length > 0) {
        user.watchHistory.forEach(item => {
          if (item.watchTime) {
            totalWatchTime += item.watchTime;
          }
          if (item.completed) {
            totalCompletions++;
          }
          totalStarts++;
        });
      }
    });
    
    const avgWatchTime = usersWithWatchHistory.length > 0 
      ? totalWatchTime / usersWithWatchHistory.length 
      : 0;
    
    // Calculate completion rate
    const completionRate = totalStarts > 0 
      ? (totalCompletions / totalStarts) * 100 
      : 0;
    
    // Get most watched genres
    const genreCounts = await User.aggregate([
      { $unwind: "$watchHistory" },
      { $lookup: {
          from: "movies",
          localField: "watchHistory.movie",
          foreignField: "_id",
          as: "movieDetails"
        }
      },
      { $unwind: "$movieDetails" },
      { $group: {
          _id: "$movieDetails.genre",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Calculate watch time trends over the past 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const watchTimeTrends = await User.aggregate([
      { $unwind: "$watchHistory" },
      { $match: { "watchHistory.watchedAt": { $gte: sixMonthsAgo } } },
      { $group: {
          _id: { 
            year: { $year: "$watchHistory.watchedAt" },
            month: { $month: "$watchHistory.watchedAt" }
          },
          totalWatchTime: { $sum: "$watchHistory.watchTime" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);
    
    // Format watch time trends for easier consumption by frontend
    const formattedWatchTimeTrends = watchTimeTrends.map(item => ({
      date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      totalWatchTime: item.totalWatchTime,
      count: item.count
    }));
    
    res.status(200).json({
      activeUsers,
      totalUsers,
      avgWatchTime,
      completionRate,
      mostWatchedGenres: genreCounts,
      watchTimeTrends: formattedWatchTimeTrends
    });
  } catch (err) {
    console.error("Error fetching user engagement metrics:", err);
    res.status(500).json({
      message: "Failed to fetch user engagement metrics",
      error: err.message
    });
  }
});

// GET CONTENT PERFORMANCE INSIGHTS
router.get("/content-performance", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      message: "You are not allowed to access this resource. Admin privileges required.",
      error: "Forbidden"
    });
  }

  try {
    // Get top 10 most watched titles
    const topTitles = await Movie.find()
      .sort({ views: -1 })
      .limit(10)
      .select("_id title views img genre");
    
    // Get binge-watching behavior (movies watched in sequence by the same user)
    const bingeWatchingData = await User.aggregate([
      { $unwind: "$watchHistory" },
      { $sort: { "watchHistory.watchedAt": 1 } },
      { $group: {
          _id: "$_id",
          watchSessions: { 
            $push: {
              movie: "$watchHistory.movie",
              watchedAt: "$watchHistory.watchedAt"
            }
          }
        }
      },
      { $project: {
          _id: 1,
          sessionCount: { $size: "$watchSessions" }
        }
      },
      { $sort: { sessionCount: -1 } },
      { $limit: 10 }
    ]);
    
    // Calculate average binge-watching session length
    let totalSessions = 0;
    let totalMoviesWatched = 0;
    
    bingeWatchingData.forEach(user => {
      totalSessions++;
      totalMoviesWatched += user.sessionCount;
    });
    
    const avgBingeLength = totalSessions > 0 
      ? totalMoviesWatched / totalSessions 
      : 0;
    
    // Get drop-off points (where viewers stop watching)
    // This assumes you have a progress field in your watchHistory
    const dropOffPoints = await User.aggregate([
      { $unwind: "$watchHistory" },
      { $match: { "watchHistory.completed": false } },
      { $group: {
          _id: "$watchHistory.movie",
          avgDropOffPoint: { $avg: "$watchHistory.progress" },
          count: { $sum: 1 }
        }
      },
      { $lookup: {
          from: "movies",
          localField: "_id",
          foreignField: "_id",
          as: "movieDetails"
        }
      },
      { $unwind: "$movieDetails" },
      { $project: {
          _id: 1,
          title: "$movieDetails.title",
          avgDropOffPoint: 1,
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get genre performance
    const genrePerformance = await Movie.aggregate([
      { $group: {
          _id: "$genre",
          totalViews: { $sum: "$views" },
          avgViews: { $avg: "$views" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalViews: -1 } }
    ]);
    
    res.status(200).json({
      topTitles,
      bingeWatchingData: {
        topUsers: bingeWatchingData,
        avgBingeLength
      },
      dropOffPoints,
      genrePerformance
    });
  } catch (err) {
    console.error("Error fetching content performance insights:", err);
    res.status(500).json({
      message: "Failed to fetch content performance insights",
      error: err.message
    });
  }
});

// GET COMBINED ANALYTICS DASHBOARD DATA
router.get("/dashboard", verify, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      message: "You are not allowed to access this resource. Admin privileges required.",
      error: "Forbidden"
    });
  }

  try {
    // Get user stats
    const totalUsers = await User.countDocuments();
    const activeUsersToday = await User.countDocuments({
      updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    const activeUsersThisWeek = await User.countDocuments({
      updatedAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
    });
    const activeUsersThisMonth = await User.countDocuments({
      updatedAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
    });
    
    // Get content stats
    const totalMovies = await Movie.countDocuments();
    const totalViews = await Movie.aggregate([
      { $group: { _id: null, total: { $sum: "$views" } } }
    ]);
    
    // Get top 5 movies
    const topMovies = await Movie.find()
      .sort({ views: -1 })
      .limit(5)
      .select("_id title views img");
    
    // Get genre distribution
    const genreDistribution = await Movie.aggregate([
      { $group: {
          _id: "$genre",
          count: { $sum: 1 },
          totalViews: { $sum: "$views" }
        }
      },
      { $sort: { totalViews: -1 } }
    ]);
    
    // Get user growth over time (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
          _id: { 
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);
    
    // Format user growth for easier consumption by frontend
    const formattedUserGrowth = userGrowth.map(item => ({
      date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      count: item.count
    }));
    
    res.status(200).json({
      userStats: {
        total: totalUsers,
        dau: activeUsersToday,
        wau: activeUsersThisWeek,
        mau: activeUsersThisMonth
      },
      contentStats: {
        totalMovies,
        totalViews: totalViews.length > 0 ? totalViews[0].total : 0
      },
      topMovies,
      genreDistribution,
      userGrowth: formattedUserGrowth
    });
  } catch (err) {
    console.error("Error fetching analytics dashboard data:", err);
    res.status(500).json({
      message: "Failed to fetch analytics dashboard data",
      error: err.message
    });
  }
});

module.exports = router; 