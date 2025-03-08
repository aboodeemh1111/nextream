#!/bin/bash

# Nextream Deployment Script

echo "Nextream Deployment Script"
echo "=========================="
echo ""

# Step 1: Push changes to GitHub
echo "Step 1: Pushing changes to GitHub..."
git add .
git commit -m "Prepare for deployment"
git push
echo "Changes pushed to GitHub."
echo ""

# Step 2: Instructions for Render deployment
echo "Step 2: Deploy Backend to Render"
echo "-------------------------------"
echo "1. Go to https://dashboard.render.com/"
echo "2. Create a new Web Service"
echo "3. Connect your GitHub repository"
echo "4. Configure the service:"
echo "   - Name: nextream-api"
echo "   - Environment: Node"
echo "   - Root Directory: onstream/api"
echo "   - Build Command: npm install"
echo "   - Start Command: npm start"
echo "5. Add the following environment variables:"
echo "   - MONGO_URL: mongodb+srv://aboodeemh:zoom@cluster0.lsqno.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
echo "   - SECRET_KEY: zoom"
echo "   - PORT: 10000"
echo "6. Click 'Create Web Service'"
echo ""
echo "Wait for the deployment to complete and note the URL."
echo ""

# Step 3: Instructions for Vercel deployment
echo "Step 3: Deploy Client to Vercel"
echo "-----------------------------"
echo "1. Go to https://vercel.com/new"
echo "2. Import your GitHub repository"
echo "3. Configure the project:"
echo "   - Framework Preset: Next.js"
echo "   - Root Directory: nextream-client"
echo "4. Add the following environment variables:"
echo "   - NEXT_PUBLIC_API_URL: https://nextream-api.onrender.com"
echo "   - NEXT_PUBLIC_JWT_SECRET: zoom"
echo "5. Click 'Deploy'"
echo ""

# Step 4: Instructions for Vercel deployment of admin
echo "Step 4: Deploy Admin to Vercel"
echo "----------------------------"
echo "1. Go to https://vercel.com/new"
echo "2. Import your GitHub repository"
echo "3. Configure the project:"
echo "   - Framework Preset: Next.js"
echo "   - Root Directory: nextream-admin"
echo "4. Add the following environment variables:"
echo "   - NEXT_PUBLIC_API_URL: https://nextream-api.onrender.com"
echo "   - NEXT_PUBLIC_JWT_SECRET: zoom"
echo "5. Click 'Deploy'"
echo ""

echo "Deployment instructions complete. Follow the steps above to deploy your application."
echo "For more detailed instructions, refer to the DEPLOYMENT.md file." 