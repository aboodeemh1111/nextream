# Nextream Client

This is the frontend client for the Nextream streaming platform.

## Deployment to Vercel

### Prerequisites

- A Vercel account
- The backend API deployed on Render or another platform

### Steps to Deploy

1. Import your GitHub repository to Vercel
2. Configure the following settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

3. Add the following environment variables:
   - `NEXT_PUBLIC_API_URL`: The URL of your deployed API (e.g., https://nextream-api.onrender.com)
   - `NEXT_PUBLIC_JWT_SECRET`: Your JWT secret key (should match the backend)

4. Deploy the application

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env.local` file with the required environment variables
4. Run the development server: `npm run dev`

## Features

- User authentication
- Browse movies and series
- Create and manage watchlists
- Track viewing history
- Personalized recommendations
