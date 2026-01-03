# Nextream Mobile

A Flutter mobile app for the Nextream streaming platform.

## Features

- **Authentication**: Login and register with secure token storage
- **Home Screen**: Featured content banner with horizontal movie lists by genre
- **Movie Details**: Full movie info with ratings, reviews, and list actions
- **Search**: Real-time search with filters for movies, series, and genres
- **Profile**: User stats, watch history, and personalized lists
- **Video Player**: Full-screen video playback with controls

## Getting Started

### Prerequisites

- Flutter SDK 3.8.1 or higher
- Android Studio / Xcode for emulator

### Installation

1. Install dependencies:
   ```bash
   flutter pub get
   ```

2. Run the app:
   ```bash
   flutter run
   ```

### Configuration

Set your API base URL in `lib/core/constants/app_constants.dart`:

```dart
static const String apiBaseUrl = 'https://your-api-url.com/api';
```

## Project Structure

```
lib/
├── core/              # Constants, theme, utilities
├── data/              # Models, services, repositories
├── providers/         # Riverpod state management
└── presentation/      # Screens, widgets, navigation
```

## Dependencies

- **flutter_riverpod** - State management
- **go_router** - Navigation
- **dio** - HTTP client
- **cached_network_image** - Image caching
- **chewie** - Video player
- **flutter_secure_storage** - Secure token storage

## License

MIT
