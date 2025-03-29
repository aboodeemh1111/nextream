// This file will be used to configure a local proxy if needed
const cors = require("cors");

// Export CORS middleware that can be used in a local development server
const corsMiddleware = cors({
  origin: "*", // Allow all origins during development
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

module.exports = {
  corsMiddleware,
};
