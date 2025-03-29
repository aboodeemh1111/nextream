/**
 * Helper script to start the app with mock data
 */
const { execSync } = require("child_process");

console.log("Starting Nextream Mobile with mock data...");

try {
  // Set environment variable for mock data
  process.env.EXPO_PUBLIC_USE_MOCK_DATA = "true";

  // Start Expo with debug logging
  execSync("npx expo start --web --clear --dev --no-minify", {
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_USE_MOCK_DATA: "true",
      USE_MOCK_DATA: "true",
    },
  });
} catch (error) {
  console.error("Error starting Expo:", error.message);
  process.exit(1);
}
