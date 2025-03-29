import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  API_URL,
  AUTH_TOKEN_KEY,
  STORAGE_KEYS,
  DEFAULT_POSTER,
  DEFAULT_BACKDROP,
  LOCAL_API_URL,
} from "../config";
import { Platform } from "react-native";

// Mock data for development when API is unavailable
const MOCK_DATA = {
  action: [
    {
      _id: "mock1",
      title: "Fast & Furious Presents: Hobbs & Shaw",
      desc: "Lawman Luke Hobbs and outcast Deckard Shaw form an unlikely alliance when a cyber-genetically enhanced villain threatens the future of humanity.",
      img: "https://image.tmdb.org/t/p/w500/qRyy2UmjC5ur9bDi3kpNNRCc5nc.jpg",
      year: "2023",
      genre: "Action",
      isSeries: false,
      limit: 13,
    },
    {
      _id: "mock2",
      title: "The Mandalorian",
      desc: "After the fall of the Galactic Empire, lawlessness has spread throughout the galaxy. A lone gunfighter makes his way through the outer reaches.",
      img: "https://image.tmdb.org/t/p/w500/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg",
      year: "2023",
      genre: "Action",
      isSeries: true,
      limit: 13,
    },
    {
      _id: "mock3",
      title: "John Wick: Chapter 4",
      desc: "With the price on his head ever increasing, John Wick uncovers a path to defeating The High Table.",
      img: "https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg",
      year: "2023",
      genre: "Action",
      isSeries: false,
      limit: 16,
    },
    {
      _id: "mock4",
      title: "Vikings",
      desc: "The adventures of Ragnar Lothbrok, the greatest hero of his age.",
      img: "https://image.tmdb.org/t/p/w500/w3NqBXz8V69xbzJ8L1Qg3UimwOU.jpg",
      year: "2013",
      genre: "Action",
      isSeries: true,
      limit: 18,
    },
  ],
  comedy: [
    {
      _id: "mock5",
      title: "The Office",
      desc: "A mockumentary on a group of typical office workers.",
      img: "https://image.tmdb.org/t/p/w500/oNZAJgcGVDxjv2BJWoMCQE9g7Gc.jpg",
      year: "2005",
      genre: "Comedy",
      isSeries: true,
      limit: 13,
    },
    {
      _id: "mock6",
      title: "Barbie",
      desc: "Barbie and Ken are having the time of their lives in the colorful and seemingly perfect world of Barbie Land.",
      img: "https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
      year: "2023",
      genre: "Comedy",
      isSeries: false,
      limit: 7,
    },
  ],
  drama: [
    {
      _id: "mock7",
      title: "Breaking Bad",
      desc: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.",
      img: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      year: "2008",
      genre: "Drama",
      isSeries: true,
      limit: 18,
    },
    {
      _id: "mock8",
      title: "Oppenheimer",
      desc: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
      img: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
      year: "2023",
      genre: "Drama",
      isSeries: false,
      limit: 16,
    },
  ],
  horror: [
    {
      _id: "mock9",
      title: "The Walking Dead",
      desc: "Sheriff Deputy Rick Grimes wakes up from a coma to learn the world is in ruins and must lead a group of survivors to stay alive.",
      img: "https://image.tmdb.org/t/p/w500/xf9wuDcqlUPWABZNeDKPbZUjWx0.jpg",
      year: "2010",
      genre: "Horror",
      isSeries: true,
      limit: 18,
    },
    {
      _id: "mock10",
      title: "A Quiet Place",
      desc: "In a post-apocalyptic world, a family is forced to live in silence while hiding from monsters with ultra-sensitive hearing.",
      img: "https://image.tmdb.org/t/p/w500/nAU74GmpUk7t5iklEp3bufwDq4n.jpg",
      year: "2018",
      genre: "Horror",
      isSeries: false,
      limit: 13,
    },
  ],
  "sci-fi": [
    {
      _id: "mock11",
      title: "Stranger Things",
      desc: "When a young boy disappears, his mother, a police chief, and his friends must confront terrifying supernatural forces.",
      img: "https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
      year: "2016",
      genre: "Sci-Fi",
      isSeries: true,
      limit: 16,
    },
    {
      _id: "mock12",
      title: "Interstellar",
      desc: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
      img: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      year: "2014",
      genre: "Sci-Fi",
      isSeries: false,
      limit: 13,
    },
  ],
  trending: [
    {
      _id: "mock13",
      title: "Dune",
      desc: "Feature adaptation of Frank Herbert's science fiction novel about the son of a noble family entrusted with the protection of the most valuable asset in the galaxy.",
      img: "https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
      year: "2021",
      genre: "Sci-Fi",
      isSeries: false,
      limit: 13,
    },
    {
      _id: "mock14",
      title: "Game of Thrones",
      desc: "Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.",
      img: "https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
      year: "2011",
      genre: "Fantasy",
      isSeries: true,
      limit: 18,
    },
    {
      _id: "mock15",
      title: "The Last of Us",
      desc: "After a global pandemic destroys civilization, a hardened survivor takes charge of a 14-year-old girl who may be humanity's last hope.",
      img: "https://image.tmdb.org/t/p/w500/aUQKIpZZ31KWbpdHMCmaV76u78T.jpg",
      year: "2023",
      genre: "Drama",
      isSeries: true,
      limit: 18,
    },
    {
      _id: "mock16",
      title: "Top Gun: Maverick",
      desc: "After more than thirty years of service as a top naval aviator, Pete Mitchell is where he belongs, pushing the envelope as a courageous test pilot.",
      img: "https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg",
      year: "2022",
      genre: "Action",
      isSeries: false,
      limit: 13,
    },
  ],
};

/**
 * Get the authentication token from storage
 * @returns {Promise<string|null>} The authentication token or null if not found
 */
const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

/**
 * Create headers with authentication token if available
 * @returns {Object} Headers object
 */
const createHeaders = async () => {
  const token = await getAuthToken();
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Check if we should use mock data during development
 * @returns {boolean} True if we should use mock data
 */
const shouldUseMockData = () => {
  // Use mock data when any of these conditions are true:
  // 1. USE_MOCK_DATA environment variable is set to "true"
  // 2. EXPO_PUBLIC_USE_MOCK_DATA environment variable is set to "true"
  // 3. We're running in a development environment with localhost
  return (
    process.env.USE_MOCK_DATA === "true" ||
    process.env.EXPO_PUBLIC_USE_MOCK_DATA === "true" ||
    (process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      window.location &&
      window.location.hostname === "localhost")
  );
};

/**
 * Perform API fetch with appropriate handling based on platform
 * @param {string} endpoint - API endpoint to fetch (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
const apiFetch = async (endpoint, options = {}) => {
  try {
    const headers = await createHeaders();
    const fetchOptions = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    // Remove leading slash if present in endpoint
    const cleanEndpoint = endpoint.startsWith("/")
      ? endpoint.substring(1)
      : endpoint;

    // Determine the appropriate URL to use
    let fullUrl;

    // For web platforms
    if (Platform.OS === "web") {
      if (process.env.NODE_ENV === "development") {
        // In development, connect to our local proxy server
        fullUrl = `http://localhost:3001/api/${cleanEndpoint}`;
      } else {
        // In production, use the API directly
        fullUrl = `${API_URL}/api/${cleanEndpoint}`;
      }
    } else {
      // For native mobile apps
      if (process.env.NODE_ENV === "development") {
        // For Android emulator, 10.0.2.2 points to host's localhost
        fullUrl = `http://10.0.2.2:3001/api/${cleanEndpoint}`;
      } else {
        // For production, use the deployed API
        fullUrl = `${API_URL}/api/${cleanEndpoint}`;
      }
    }

    console.log(`Fetching from: ${fullUrl}`);

    // Make the fetch request
    const response = await fetch(fullUrl, fetchOptions);

    // Return mock data if API returns error and we're in development
    if (!response.ok && process.env.NODE_ENV === "development") {
      console.warn(
        `API request failed: ${response.status} ${response.statusText}`
      );
      console.warn("Endpoint:", fullUrl);

      // If mock data is available for this endpoint, suggest using it
      if (endpoint.includes("genre") || endpoint.includes("recommendations")) {
        console.warn(
          "Consider using mock data with 'npm run mock' for development"
        );
      }
    }

    return response;
  } catch (error) {
    console.error(`Fetch error for ${endpoint}:`, error);

    // If this is a network error and we're in development, suggest using mock data
    if (
      error.message &&
      error.message.includes("Network request failed") &&
      process.env.NODE_ENV === "development"
    ) {
      console.warn(
        "Network error - consider using mock data with 'npm run mock' for development"
      );
    }

    throw error;
  }
};

/**
 * Get details for a specific movie
 * @param {string} movieId - The ID of the movie
 * @returns {Promise<Object>} Movie details
 */
export const getMovieDetails = async (movieId) => {
  try {
    // Use mock data for movie ID that starts with "mock"
    if (shouldUseMockData() && movieId.startsWith("mock")) {
      const allMockMovies = [...MOCK_DATA.action, ...MOCK_DATA.trending];
      const mockMovie = allMockMovies.find(
        (m) => m._id === movieId && !m.isSeries
      );
      if (mockMovie) {
        return {
          ...mockMovie,
          imgTitle: mockMovie.img,
          imgSm: mockMovie.img,
          trailer: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          duration: "2h 15m",
          limit: 16,
        };
      }
    }

    const response = await apiFetch(`movies/find/${movieId}`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch movie details: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error in getMovieDetails:", error);
    throw error;
  }
};

/**
 * Get details for a specific series
 * @param {string} seriesId - The ID of the series
 * @returns {Promise<Object>} Series details
 */
export const getSeriesDetails = async (seriesId) => {
  try {
    // Use mock data for series ID that starts with "mock"
    if (shouldUseMockData() && seriesId.startsWith("mock")) {
      const allMockSeries = [...MOCK_DATA.action, ...MOCK_DATA.trending];
      const mockSeries = allMockSeries.find(
        (s) => s._id === seriesId && s.isSeries
      );
      if (mockSeries) {
        return {
          ...mockSeries,
          imgTitle: mockSeries.img,
          imgSm: mockSeries.img,
          trailer: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          status: "ongoing",
          totalSeasons: 3,
        };
      }
    }

    const response = await apiFetch(`series/find/${seriesId}`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch series details: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error in getSeriesDetails:", error);
    throw error;
  }
};

/**
 * Get content recommendations for the user
 * @returns {Promise<Array>} List of recommended content items
 */
export const getRecommendations = async () => {
  try {
    // Return mock trending data if using mock data or in development
    if (shouldUseMockData() || process.env.NODE_ENV === "development") {
      console.log("[MOCK] Fetching recommendations");
      return MOCK_DATA.trending;
    }

    const response = await apiFetch(`content/recommendations`);

    if (!response.ok) {
      if (response.status === 401) {
        // Handle unauthorized error (token expired, etc.)
        return [];
      }
      throw new Error(
        `Failed to fetch recommendations: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error in getRecommendations:", error);
    // Fall back to mock data in development
    if (process.env.NODE_ENV === "development") {
      console.warn("Falling back to mock data due to API error");
      return MOCK_DATA.trending;
    }
    return [];
  }
};

/**
 * Search for content based on query
 * @param {string} query - The search query
 * @param {string} type - Content type filter (movie, series, or all)
 * @returns {Promise<Array>} List of search results
 */
export const searchContent = async (query, type = "all") => {
  try {
    // Return mock search results if using mock data or in development
    if (shouldUseMockData() || process.env.NODE_ENV === "development") {
      console.log(`[MOCK] Searching for: ${query}`);
      const allMockContent = Object.values(MOCK_DATA).flat();
      const filteredContent = allMockContent.filter((item) => {
        const matchesQuery = item.title
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesType =
          type === "all" ||
          (type === "movie" && !item.isSeries) ||
          (type === "series" && item.isSeries);
        return matchesQuery && matchesType;
      });
      return filteredContent;
    }

    let endpoint = `content/search?q=${encodeURIComponent(query)}`;

    if (type && type !== "all") {
      endpoint += `&type=${type}`;
    }

    const response = await apiFetch(endpoint);

    if (!response.ok) {
      throw new Error(
        `Failed to search content: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error in searchContent:", error);
    // Fall back to mock data in development
    if (process.env.NODE_ENV === "development") {
      console.warn("Falling back to mock data due to API error");
      const allMockContent = Object.values(MOCK_DATA).flat();
      const filteredContent = allMockContent.filter((item) => {
        const matchesQuery = item.title
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesType =
          type === "all" ||
          (type === "movie" && !item.isSeries) ||
          (type === "series" && item.isSeries);
        return matchesQuery && matchesType;
      });
      return filteredContent;
    }
    throw error;
  }
};

/**
 * Get content by genre
 * @param {string} genre - The genre to filter by
 * @param {string} type - Content type filter (movie, series, or all)
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} List of content items
 */
export const getContentByGenre = async (genre, type = "all", limit = 20) => {
  try {
    // Always use mock data in development to avoid CORS issues
    if (shouldUseMockData() || process.env.NODE_ENV === "development") {
      console.log(`[MOCK] Fetching ${genre} content`);
      const genreContent = MOCK_DATA[genre.toLowerCase()] || MOCK_DATA.action;
      // Filter by type if necessary
      if (type !== "all") {
        return genreContent
          .filter((item) =>
            type === "series" ? item.isSeries : !item.isSeries
          )
          .slice(0, limit);
      }
      return genreContent.slice(0, limit);
    }

    // Real API call for production only
    const headers = await createHeaders();
    const params = { genre, type, limit };
    const response = await axios.get(`${API_URL}/api/content/genre`, {
      headers,
      params,
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching content by genre:", error);
    // Fall back to mock data in case of errors
    if (process.env.NODE_ENV === "development") {
      console.warn("Falling back to mock data due to API error");
      const genreContent = MOCK_DATA[genre.toLowerCase()] || MOCK_DATA.action;
      if (type !== "all") {
        return genreContent
          .filter((item) =>
            type === "series" ? item.isSeries : !item.isSeries
          )
          .slice(0, limit);
      }
      return genreContent.slice(0, limit);
    }
    return [];
  }
};

/**
 * Track content view for analytics and recommendations
 * @param {Object} params - View parameters
 * @param {string} params.contentId - ID of the viewed content
 * @param {string} params.episodeId - ID of the episode (for series)
 * @param {string} params.type - Type of content (movie or series)
 * @returns {Promise<void>}
 */
export const trackContentView = async (params) => {
  try {
    // Skip tracking if using mock data
    if (shouldUseMockData()) {
      console.log("[MOCK] Tracking content view:", params);
      return true;
    }

    // Real API call
    const headers = await createHeaders();
    await axios.post(`${API_URL}/api/user/history`, params, { headers });
    return true;
  } catch (error) {
    console.error("Error tracking content view:", error);
    return false;
  }
};
