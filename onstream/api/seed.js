const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");
const CryptoJS = require("crypto-js");

dotenv.config();

// Create or update admin user with known seed credentials
const createAdminUser = async () => {
  try {
    const email = "admin@example.com";
    const username = "admin";
    const password = CryptoJS.AES.encrypt(
      "password",
      process.env.SECRET_KEY
    ).toString();

    const existingAdmin = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingAdmin) {
      existingAdmin.username = username;
      existingAdmin.email = email;
      existingAdmin.password = password;
      existingAdmin.isAdmin = true;
      await existingAdmin.save();
      console.log("Admin user updated successfully");
      return;
    }

    const adminUser = new User({
      username,
      email,
      password,
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
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: "streamo",
  });
  console.log("DB Connection Successful for Seeding");

  await createAdminUser();
  await createTestUser();

  await mongoose.disconnect();
  console.log("Database seeding completed");
};

seedDatabase().catch((err) => {
  console.error(err);
  process.exit(1);
});
