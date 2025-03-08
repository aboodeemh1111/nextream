# Nextream API

This is the backend API for the Nextream streaming platform.

## Deployment to Render

### Prerequisites

- A Render account
- MongoDB Atlas account (or any MongoDB provider)

### Steps to Deploy

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the following settings:
   - **Name**: nextream-api
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free or paid depending on your needs

4. Add the following environment variables:
   - `MONGO_URL`: Your MongoDB connection string
   - `SECRET_KEY`: Your JWT secret key
   - `PORT`: 10000 (Render will automatically set this, but you can specify it)

5. Deploy the service

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the required environment variables
4. Run the development server: `npm run dev`

## API Endpoints

- `/api/auth` - Authentication routes
- `/api/users` - User management
- `/api/movies` - Movie management
- `/api/lists` - List management
- `/api/admin` - Admin operations
- `/api/analytics` - Analytics data 