import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../providers/providers.dart';
import '../../widgets/widgets.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      ref.read(searchProvider.notifier).search(query);
    });
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(searchProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: TextField(
          controller: _searchController,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Search movies & series...',
            hintStyle: const TextStyle(color: AppColors.textMuted),
            border: InputBorder.none,
            filled: true,
            fillColor: AppColors.surface,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
            suffixIcon: _searchController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, color: AppColors.textSecondary),
                    onPressed: () {
                      _searchController.clear();
                      ref.read(searchProvider.notifier).clearSearch();
                    },
                  )
                : null,
          ),
          onChanged: _onSearchChanged,
        ),
      ),
      body: Column(
        children: [
          // Filters
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    label: 'All',
                    isSelected: searchState.typeFilter == null,
                    onTap: () => ref.read(searchProvider.notifier).setTypeFilter(null),
                  ),
                  _FilterChip(
                    label: 'Movies',
                    isSelected: searchState.typeFilter == 'movie',
                    onTap: () => ref.read(searchProvider.notifier).setTypeFilter('movie'),
                  ),
                  _FilterChip(
                    label: 'Series',
                    isSelected: searchState.typeFilter == 'series',
                    onTap: () => ref.read(searchProvider.notifier).setTypeFilter('series'),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.surfaceLight),
                    ),
                    child: DropdownButton<String?>(
                      value: searchState.genreFilter,
                      hint: const Text('Genre', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                      dropdownColor: AppColors.surface,
                      underline: const SizedBox(),
                      icon: const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary, size: 20),
                      isDense: true,
                      items: [
                        const DropdownMenuItem<String?>(value: null, child: Text('All Genres', style: TextStyle(color: Colors.white, fontSize: 14))),
                        ...AppConstants.genres.map((genre) => DropdownMenuItem(
                              value: genre,
                              child: Text(
                                genre[0].toUpperCase() + genre.substring(1),
                                style: const TextStyle(color: Colors.white, fontSize: 14),
                              ),
                            )),
                      ],
                      onChanged: (value) => ref.read(searchProvider.notifier).setGenreFilter(value),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Results
          Expanded(
            child: searchState.query.isEmpty
                ? const EmptyState(
                    icon: Icons.search,
                    title: 'Search for movies & series',
                    subtitle: 'Find your favorite content by searching above',
                  )
                : searchState.isLoading
                    ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                    : searchState.error != null
                        ? ErrorDisplay(message: searchState.error!)
                        : searchState.results.isEmpty
                            ? EmptyState(
                                icon: Icons.movie_filter,
                                title: 'No results found',
                                subtitle: 'Try different keywords or filters',
                              )
                            : GridView.builder(
                                padding: const EdgeInsets.all(16),
                                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 3,
                                  childAspectRatio: 0.65,
                                  crossAxisSpacing: 12,
                                  mainAxisSpacing: 12,
                                ),
                                itemCount: searchState.results.length,
                                itemBuilder: (context, index) {
                                  final movie = searchState.results[index];
                                  return MovieCard(
                                    movie: movie,
                                    onTap: () => context.push('/details/${movie.id}'),
                                  );
                                },
                              ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.surfaceLight,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : AppColors.textSecondary,
              fontSize: 14,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }
}
