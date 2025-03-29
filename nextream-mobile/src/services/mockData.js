// Mock data for development and testing

// Helper function to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// Mock movie/content data
export const mockMovies = [
  {
    _id: generateId(),
    title: "Stranger Things",
    description:
      "When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces in order to get him back.",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BMDZkYmVhNjMtNWU4MC00MDQxLWE3MjYtZGMzZWI1ZjhlOWJmXkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_.jpg",
    backdropUrl: "https://wallpapercave.com/wp/wp9164080.jpg",
    isSeries: true,
    releaseYear: "2016",
    rating: "8.7",
    genre: "sci-fi",
    isNew: true,
  },
  {
    _id: generateId(),
    title: "The Witcher",
    description:
      "Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BN2FiOWU4YzYtMzZiOS00MzcyLTlkOGEtOTgwZmEwMzAxMzA3XkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_.jpg",
    backdropUrl:
      "https://images.wallpapersden.com/image/download/the-witcher-netflix-poster_66957_3840x2160.jpg",
    isSeries: true,
    releaseYear: "2019",
    rating: "8.2",
    genre: "fantasy",
  },
  {
    _id: generateId(),
    title: "Breaking Bad",
    description:
      "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BYmQ4YWMxYjUtNjZmYi00MDQ1LWFjMjMtNjA5ZDdiYjdiODU5XkEyXkFqcGdeQXVyMTMzNDExODE5._V1_.jpg",
    backdropUrl: "https://wallpapercave.com/wp/wp1860927.jpg",
    isSeries: true,
    releaseYear: "2008",
    rating: "9.5",
    genre: "drama",
  },
  {
    _id: generateId(),
    title: "The Dark Knight",
    description:
      "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg",
    backdropUrl:
      "https://images.hdqwalls.com/download/the-dark-knight-trilogy-4k-lo-1920x1080.jpg",
    isSeries: false,
    releaseYear: "2008",
    rating: "9.0",
    genre: "action",
  },
  {
    _id: generateId(),
    title: "Inception",
    description:
      "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg",
    backdropUrl: "https://wallpapercave.com/wp/6LELZqW.jpg",
    isSeries: false,
    releaseYear: "2010",
    rating: "8.8",
    genre: "sci-fi",
  },
  {
    _id: generateId(),
    title: "Joker",
    description:
      "In Gotham City, mentally troubled comedian Arthur Fleck is disregarded and mistreated by society. He then embarks on a downward spiral of revolution and bloody crime. This path brings him face-to-face with his alter-ego: the Joker.",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BNGVjNWI4ZGUtNzE0MS00YTJmLWE0ZDctN2ZiYTk2YmI3NTYyXkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_.jpg",
    backdropUrl:
      "https://images.hdqwalls.com/download/joker-movie-poster-8k-ln-1920x1080.jpg",
    isSeries: false,
    releaseYear: "2019",
    rating: "8.4",
    genre: "drama",
  },
  {
    _id: generateId(),
    title: "Friends",
    description:
      "Follows the personal and professional lives of six twenty to thirty-something-year-old friends living in Manhattan.",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BNDVkYjU0MzctMWRmZi00NTkxLTgwZWEtOWVhYjZlYjllYmU4XkEyXkFqcGdeQXVyNTA4NzY1MzY@._V1_.jpg",
    backdropUrl: "https://wallpapercave.com/wp/wp7864309.jpg",
    isSeries: true,
    releaseYear: "1994",
    rating: "8.9",
    genre: "comedy",
  },
  {
    _id: generateId(),
    title: "The Shawshank Redemption",
    description:
      "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BMDFkYTc0MGEtZmNhMC00ZDIzLWFmNTEtODM1ZmRlYWMwMWFmXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_.jpg",
    backdropUrl: "https://wallpapercave.com/wp/wp2010428.jpg",
    isSeries: false,
    releaseYear: "1994",
    rating: "9.3",
    genre: "drama",
  },
];

// Create genre collections from the mock movies
export const createGenreLists = () => {
  const genres = {
    trending: [],
    action: [],
    comedy: [],
    drama: [],
    horror: [],
    "sci-fi": [],
  };

  // Add all movies to trending
  genres.trending = [...mockMovies];

  // Add movies to their specific genres
  mockMovies.forEach((movie) => {
    if (genres[movie.genre]) {
      genres[movie.genre].push(movie);
    }
  });

  return genres;
};

// Simulated content lists by genre
export const genreLists = createGenreLists();

// Function to get recommendations (mock implementation)
export const getRecommendations = () => {
  // Just return a shuffled subset of movies
  return mockMovies
    .slice()
    .sort(() => 0.5 - Math.random())
    .slice(0, 6);
};

// Mock search function
export const searchMockContent = (query, type = "all") => {
  const normalizedQuery = query.toLowerCase();

  return mockMovies.filter((item) => {
    // Filter by type if specified
    if (type !== "all") {
      const isSeriesMatch = type === "series" && item.isSeries;
      const isMovieMatch = type === "movie" && !item.isSeries;
      if (!isSeriesMatch && !isMovieMatch) return false;
    }

    // Search in title and description
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      (item.description &&
        item.description.toLowerCase().includes(normalizedQuery))
    );
  });
};

// Mock function to simulate getting content details
export const getMockContentDetails = (id) => {
  return mockMovies.find((item) => item._id === id) || null;
};
