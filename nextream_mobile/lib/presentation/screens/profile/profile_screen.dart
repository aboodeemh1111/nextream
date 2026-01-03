import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme/app_colors.dart';
import '../../../providers/providers.dart';
import '../../widgets/widgets.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(profileProvider.notifier).loadProfile();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileState = ref.watch(profileProvider);
    final user = ref.watch(currentUserProvider);

    if (profileState.isLoading && profileState.username.isEmpty) {
      return const LoadingScreen(message: 'Loading profile...');
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Text('Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: AppColors.primary),
            onPressed: () {
              ref.read(authProvider.notifier).logout();
              context.go('/login');
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => ref.read(profileProvider.notifier).loadProfile(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              // Profile Header
              Container(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    // Avatar
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.surface,
                        border: Border.all(color: AppColors.primary, width: 3),
                      ),
                      child: profileState.profilePic != null
                          ? ClipOval(
                              child: CachedNetworkImage(
                                imageUrl: profileState.profilePic!,
                                fit: BoxFit.cover,
                              ),
                            )
                          : Center(
                              child: Text(
                                profileState.username.isNotEmpty ? profileState.username[0].toUpperCase() : '?',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 40,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      profileState.username,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      profileState.email,
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),

              // Stats Cards
              if (profileState.metrics != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          icon: Icons.access_time,
                          value: '${profileState.metrics!.totalWatchTime ~/ 60}',
                          label: 'Minutes watched',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _StatCard(
                          icon: Icons.movie,
                          value: '${profileState.metrics!.totalTitlesWatched}',
                          label: 'Titles watched',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _StatCard(
                          icon: Icons.favorite,
                          value: '${profileState.metrics!.favoritesCount}',
                          label: 'Favorites',
                        ),
                      ),
                    ],
                  ),
                ),

              const SizedBox(height: 20),

              // Tab Bar
              Container(
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppColors.surfaceLight)),
                ),
                child: TabBar(
                  controller: _tabController,
                  isScrollable: true,
                  indicatorColor: AppColors.primary,
                  labelColor: AppColors.primary,
                  unselectedLabelColor: AppColors.textSecondary,
                  tabs: const [
                    Tab(text: 'Continue'),
                    Tab(text: 'My List'),
                    Tab(text: 'Favorites'),
                    Tab(text: 'Watchlist'),
                    Tab(text: 'History'),
                  ],
                ),
              ),

              // Tab Content
              SizedBox(
                height: 300,
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // Continue Watching
                    _buildMovieList(
                      profileState.currentlyWatching.map((e) => e.movie).toList(),
                      Icons.play_arrow,
                      'Nothing in progress',
                      'Start watching to see your progress here',
                      showProgress: true,
                    ),

                    // My List
                    _buildMovieList(
                      profileState.myList,
                      Icons.list,
                      'Your list is empty',
                      'Add movies to watch later',
                    ),

                    // Favorites
                    _buildMovieList(
                      profileState.favorites,
                      Icons.favorite,
                      'No favorites yet',
                      'Add your favorite movies here',
                    ),

                    // Watchlist
                    _buildMovieList(
                      profileState.watchlist,
                      Icons.bookmark,
                      'Watchlist is empty',
                      'Add movies you want to watch',
                    ),

                    // Watch History
                    _buildMovieList(
                      profileState.watchHistory.map((e) => e.movie).toList(),
                      Icons.history,
                      'No watch history',
                      'Your watched movies will appear here',
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMovieList(
    List movies,
    IconData emptyIcon,
    String emptyTitle,
    String emptySubtitle, {
    bool showProgress = false,
  }) {
    if (movies.isEmpty) {
      return EmptyState(
        icon: emptyIcon,
        title: emptyTitle,
        subtitle: emptySubtitle,
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.65,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: movies.length,
      itemBuilder: (context, index) {
        final movie = movies[index];
        return MovieCard(
          movie: movie,
          showProgress: showProgress,
          onTap: () => context.push('/details/${movie.id}'),
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, color: AppColors.primary, size: 24),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
