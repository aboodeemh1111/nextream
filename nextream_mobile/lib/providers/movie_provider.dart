import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/models.dart';
import '../data/services/api_service.dart';
import 'auth_provider.dart';

// Home State
class HomeState {
  final bool isLoading;
  final String? error;
  final Movie? featuredMovie;
  final List<MovieList> lists;
  final Map<String, List<Movie>> listContents;
  final String? selectedGenre;

  const HomeState({
    this.isLoading = false,
    this.error,
    this.featuredMovie,
    this.lists = const [],
    this.listContents = const {},
    this.selectedGenre,
  });

  HomeState copyWith({
    bool? isLoading,
    String? error,
    Movie? featuredMovie,
    List<MovieList>? lists,
    Map<String, List<Movie>>? listContents,
    String? selectedGenre,
  }) {
    return HomeState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      featuredMovie: featuredMovie ?? this.featuredMovie,
      lists: lists ?? this.lists,
      listContents: listContents ?? this.listContents,
      selectedGenre: selectedGenre,
    );
  }
}

// Home Notifier
class HomeNotifier extends StateNotifier<HomeState> {
  final ApiService _apiService;

  HomeNotifier(this._apiService) : super(const HomeState());

  Future<void> loadHome({String? genre}) async {
    state = state.copyWith(isLoading: true, error: null, selectedGenre: genre);

    try {
      // Load featured movie
      final featuredMovie = await _apiService.getRandomMovie();

      // Load lists with content already populated from API
      final listsData = await _apiService.getListsWithContent(genre: genre);
      
      final lists = <MovieList>[];
      final listContents = <String, List<Movie>>{};
      
      for (var listJson in listsData) {
        final list = MovieList.fromJson(listJson);
        lists.add(list);
        
        // Content is already populated in the response
        final content = listJson['content'] as List? ?? [];
        listContents[list.id] = content
            .map((json) => Movie.fromJson(json as Map<String, dynamic>))
            .toList();
      }

      state = state.copyWith(
        isLoading: false,
        featuredMovie: featuredMovie,
        lists: lists,
        listContents: listContents,
      );
    } catch (e) {
      print('Error loading home: $e');
      String errorMsg = 'Failed to load content';
      if (e.toString().contains('SocketException') || e.toString().contains('Connection')) {
        errorMsg = 'No internet connection';
      } else if (e.toString().contains('401') || e.toString().contains('403')) {
        errorMsg = 'Please login to continue';
      } else if (e.toString().contains('404')) {
        errorMsg = 'Content not found';
      } else if (e.toString().contains('500')) {
        errorMsg = 'Server error. Please try again later.';
      }
      state = state.copyWith(
        isLoading: false,
        error: errorMsg,
      );
    }
  }

  Future<void> loadListContent(String listId) async {
    if (state.listContents.containsKey(listId)) return;

    try {
      final content = await _apiService.getListContent(listId);
      state = state.copyWith(
        listContents: {...state.listContents, listId: content},
      );
    } catch (e) {
      // Silently fail for individual list loading
    }
  }

  void setGenre(String? genre) {
    loadHome(genre: genre);
  }
}

// Home Provider
final homeProvider = StateNotifierProvider<HomeNotifier, HomeState>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return HomeNotifier(apiService);
});

// Movie Details State
class MovieDetailsState {
  final bool isLoading;
  final String? error;
  final Movie? movie;
  final List<Review> reviews;
  final bool isInMyList;
  final bool isInFavorites;
  final bool isInWatchlist;

  const MovieDetailsState({
    this.isLoading = false,
    this.error,
    this.movie,
    this.reviews = const [],
    this.isInMyList = false,
    this.isInFavorites = false,
    this.isInWatchlist = false,
  });

  MovieDetailsState copyWith({
    bool? isLoading,
    String? error,
    Movie? movie,
    List<Review>? reviews,
    bool? isInMyList,
    bool? isInFavorites,
    bool? isInWatchlist,
  }) {
    return MovieDetailsState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      movie: movie ?? this.movie,
      reviews: reviews ?? this.reviews,
      isInMyList: isInMyList ?? this.isInMyList,
      isInFavorites: isInFavorites ?? this.isInFavorites,
      isInWatchlist: isInWatchlist ?? this.isInWatchlist,
    );
  }
}

// Movie Details Notifier
class MovieDetailsNotifier extends StateNotifier<MovieDetailsState> {
  final ApiService _apiService;

  MovieDetailsNotifier(this._apiService) : super(const MovieDetailsState());

  Future<void> loadMovie(String movieId) async {
    state = const MovieDetailsState(isLoading: true);

    try {
      final movie = await _apiService.getMovie(movieId);
      
      // Load reviews (non-blocking - continue even if fails)
      List<Review> reviews = [];
      try {
        reviews = await _apiService.getReviews(movieId);
      } catch (e) {
        print('Failed to load reviews: $e');
      }
      
      // Check user lists (non-blocking - continue even if fails)
      bool isInMyList = false;
      bool isInFavorites = false;
      bool isInWatchlist = false;
      
      try {
        final profile = await _apiService.getUserProfile();
        final myList = (profile['myList'] as List?)?.map((e) => e['_id'] ?? e).toList() ?? [];
        final favorites = (profile['favorites'] as List?)?.map((e) => e['_id'] ?? e).toList() ?? [];
        final watchlist = (profile['watchlist'] as List?)?.map((e) => e['_id'] ?? e).toList() ?? [];
        
        isInMyList = myList.contains(movieId);
        isInFavorites = favorites.contains(movieId);
        isInWatchlist = watchlist.contains(movieId);
      } catch (e) {
        print('Failed to load user profile: $e');
      }

      state = MovieDetailsState(
        isLoading: false,
        movie: movie,
        reviews: reviews,
        isInMyList: isInMyList,
        isInFavorites: isInFavorites,
        isInWatchlist: isInWatchlist,
      );
    } catch (e) {
      print('Failed to load movie: $e');
      state = MovieDetailsState(
        isLoading: false,
        error: 'Failed to load movie details',
      );
    }
  }

  Future<void> toggleMyList() async {
    if (state.movie == null) return;
    
    try {
      if (state.isInMyList) {
        await _apiService.removeFromMyList(state.movie!.id);
      } else {
        await _apiService.addToMyList(state.movie!.id);
      }
      state = state.copyWith(isInMyList: !state.isInMyList);
    } catch (e) {
      // Handle error
    }
  }

  Future<void> toggleFavorites() async {
    if (state.movie == null) return;
    
    try {
      if (state.isInFavorites) {
        await _apiService.removeFromFavorites(state.movie!.id);
      } else {
        await _apiService.addToFavorites(state.movie!.id);
      }
      state = state.copyWith(isInFavorites: !state.isInFavorites);
    } catch (e) {
      // Handle error
    }
  }

  Future<void> toggleWatchlist() async {
    if (state.movie == null) return;
    
    try {
      if (state.isInWatchlist) {
        await _apiService.removeFromWatchlist(state.movie!.id);
      } else {
        await _apiService.addToWatchlist(state.movie!.id);
      }
      state = state.copyWith(isInWatchlist: !state.isInWatchlist);
    } catch (e) {
      // Handle error
    }
  }

  Future<void> addReview(double rating, String text) async {
    if (state.movie == null) return;
    
    try {
      await _apiService.addReview(state.movie!.id, rating, text);
      // Reload reviews
      final reviews = await _apiService.getReviews(state.movie!.id);
      state = state.copyWith(reviews: reviews);
    } catch (e) {
      // Handle error
    }
  }
}

// Movie Details Provider (family for per-movie state)
final movieDetailsProvider = StateNotifierProvider.family<MovieDetailsNotifier, MovieDetailsState, String>((ref, movieId) {
  final apiService = ref.watch(apiServiceProvider);
  return MovieDetailsNotifier(apiService);
});
