const jwt = require("jsonwebtoken");

function verify(req, res, next) {
  console.log('Verifying token...');
  console.log('Headers:', req.headers);
  
  const authHeader = req.headers.token;
  if (!authHeader) {
    console.log('No token found in headers');
    return res.status(401).json("You are not authenticated!");
  }

  try {
    const token = authHeader.split(" ")[1];
    console.log('Token:', token.substring(0, 20) + '...');
    
    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
      if (err) {
        console.error('Token verification failed:', err);
        return res.status(403).json("Token is not valid!");
      }
      
      console.log('Token verified successfully. User:', user);
      req.user = user;
      next();
    });
  } catch (err) {
    console.error('Error processing token:', err);
    return res.status(403).json("Token is not valid!");
  }
}

module.exports = verify;
