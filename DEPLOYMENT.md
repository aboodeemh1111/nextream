# Nextream Deployment Guide

This guide will help you deploy the Nextream application, which consists of three main components:
1. Backend API (Node.js/Express)
2. Client Frontend (Next.js)
3. Admin Dashboard (Next.js)

## Prerequisites

- GitHub account with your code repository
- Render account for backend deployment
- Vercel account for frontend deployment
- MongoDB Atlas account (or any MongoDB provider)

## Step 1: Deploy the Backend API to Render

1. Log in to your Render account
2. Click on "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: nextream-api
   - **Environment**: Node
   - **Root Directory**: onstream/api
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free or paid depending on your needs

5. Add the following environment variables:
   - `MONGO_URL`: Your MongoDB connection string
   - `SECRET_KEY`: Your JWT secret key
   - `PORT`: 10000 (Render will automatically set this, but you can specify it)

6. Click "Create Web Service"
7. Wait for the deployment to complete
8. Note the URL of your deployed API (e.g., https://nextream-api.onrender.com)

## Step 2: Deploy the Client Frontend to Vercel

1. Log in to your Vercel account
2. Click on "Add New" and select "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: nextream-client
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. Add the following environment variables:
   - `NEXT_PUBLIC_API_URL`: The URL of your deployed API (e.g., https://nextream-api.onrender.com)
   - `NEXT_PUBLIC_JWT_SECRET`: Your JWT secret key (should match the backend)

6. Click "Deploy"
7. Wait for the deployment to complete
8. Note the URL of your deployed client (e.g., https://nextream-client.vercel.app)

## Step 3: Deploy the Admin Dashboard to Vercel

1. Log in to your Vercel account
2. Click on "Add New" and select "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: nextream-admin
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. Add the following environment variables:
   - `NEXT_PUBLIC_API_URL`: The URL of your deployed API (e.g., https://nextream-api.onrender.com)
   - `NEXT_PUBLIC_JWT_SECRET`: Your JWT secret key (should match the backend)

6. Click "Deploy"
7. Wait for the deployment to complete
8. Note the URL of your deployed admin dashboard (e.g., https://nextream-admin.vercel.app)

## Step 4: Update CORS Settings (if needed)

If you encounter CORS issues, update the allowed origins in your backend API:

1. Go to your Render dashboard
2. Select your backend API service
3. Edit the code in `onstream/api/index.js` to include your frontend domains in the `allowedOrigins` array
4. Commit and push the changes to your repository
5. Render will automatically redeploy your API

## Step 5: Verify the Deployment

1. Visit your client frontend URL
2. Try to register and log in
3. Browse content and test features
4. Visit your admin dashboard URL
5. Log in with admin credentials
6. Test admin features

## Troubleshooting

### API Connection Issues
- Verify that the `NEXT_PUBLIC_API_URL` environment variable is set correctly
- Check that CORS is properly configured in the backend
- Ensure that the API is running and accessible

### Database Connection Issues
- Verify that the `MONGO_URL` environment variable is set correctly
- Check that your IP address is whitelisted in MongoDB Atlas
- Ensure that the database user has the correct permissions

### Authentication Issues
- Verify that the `SECRET_KEY` is the same across all components
- Check that the token is being properly sent in API requests
- Ensure that the authentication middleware is working correctly

## Maintenance

- Regularly check for security updates
- Monitor API usage and performance
- Back up your database regularly
- Update environment variables as needed 