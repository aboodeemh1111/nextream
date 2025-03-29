/**
 * This script clears the Metro bundler cache and
 * sets up environment to use mock data for development
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

console.log(
  `${colors.bright}${colors.cyan}=== NEXTREAM APP RESET TOOL ===${colors.reset}\n`
);

try {
  console.log(`${colors.yellow}Clearing Metro bundler cache...${colors.reset}`);
  execSync("npx react-native start --reset-cache", { stdio: "ignore" });
  console.log(`${colors.green}✓ Metro bundler cache cleared${colors.reset}`);
} catch (error) {
  console.log(
    `${colors.red}Failed to clear Metro cache. Error: ${error.message}${colors.reset}`
  );
}

try {
  console.log(`${colors.yellow}Cleaning node_modules cache...${colors.reset}`);
  execSync("npm cache verify", { stdio: "ignore" });
  console.log(`${colors.green}✓ Node modules cache verified${colors.reset}`);
} catch (error) {
  console.log(
    `${colors.red}Failed to verify npm cache. Error: ${error.message}${colors.reset}`
  );
}

try {
  console.log(
    `${colors.yellow}Clearing Expo web browser cache...${colors.reset}`
  );
  execSync("npx expo-cli start --clear", { stdio: "ignore" });
  console.log(`${colors.green}✓ Expo web browser cache cleared${colors.reset}`);
} catch (error) {
  console.log(
    `${colors.red}Failed to clear Expo web cache. Continuing... ${error.message}${colors.reset}`
  );
}

// Set environment variable for mock data
process.env.USE_MOCK_DATA = "true";

console.log(
  `\n${colors.green}${colors.bright}✓ All caches cleared${colors.reset}`
);
console.log(
  `\n${colors.cyan}Starting Expo development server with mock data...${colors.reset}`
);

// Start the app with mock data
try {
  execSync("npx expo start --web", { stdio: "inherit" });
} catch (error) {
  console.log(
    `${colors.red}Failed to start Expo. Error: ${error.message}${colors.reset}`
  );
}
