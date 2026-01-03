import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/models.dart';
import '../data/services/api_service.dart';
import 'auth_provider.dart';

// Search State
class SearchState {
  final bool isLoading;
  final String? error;
  final List<Movie> results;
  final String query;
  final String? typeFilter; // 'movie', 'series', or null for all
  final String? genreFilter;

  const SearchState({
    this.isLoading = false,
    this.error,
    this.results = const [],
    this.query = '',
    this.typeFilter,
    this.genreFilter,
  });

  SearchState copyWith({
    bool? isLoading,
    String? error,
    List<Movie>? results,
    String? query,
    String? typeFilter,
    String? genreFilter,
  }) {
    return SearchState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      results: results ?? this.results,
      query: query ?? this.query,
      typeFilter: typeFilter,
      genreFilter: genreFilter,
    );
  }
}

// Search Notifier
class SearchNotifier extends StateNotifier<SearchState> {
  final ApiService _apiService;

  SearchNotifier(this._apiService) : super(const SearchState());

  Future<void> search(String query) async {
    if (query.trim().isEmpty) {
      state = const SearchState();
      return;
    }

    state = state.copyWith(isLoading: true, query: query, error: null);

    try {
      bool? isSeries;
      if (state.typeFilter == 'movie') {
        isSeries = false;
      } else if (state.typeFilter == 'series') {
        isSeries = true;
      }

      final results = await _apiService.searchMovies(
        query,
        genre: state.genreFilter,
        isSeries: isSeries,
      );

      state = state.copyWith(isLoading: false, results: results);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Search failed',
      );
    }
  }

  void setTypeFilter(String? type) {
    state = state.copyWith(typeFilter: type);
    if (state.query.isNotEmpty) {
      search(state.query);
    }
  }

  void setGenreFilter(String? genre) {
    state = state.copyWith(genreFilter: genre);
    if (state.query.isNotEmpty) {
      search(state.query);
    }
  }

  void clearFilters() {
    state = state.copyWith(typeFilter: null, genreFilter: null);
    if (state.query.isNotEmpty) {
      search(state.query);
    }
  }

  void clearSearch() {
    state = const SearchState();
  }
}

// Search Provider
final searchProvider = StateNotifierProvider<SearchNotifier, SearchState>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return SearchNotifier(apiService);
});
