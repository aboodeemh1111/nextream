const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");
const CryptoJS = require("crypto-js");

dotenv.config();

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  })
  .then(() => console.log("DB Connection Successful for Seeding"))
  .catch((err) => {
    console.error(err);
  });

// Create admin user
const createAdminUser = async () => {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: "admin@example.com" });
    if (existingAdmin) {
      console.log("Admin user already exists");
      return;
    }

    // Create new admin user
    const adminUser = new User({
      username: "admin",
      email: "admin@example.com",
      password: CryptoJS.AES.encrypt(
        "password",
        process.env.SECRET_KEY
      ).toString(),
      profilePic: "",
      isAdmin: true,
    });

    await adminUser.save();
    console.log("Admin user created successfully");
  } catch (err) {
    console.error("Error creating admin user:", err);
  }
};

// Create test user
const createTestUser = async () => {
  try {
    // Check if test user already exists
    const existingUser = await User.findOne({ email: "user@example.com" });
    if (existingUser) {
      console.log("Test user already exists");
      return;
    }

    // Create new test user
    const testUser = new User({
      username: "testuser",
      email: "user@example.com",
      password: CryptoJS.AES.encrypt(
        "password",
        process.env.SECRET_KEY
      ).toString(),
      profilePic: "",
      isAdmin: false,
    });

    await testUser.save();
    console.log("Test user created successfully");
  } catch (err) {
    console.error("Error creating test user:", err);
  }
};

// Run seed functions
const seedDatabase = async () => {
  await createAdminUser();
  await createTestUser();
  
  // Disconnect from database
  mongoose.disconnect();
  console.log("Database seeding completed");
};

// Run the seed function
seedDatabase(); 