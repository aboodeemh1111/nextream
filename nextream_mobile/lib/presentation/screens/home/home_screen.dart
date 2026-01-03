import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../providers/providers.dart';
import '../../widgets/widgets.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String? _selectedGenre;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(homeProvider.notifier).loadHome();
    });
  }

  @override
  Widget build(BuildContext context) {
    final homeState = ref.watch(homeProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        onRefresh: () => ref.read(homeProvider.notifier).loadHome(genre: _selectedGenre),
        child: CustomScrollView(
          slivers: [
            // App Bar
            SliverAppBar(
              floating: true,
              backgroundColor: AppColors.background.withOpacity(0.9),
              title: ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [
                    AppColors.primary,
                    AppColors.gradientMiddle,
                    AppColors.gradientEnd,
                  ],
                ).createShader(bounds),
                child: const Text(
                  'NEXTREAM',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                    color: Colors.white,
                  ),
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: () => context.push('/search'),
                ),
                IconButton(
                  icon: const Icon(Icons.person_outline),
                  onPressed: () => context.push('/profile'),
                ),
              ],
            ),

            // Featured Banner
            SliverToBoxAdapter(
              child: FeaturedBanner(
                movie: homeState.featuredMovie,
                isLoading: homeState.isLoading && homeState.featuredMovie == null,
                onPlayTap: homeState.featuredMovie != null
                    ? () => context.push('/player/${homeState.featuredMovie!.id}')
                    : null,
                onInfoTap: homeState.featuredMovie != null
                    ? () => context.push('/details/${homeState.featuredMovie!.id}')
                    : null,
              ),
            ),

            // Genre Filter
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Text(
                      'Browse',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        border: Border.all(color: AppColors.surfaceLight),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: DropdownButton<String?>(
                        value: _selectedGenre,
                        hint: const Text(
                          'All Genres',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                        dropdownColor: AppColors.surface,
                        underline: const SizedBox(),
                        icon: const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('All Genres', style: TextStyle(color: Colors.white)),
                          ),
                          ...AppConstants.genres.map((genre) => DropdownMenuItem(
                                value: genre,
                                child: Text(
                                  genre[0].toUpperCase() + genre.substring(1),
                                  style: const TextStyle(color: Colors.white),
                                ),
                              )),
                        ],
                        onChanged: (value) {
                          setState(() {
                            _selectedGenre = value;
                          });
                          ref.read(homeProvider.notifier).setGenre(value);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Loading State
            if (homeState.isLoading && homeState.lists.isEmpty)
              const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              ),

            // Error State
            if (homeState.error != null && homeState.lists.isEmpty)
              SliverFillRemaining(
                child: ErrorDisplay(
                  message: homeState.error!,
                  onRetry: () => ref.read(homeProvider.notifier).loadHome(genre: _selectedGenre),
                ),
              ),

            // Movie Lists
            if (homeState.lists.isNotEmpty)
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final list = homeState.lists[index];
                    final movies = homeState.listContents[list.id] ?? [];

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: HorizontalMovieList(
                        title: list.title,
                        movies: movies,
                        isLoading: movies.isEmpty,
                        onMovieTap: (movie) => context.push('/details/${movie.id}'),
                      ),
                    );
                  },
                  childCount: homeState.lists.length,
                ),
              ),

            // Bottom spacing
            const SliverToBoxAdapter(
              child: SizedBox(height: 100),
            ),
          ],
        ),
      ),
    );
  }
}
