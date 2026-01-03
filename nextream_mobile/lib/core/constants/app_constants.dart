/// API and App Constants
class AppConstants {
  AppConstants._();

  // API Configuration
  // For Android Emulator: use 10.0.2.2 (maps to host machine's localhost)
  // For Real Device: use your computer's local IP address (e.g., 192.168.x.x)
  // For Production: use https://nextream.onrender.com/api
  static const String apiBaseUrl = 'https://nextream.onrender.com/api';
  
  // Storage Keys
  static const String userStorageKey = 'user_data';
  static const String tokenStorageKey = 'access_token';
  
  // Genres
  static const List<String> genres = [
    'action',
    'comedy',
    'crime',
    'fantasy',
    'historical',
    'horror',
    'romance',
    'sci-fi',
    'thriller',
    'western',
    'animation',
    'drama',
    'documentary',
  ];
}
