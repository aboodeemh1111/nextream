// API Base URL
// For development, use the local backend server
export const API_URL = "http://localhost:8800";

// For production, use the deployed backend
export const PRODUCTION_API_URL = "https://nextream-api.onrender.com";

// Authentication token key
export const AUTH_TOKEN_KEY = "auth_token";

// Color scheme (matched with nextream-client design)
export const COLORS = {
  // Primary colors
  primary: "#E50914", // Netflix red
  secondary: "#141414", // Dark background

  // Background colors
  background: "#000000", // Pure black
  backgroundLighter: "#141414", // Slightly lighter black
  backgroundCard: "#181818", // Card background
  backgroundGradient:
    "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,1) 100%)",

  // Text colors
  text: "#FFFFFF", // White
  textDark: "#000000", // Black (for text on light backgrounds)
  textSecondary: "#AAAAAA", // Light gray
  muted: "#737373", // Muted text (renamed from textMuted for compatibility)
  textMuted: "#737373", // Keep for backward compatibility

  // UI colors
  error: "#FF3B30", // Error red
  success: "#4BB543", // Success green
  highlight: "#1F80E0", // Highlight blue

  // Interactive elements
  buttonHover: "#F40612", // Button hover

  // Overlay colors
  overlay: "rgba(0, 0, 0, 0.5)", // Semi-transparent overlay
  overlayDarker: "rgba(0, 0, 0, 0.75)", // Darker overlay
};

// Font sizes
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 34,
  title: 40,
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius
export const BORDER_RADIUS = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  round: 50,
};

// Image placeholders
export const DEFAULT_POSTER =
  "https://image.tmdb.org/t/p/w500/rMdRqkJBfsB8Gg8XRFhHIm0YAbk.jpg";
export const DEFAULT_BACKDROP =
  "https://image.tmdb.org/t/p/original/rcUcYzGGicDvhDs58uM44tJKB9F.jpg";
export const DEFAULT_AVATAR =
  "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png";

// Animation durations
export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
};

// Screen dimensions (for layouts)
export const CONTENT_CARD = {
  aspectRatio: 0.67, // Poster aspect ratio (2:3 = 0.67)
  smallWidth: 100,
  mediumWidth: 150,
  largeWidth: 200,
  featuredWidth: 300,
};

// Misc constants
export const PAGINATION_LIMIT = 20;
export const DEBOUNCE_DELAY = 300;

// RegEx patterns
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/,
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
};
