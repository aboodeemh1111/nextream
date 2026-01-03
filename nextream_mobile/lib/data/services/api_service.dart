import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/constants/app_constants.dart';
import '../models/models.dart';

/// API Service for all HTTP requests
class ApiService {
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Add auth token to requests
          final token = await _storage.read(key: AppConstants.tokenStorageKey);
          if (token != null) {
            options.headers['token'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) {
          // Handle errors globally
          return handler.next(error);
        },
      ),
    );
  }

  // ==================== AUTH ====================

  Future<User> login(String email, String password) async {
    final response = await _dio.post(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    final user = User.fromJson(response.data);
    await _storage.write(key: AppConstants.tokenStorageKey, value: user.accessToken);
    return user;
  }

  Future<void> register(String username, String email, String password) async {
    await _dio.post(
      '/auth/register',
      data: {'username': username, 'email': email, 'password': password},
    );
  }

  Future<void> logout() async {
    await _storage.delete(key: AppConstants.tokenStorageKey);
  }

  // ==================== MOVIES ====================

  Future<List<Map<String, dynamic>>> getListsWithContent({String? genre}) async {
    final response = await _dio.get(
      '/lists',
      queryParameters: genre != null ? {'genre': genre} : null,
    );
    // API returns lists with populated content
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  Future<List<MovieList>> getLists({String? genre}) async {
    final response = await _dio.get(
      '/lists',
      queryParameters: genre != null ? {'genre': genre} : null,
    );
    return (response.data as List)
        .map((json) => MovieList.fromJson(json))
        .toList();
  }

  Future<List<Movie>> getListContent(String listId) async {
    final response = await _dio.get('/lists/find/$listId');
    final content = response.data['content'] as List? ?? [];
    return content.map((json) => Movie.fromJson(json)).toList();
  }

  Future<Movie> getMovie(String movieId) async {
    final response = await _dio.get('/movies/find/$movieId');
    return Movie.fromJson(response.data);
  }

  Future<Movie?> getRandomMovie({String? type}) async {
    try {
      final response = await _dio.get(
        '/movies/random',
        queryParameters: type != null ? {'type': type} : null,
      );
      return Movie.fromJson(response.data);
    } catch (e) {
      return null;
    }
  }

  Future<List<Movie>> searchMovies(String query, {String? genre, bool? isSeries}) async {
    final Map<String, dynamic> params = {'q': query};
    if (genre != null) params['genre'] = genre;
    if (isSeries != null) params['isSeries'] = isSeries;

    final response = await _dio.get('/movies/search', queryParameters: params);
    return (response.data as List).map((json) => Movie.fromJson(json)).toList();
  }

  // ==================== USER PROFILE ====================

  Future<Map<String, dynamic>> getUserProfile() async {
    final response = await _dio.get('/users/profile');
    return response.data;
  }

  Future<Map<String, dynamic>> getProfileSummary() async {
    final response = await _dio.get('/users/profile/summary');
    return response.data;
  }

  // ==================== USER LISTS ====================

  Future<void> addToMyList(String movieId) async {
    await _dio.post('/users/mylist', data: {'movieId': movieId});
  }

  Future<void> removeFromMyList(String movieId) async {
    await _dio.delete('/users/mylist/$movieId');
  }

  Future<void> addToFavorites(String movieId) async {
    await _dio.post('/users/favorites', data: {'movieId': movieId});
  }

  Future<void> removeFromFavorites(String movieId) async {
    await _dio.delete('/users/favorites/$movieId');
  }

  Future<void> addToWatchlist(String movieId) async {
    await _dio.post('/users/watchlist', data: {'movieId': movieId});
  }

  Future<void> removeFromWatchlist(String movieId) async {
    await _dio.delete('/users/watchlist/$movieId');
  }

  // ==================== REVIEWS ====================

  Future<List<Review>> getReviews(String movieId) async {
    final response = await _dio.get('/reviews/movie/$movieId');
    return (response.data as List).map((json) => Review.fromJson(json)).toList();
  }

  Future<void> addReview(String movieId, double rating, String text) async {
    await _dio.post(
      '/reviews',
      data: {'movieId': movieId, 'rating': rating, 'review': text},
    );
  }

  Future<void> rateMovie(String movieId, double rating) async {
    await _dio.post(
      '/reviews/$movieId/rate',
      data: {'rating': rating},
    );
  }

  // ==================== WATCH PROGRESS ====================

  Future<void> updateWatchProgress(String movieId, double progress) async {
    await _dio.post(
      '/users/watch-progress',
      data: {'movieId': movieId, 'progress': progress},
    );
  }
}
