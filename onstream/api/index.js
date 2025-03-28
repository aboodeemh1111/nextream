const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const authRoute = require("./routes/auth");
const userRoute = require("./routes/users");
const movieRoute = require("./routes/movies");
const listRoute = require("./routes/lists");
const adminRoute = require("./routes/admin");
const analyticsRoute = require("./routes/analytics");
const reviewRoute = require("./routes/reviews");
const commentRoute = require("./routes/comments");
const seasonsRoute = require("./routes/seasons");
const episodesRoute = require("./routes/episodes");

dotenv.config();

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: "streamo",
  })
  .then(() => {
    console.log("DB Connection Successful");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Configure CORS
const allowedOrigins = [
  "https://nextream-client.vercel.app",
  "https://nextream-admin.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        console.log(`Origin ${origin} not allowed by CORS`);
        return callback(null, true); // Allow all origins in production for now
      }

      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "token",
    ],
  })
);

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${
      req.headers.origin || "No origin"
    }`
  );
  if (req.headers.token) {
    console.log(
      "Request with token:",
      req.headers.token.substring(0, 20) + "..."
    );
  }
  next();
});

app.use(express.json());

// Create a public directory for static files if it doesn't exist
const publicDir = path.join(__dirname, "public");
const imagesDir = path.join(publicDir, "images");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
  console.log("Created public directory");
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
  console.log("Created images directory");
}

// Serve static files from the public directory
app.use(express.static(publicDir));

// API routes
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/movies", movieRoute);
app.use("/api/lists", listRoute);
app.use("/api/admin", adminRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/comments", commentRoute);
app.use("/api/seasons", seasonsRoute);
app.use("/api/episodes", episodesRoute);

// Also mount routes without /api prefix for direct access
app.use("/auth", authRoute);
app.use("/users", userRoute);
app.use("/movies", movieRoute);
app.use("/lists", listRoute);
app.use("/admin", adminRoute);
app.use("/analytics", analyticsRoute);
app.use("/reviews", reviewRoute);
app.use("/comments", commentRoute);

// Basic route for health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Nextream API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Route to check if images are available
app.get("/images-info", (req, res) => {
  try {
    const images = fs.readdirSync(imagesDir);
    res.json({
      status: "ok",
      imagesDirectory: imagesDir,
      imagesCount: images.length,
      images: images,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Error reading images directory",
      error: err.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      status: err.status || 500,
    },
  });
});

// Handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: {
      message: `Not Found: ${req.method} ${req.url}`,
      status: 404,
    },
  });
});

const PORT = process.env.PORT || 8800;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}!`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
  console.log(`Static files directory: ${publicDir}`);
});
