const jwt = require("jsonwebtoken");

function verify(req, res, next) {
  console.log(`Verifying token for ${req.method} ${req.originalUrl}...`);
  
  const authHeader = req.headers.token;
  if (!authHeader) {
    console.log(`Authentication failed: No token provided for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      message: "You are not authenticated. Please log in.",
      error: "No token provided"
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    if (!token) {
      console.log(`Authentication failed: Invalid token format for ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        message: "Invalid authentication token format.",
        error: "Invalid token format"
      });
    }
    
    console.log(`Processing token: ${token.substring(0, 15)}...`);
    
    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          console.error(`Token expired for ${req.method} ${req.originalUrl}`);
          return res.status(401).json({
            message: "Your session has expired. Please log in again.",
            error: "Token expired"
          });
        } else {
          console.error(`Invalid token for ${req.method} ${req.originalUrl}:`, err.message);
          return res.status(403).json({
            message: "Invalid authentication token.",
            error: err.message
          });
        }
      }
      
      console.log(`Token verified successfully for user ID: ${user.id}, isAdmin: ${user.isAdmin}`);
      req.user = user;
      next();
    });
  } catch (err) {
    console.error(`Error processing token for ${req.method} ${req.originalUrl}:`, err);
    return res.status(500).json({
      message: "Authentication error. Please try again.",
      error: err.message
    });
  }
}

module.exports = verify;
