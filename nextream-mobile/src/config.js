// API Configuration
export const API_URL = "https://nextream-api.onrender.com"; // Change to your API URL
export const LOCAL_API_URL = "http://localhost:8800"; // For local development

// App Configuration
export const APP_NAME = "Nextream";
export const APP_VERSION = "1.0.0";

// Theme Colors
export const COLORS = {
  primary: "#E50914", // Netflix red
  secondary: "#221F1F", // Netflix dark
  background: "#000000", // Black
  card: "#121212", // Dark gray
  text: "#FFFFFF", // White
  textDark: "#000000", // Black text for light backgrounds
  border: "#222222", // Dark border
  notification: "#F43534", // Notification red
  muted: "#999999", // Muted text
  highlight: "#FFFFFF", // Highlight color
};

// Default Images
export const DEFAULT_PROFILE_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png";
export const DEFAULT_POSTER =
  "https://via.placeholder.com/300x450?text=No+Image";
export const DEFAULT_BACKDROP =
  "https://via.placeholder.com/1280x720?text=No+Image";

// Content Categories
export const GENRES = [
  "Action",
  "Comedy",
  "Crime",
  "Fantasy",
  "Historical",
  "Horror",
  "Romance",
  "Sci-fi",
  "Thriller",
  "Western",
  "Animation",
  "Drama",
  "Documentary",
];

// Video Quality Options
export const VIDEO_QUALITY = [
  { label: "Auto", value: "auto" },
  { label: "Low (480p)", value: "480p" },
  { label: "Medium (720p)", value: "720p" },
  { label: "High (1080p)", value: "1080p" },
];

// Storage Keys
export const STORAGE_KEYS = {
  USER: "user",
  TOKEN: "token",
  THEME: "theme",
  DOWNLOAD_SETTINGS: "download_settings",
  PLAYBACK_SETTINGS: "playback_settings",
  RECENTLY_WATCHED: "recently_watched",
  DOWNLOADED_CONTENT: "downloaded_content",
};
