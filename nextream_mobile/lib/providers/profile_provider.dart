import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/models.dart';
import '../data/services/api_service.dart';
import 'auth_provider.dart';

// Profile State
class ProfileState {
  final bool isLoading;
  final String? error;
  final String username;
  final String email;
  final String? profilePic;
  final List<Movie> myList;
  final List<Movie> favorites;
  final List<Movie> watchlist;
  final List<WatchHistoryItem> watchHistory;
  final List<CurrentlyWatchingItem> currentlyWatching;
  final ProfileMetrics? metrics;

  const ProfileState({
    this.isLoading = false,
    this.error,
    this.username = '',
    this.email = '',
    this.profilePic,
    this.myList = const [],
    this.favorites = const [],
    this.watchlist = const [],
    this.watchHistory = const [],
    this.currentlyWatching = const [],
    this.metrics,
  });

  ProfileState copyWith({
    bool? isLoading,
    String? error,
    String? username,
    String? email,
    String? profilePic,
    List<Movie>? myList,
    List<Movie>? favorites,
    List<Movie>? watchlist,
    List<WatchHistoryItem>? watchHistory,
    List<CurrentlyWatchingItem>? currentlyWatching,
    ProfileMetrics? metrics,
  }) {
    return ProfileState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      username: username ?? this.username,
      email: email ?? this.email,
      profilePic: profilePic ?? this.profilePic,
      myList: myList ?? this.myList,
      favorites: favorites ?? this.favorites,
      watchlist: watchlist ?? this.watchlist,
      watchHistory: watchHistory ?? this.watchHistory,
      currentlyWatching: currentlyWatching ?? this.currentlyWatching,
      metrics: metrics ?? this.metrics,
    );
  }
}

class ProfileMetrics {
  final int totalWatchTime;
  final int totalTitlesWatched;
  final int inProgress;
  final int favoritesCount;
  final int myListCount;
  final List<Map<String, dynamic>> topGenres;

  const ProfileMetrics({
    required this.totalWatchTime,
    required this.totalTitlesWatched,
    required this.inProgress,
    required this.favoritesCount,
    required this.myListCount,
    required this.topGenres,
  });

  factory ProfileMetrics.fromJson(Map<String, dynamic> json) {
    final metrics = json['metrics'] ?? {};
    return ProfileMetrics(
      totalWatchTime: metrics['totalWatchTime'] ?? 0,
      totalTitlesWatched: metrics['totalTitlesWatched'] ?? 0,
      inProgress: metrics['inProgress'] ?? 0,
      favoritesCount: metrics['favoritesCount'] ?? 0,
      myListCount: metrics['myListCount'] ?? 0,
      topGenres: List<Map<String, dynamic>>.from(json['topGenres'] ?? []),
    );
  }
}

// Profile Notifier
class ProfileNotifier extends StateNotifier<ProfileState> {
  final ApiService _apiService;

  ProfileNotifier(this._apiService) : super(const ProfileState());

  Future<void> loadProfile() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final profile = await _apiService.getUserProfile();
      final summary = await _apiService.getProfileSummary();

      state = ProfileState(
        isLoading: false,
        username: profile['username'] ?? '',
        email: profile['email'] ?? '',
        profilePic: profile['profilePic'],
        myList: (profile['myList'] as List?)
                ?.map((json) => Movie.fromJson(json))
                .toList() ??
            [],
        favorites: (profile['favorites'] as List?)
                ?.map((json) => Movie.fromJson(json))
                .toList() ??
            [],
        watchlist: (profile['watchlist'] as List?)
                ?.map((json) => Movie.fromJson(json))
                .toList() ??
            [],
        watchHistory: (profile['watchHistory'] as List?)
                ?.map((json) => WatchHistoryItem.fromJson(json))
                .toList() ??
            [],
        currentlyWatching: (profile['currentlyWatching'] as List?)
                ?.map((json) => CurrentlyWatchingItem.fromJson(json))
                .toList() ??
            [],
        metrics: ProfileMetrics.fromJson(summary),
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load profile',
      );
    }
  }

  Future<void> removeFromMyList(String movieId) async {
    try {
      await _apiService.removeFromMyList(movieId);
      state = state.copyWith(
        myList: state.myList.where((m) => m.id != movieId).toList(),
      );
    } catch (e) {
      // Handle error
    }
  }

  Future<void> removeFromFavorites(String movieId) async {
    try {
      await _apiService.removeFromFavorites(movieId);
      state = state.copyWith(
        favorites: state.favorites.where((m) => m.id != movieId).toList(),
      );
    } catch (e) {
      // Handle error
    }
  }

  Future<void> removeFromWatchlist(String movieId) async {
    try {
      await _apiService.removeFromWatchlist(movieId);
      state = state.copyWith(
        watchlist: state.watchlist.where((m) => m.id != movieId).toList(),
      );
    } catch (e) {
      // Handle error
    }
  }
}

// Profile Provider
final profileProvider = StateNotifierProvider<ProfileNotifier, ProfileState>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return ProfileNotifier(apiService);
});
