import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../screens/home/home_screen.dart';
import '../screens/search/search_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/details/movie_details_screen.dart';
import '../screens/player/video_player_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/splash/splash_screen.dart';

// Since we might need context for Auth re-direction later, we keep it simple for now.
// If there's an auth provider, we would watch it here.

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: true,
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/search',
        builder: (context, state) => const SearchScreen(),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/details/:movieId',
        builder: (context, state) {
          final movieId = state.pathParameters['movieId']!;
          return MovieDetailsScreen(movieId: movieId);
        },
      ),
      GoRoute(
        path: '/player/:movieId',
        builder: (context, state) {
          final movieId = state.pathParameters['movieId']!;
          return VideoPlayerScreen(movieId: movieId);
        },
      ),
    ],
  );
});
