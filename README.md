# Nextream

A Netflix-like streaming platform with client and admin applications.

## Project Structure

- `onstream/api`: Backend API (Node.js/Express)
- `nextream-client`: Client Frontend (Next.js)
- `nextream-admin`: Admin Dashboard (Next.js)

## Local Development Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- MongoDB Atlas account (or local MongoDB instance)

### Setup Instructions

#### Windows

1. Run the setup script:
   ```
   setup-local-dev.bat
   ```

2. Start all components:
   ```
   start-dev.bat
   ```

#### macOS/Linux

1. Make the scripts executable:
   ```bash
   chmod +x setup-local-dev.sh
   chmod +x start-dev.sh
   ```

2. Run the setup script:
   ```bash
   ./setup-local-dev.sh
   ```

3. Start all components:
   ```bash
   ./start-dev.sh
   ```

### Manual Setup

If you prefer to set up manually:

1. **Backend Setup**:
   ```bash
   cd onstream/api
   npm install
   npm run setup-images
   cp .env.development .env  # If .env doesn't exist
   npm run dev
   ```

2. **Client Setup**:
   ```bash
   cd nextream-client
   npm install
   cp .env.development .env.local  # If .env.local doesn't exist
   npm run dev
   ```

3. **Admin Setup**:
   ```bash
   cd nextream-admin
   npm install
   cp .env.development .env.local  # If .env.local doesn't exist
   npm run dev
   ```

## Access the Applications

- Backend API: http://localhost:8800
- Client Frontend: http://localhost:3000
- Admin Dashboard: http://localhost:3001

## Seed Data

To populate the database with sample data:

```bash
cd onstream/api
npm run seed        # Basic seed data
npm run seed-content # Content seed data
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for instructions on deploying to Render and Vercel.

## Features

### Client Application

- User authentication
- Browse movies and series
- Create and manage watchlists
- Track viewing history
- Personalized recommendations

### Admin Dashboard

- Content management
- User management
- Analytics dashboard
- List creation and management
- Performance monitoring

## License

This project is licensed under the MIT License - see the LICENSE file for details. 