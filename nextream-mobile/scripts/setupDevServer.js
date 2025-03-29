/**
 * Development proxy server to handle CORS for the Nextream Mobile app
 */
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const app = express();
const port = 3001;

// Enable CORS for all routes
app.use(
  cors({
    origin: "*", // In production you'd limit this
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Proxy all API requests to the actual API
app.use(
  "/api",
  createProxyMiddleware({
    target: "https://nextream-api.onrender.com",
    changeOrigin: true,
    pathRewrite: {
      "^/api": "/api", // No path rewriting needed
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({ error: "Proxy error", message: err.message });
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add cors headers to the proxied response
      proxyRes.headers["Access-Control-Allow-Origin"] = "*";
      proxyRes.headers["Access-Control-Allow-Methods"] =
        "GET, POST, PUT, DELETE, OPTIONS";
      proxyRes.headers["Access-Control-Allow-Headers"] =
        "Content-Type, Authorization";
    },
  })
);

// Fallback route
app.get("/", (req, res) => {
  res.send("Nextream Mobile Development Proxy Server");
});

// Start the server
app.listen(port, () => {
  console.log(`Dev proxy server running at http://localhost:${port}`);
  console.log(
    `API requests will be proxied to https://nextream-api.onrender.com`
  );
});
