#!/bin/bash

# Nextream Local Development Setup Script

echo "Nextream Local Development Setup"
echo "================================"
echo ""

# Step 1: Install dependencies for backend
echo "Step 1: Installing backend dependencies..."
cd onstream/api
npm install
echo "Backend dependencies installed."
echo ""

# Step 2: Set up images for backend
echo "Step 2: Setting up images for backend..."
npm run setup-images
echo "Images set up for backend."
echo ""

# Step 3: Install dependencies for client
echo "Step 3: Installing client dependencies..."
cd ../../nextream-client
npm install
echo "Client dependencies installed."
echo ""

# Step 4: Install dependencies for admin
echo "Step 4: Installing admin dependencies..."
cd ../nextream-admin
npm install
echo "Admin dependencies installed."
echo ""

# Step 5: Copy environment files if they don't exist
echo "Step 5: Setting up environment files..."

# Backend
if [ ! -f "../onstream/api/.env" ]; then
  cp ../onstream/api/.env.development ../onstream/api/.env
  echo "Created .env file for backend."
fi

# Client
if [ ! -f "../nextream-client/.env.local" ]; then
  cp ../nextream-client/.env.development ../nextream-client/.env.local
  echo "Created .env.local file for client."
fi

# Admin
if [ ! -f "../nextream-admin/.env.local" ]; then
  cp ../nextream-admin/.env.development ../nextream-admin/.env.local
  echo "Created .env.local file for admin."
fi

echo "Environment files set up."
echo ""

echo "Setup complete! You can now start the applications:"
echo "1. Backend: cd onstream/api && npm run dev"
echo "2. Client: cd nextream-client && npm run dev"
echo "3. Admin: cd nextream-admin && npm run dev"
echo ""
echo "Happy coding!" 