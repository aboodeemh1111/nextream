const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Movie = require("./models/Movie");
const List = require("./models/List");

dotenv.config();

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  })
  .then(() => console.log("DB Connection Successful for Seeding Content"))
  .catch((err) => {
    console.error(err);
  });

// Create sample movies
const createSampleMovies = async () => {
  try {
    // Check if movies already exist
    const existingMovies = await Movie.countDocuments();
    if (existingMovies > 0) {
      console.log("Movies already exist in the database");
      return;
    }

    // Sample movies data
    const moviesData = [
      {
        title: "Stranger Things",
        desc: "When a young boy disappears, his mother, a police chief, and his friends must confront terrifying forces in order to get him back.",
        img: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80",
        imgSm: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80",
        trailer: "https://www.youtube.com/watch?v=b9EkMc79ZSU",
        video: "https://www.youtube.com/watch?v=b9EkMc79ZSU",
        year: "2016",
        limit: 16,
        genre: "Sci-Fi & Fantasy",
        isSeries: true,
        duration: "50m"
      },
      {
        title: "The Witcher",
        desc: "Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.",
        img: "https://images.unsplash.com/photo-1604200213928-ba3cf4fc8436?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80",
        imgSm: "https://images.unsplash.com/photo-1604200213928-ba3cf4fc8436?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80",
        trailer: "https://www.youtube.com/watch?v=ndl1W4ltcmg",
        video: "https://www.youtube.com/watch?v=ndl1W4ltcmg",
        year: "2019",
        limit: 18,
        genre: "Fantasy",
        isSeries: true,
        duration: "1h"
      },
      {
        title: "Inception",
        desc: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
        img: "https://images.unsplash.com/photo-1594908900066-3f47337549d8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80",
        imgSm: "https://images.unsplash.com/photo-1594908900066-3f47337549d8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80",
        trailer: "https://www.youtube.com/watch?v=YoHD9XEInc0",
        video: "https://www.youtube.com/watch?v=YoHD9XEInc0",
        year: "2010",
        limit: 13,
        genre: "Sci-Fi",
        isSeries: false,
        duration: "2h 28m"
      }
    ];

    // Insert movies
    await Movie.insertMany(moviesData);
    console.log("Sample movies created successfully");
    
    // Return the created movies for use in lists
    return await Movie.find();
  } catch (err) {
    console.error("Error creating sample movies:", err);
  }
};

// Create sample lists
const createSampleLists = async (movies) => {
  try {
    // Check if lists already exist
    const existingLists = await List.countDocuments();
    if (existingLists > 0) {
      console.log("Lists already exist in the database");
      return;
    }

    if (!movies || movies.length === 0) {
      console.log("No movies available to create lists");
      return;
    }

    // Get movie IDs
    const movieIds = movies.map(movie => movie._id);

    // Sample lists data
    const listsData = [
      {
        title: "Popular on Nextream",
        type: "all",
        genre: "",
        content: movieIds
      },
      {
        title: "Trending Now",
        type: "all",
        genre: "",
        content: movieIds.slice(0, 2)
      },
      {
        title: "Sci-Fi Movies",
        type: "movie",
        genre: "Sci-Fi",
        content: [movieIds[2]]
      },
      {
        title: "Fantasy Series",
        type: "series",
        genre: "Fantasy",
        content: [movieIds[1]]
      }
    ];

    // Insert lists
    await List.insertMany(listsData);
    console.log("Sample lists created successfully");
  } catch (err) {
    console.error("Error creating sample lists:", err);
  }
};

// Run seed functions
const seedDatabase = async () => {
  try {
    const movies = await createSampleMovies();
    await createSampleLists(movies);
  } catch (err) {
    console.error("Error seeding database:", err);
  } finally {
    // Disconnect from database
    mongoose.disconnect();
    console.log("Database seeding completed");
  }
};

// Run the seed function
seedDatabase(); 