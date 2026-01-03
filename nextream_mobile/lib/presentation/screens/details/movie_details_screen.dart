import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme/app_colors.dart';
import '../../../providers/providers.dart';
import '../../widgets/widgets.dart';

class MovieDetailsScreen extends ConsumerStatefulWidget {
  final String movieId;

  const MovieDetailsScreen({super.key, required this.movieId});

  @override
  ConsumerState<MovieDetailsScreen> createState() => _MovieDetailsScreenState();
}

class _MovieDetailsScreenState extends ConsumerState<MovieDetailsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(movieDetailsProvider(widget.movieId).notifier).loadMovie(widget.movieId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(movieDetailsProvider(widget.movieId));
    final movie = state.movie;

    if (state.isLoading) {
      return const LoadingScreen(message: 'Loading movie details...');
    }

    if (state.error != null || movie == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(backgroundColor: Colors.transparent),
        body: ErrorDisplay(
          message: state.error ?? 'Movie not found',
          onRetry: () => ref.read(movieDetailsProvider(widget.movieId).notifier).loadMovie(widget.movieId),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // Hero Image with back button
          SliverAppBar(
            expandedHeight: MediaQuery.of(context).size.height * 0.5,
            pinned: true,
            backgroundColor: AppColors.background,
            leading: Container(
              margin: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
                shape: BoxShape.circle,
              ),
              child: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.pop(),
              ),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  CachedNetworkImage(
                    imageUrl: movie.img,
                    fit: BoxFit.cover,
                    errorWidget: (context, url, error) => Container(
                      color: AppColors.surface,
                      child: const Icon(Icons.movie, size: 100, color: AppColors.textMuted),
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withOpacity(0.5),
                          AppColors.background,
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    movie.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Meta info row
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      if (movie.year != null)
                        Text(
                          movie.year!,
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                      if (movie.duration != null)
                        Text(
                          movie.duration!,
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                      if (movie.genre != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.textSecondary),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            movie.genre!,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      if (movie.limit != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.textSecondary),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${movie.limit}+',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Rating
                  if (movie.avgRating != null && movie.avgRating! > 0)
                    Row(
                      children: [
                        ...List.generate(5, (index) {
                          final starValue = index + 1;
                          if (movie.avgRating! >= starValue) {
                            return const Icon(Icons.star, color: AppColors.star, size: 20);
                          } else if (movie.avgRating! >= starValue - 0.5) {
                            return const Icon(Icons.star_half, color: AppColors.star, size: 20);
                          }
                          return const Icon(Icons.star_border, color: AppColors.star, size: 20);
                        }),
                        const SizedBox(width: 8),
                        Text(
                          movie.avgRating!.toStringAsFixed(1),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                        if (movie.numRatings != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            '(${movie.numRatings} reviews)',
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                          ),
                        ],
                      ],
                    ),
                  const SizedBox(height: 20),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => context.push('/player/${movie.id}'),
                          icon: const Icon(Icons.play_arrow),
                          label: const Text('Play'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // List Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: _ActionButton(
                          icon: state.isInMyList ? Icons.check : Icons.add,
                          label: 'My List',
                          isActive: state.isInMyList,
                          onTap: () => ref.read(movieDetailsProvider(widget.movieId).notifier).toggleMyList(),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ActionButton(
                          icon: state.isInFavorites ? Icons.favorite : Icons.favorite_border,
                          label: 'Favorite',
                          isActive: state.isInFavorites,
                          activeColor: AppColors.primary,
                          onTap: () => ref.read(movieDetailsProvider(widget.movieId).notifier).toggleFavorites(),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ActionButton(
                          icon: state.isInWatchlist ? Icons.bookmark : Icons.bookmark_border,
                          label: 'Watchlist',
                          isActive: state.isInWatchlist,
                          activeColor: AppColors.info,
                          onTap: () => ref.read(movieDetailsProvider(widget.movieId).notifier).toggleWatchlist(),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Description
                  const Text(
                    'Description',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    movie.desc,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 15,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Reviews Section
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Reviews',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '${state.reviews.length} reviews',
                        style: const TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  if (state.reviews.isEmpty)
                    const Center(
                      child: Text(
                        'No reviews yet. Be the first to review!',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    )
                  else
                    ...state.reviews.take(5).map((review) => Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 16,
                                    backgroundColor: AppColors.surfaceLight,
                                    child: Text(
                                      review.username[0].toUpperCase(),
                                      style: const TextStyle(color: Colors.white),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          review.username,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        Row(
                                          children: List.generate(
                                            5,
                                            (i) => Icon(
                                              i < review.rating ? Icons.star : Icons.star_border,
                                              color: AppColors.star,
                                              size: 14,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                review.text,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        )),

                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final Color? activeColor;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
    this.activeColor,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isActive ? (activeColor ?? AppColors.success).withOpacity(0.2) : AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isActive ? (activeColor ?? AppColors.success) : AppColors.surfaceLight,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isActive ? (activeColor ?? AppColors.success) : AppColors.textSecondary,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isActive ? (activeColor ?? AppColors.success) : AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
