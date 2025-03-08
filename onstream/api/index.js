const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const authRoute = require("./routes/auth");
const userRoute = require("./routes/users");
const movieRoute = require("./routes/movies");
const listRoute = require("./routes/lists");
const adminRoute = require("./routes/admin");
const analyticsRoute = require("./routes/analytics");

dotenv.config();

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: 'streamo'
  })
  .then(() => {
    console.log("DB Connection Successful");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Add CORS headers
app.use((req, res, next) => {
  // Allow requests from your frontend domains
  const allowedOrigins = [
    'https://nextream-client.vercel.app',
    'https://nextream-admin.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, token");
  
  // Log incoming requests for debugging
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.headers.token) {
    console.log('Request with token:', req.headers.token.substring(0, 20) + '...');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json());

app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/movies", movieRoute);
app.use("/api/lists", listRoute);
app.use("/api/admin", adminRoute);
app.use("/api/analytics", analyticsRoute);

// Basic route for health check
app.get('/', (req, res) => {
  res.send('Nextream API is running');
});

const PORT = process.env.PORT || 8800;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}!`);
});
