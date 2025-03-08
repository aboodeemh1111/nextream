const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");
const CryptoJS = require("crypto-js");

dotenv.config();

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'netflix'
  })
  .then(async () => {
    console.log("DB Connected for seeding");
    
    try {
      // Create admin user if it doesn't exist
      const adminExists = await User.findOne({ email: "admin@example.com" });
      
      if (!adminExists) {
        const adminUser = new User({
          username: "admin",
          email: "admin@example.com",
          password: CryptoJS.AES.encrypt("admin123", process.env.SECRET_KEY).toString(),
          isAdmin: true,
        });
        
        await adminUser.save();
        console.log("Admin user created successfully");
      }
      
      process.exit(0);
    } catch (error) {
      console.error("Seeding error:", error);
      process.exit(1);
    }
  }); 