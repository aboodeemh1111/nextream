import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../data/models/models.dart';
import '../data/services/api_service.dart';
import '../core/constants/app_constants.dart';

// API Service Provider
final apiServiceProvider = Provider<ApiService>((ref) => ApiService());

// Auth State
enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthState {
  final AuthStatus status;
  final User? user;
  final String? error;

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.error,
  });

  AuthState copyWith({
    AuthStatus? status,
    User? user,
    String? error,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      error: error,
    );
  }
}

// Auth Notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final ApiService _apiService;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthNotifier(this._apiService) : super(const AuthState()) {
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    state = state.copyWith(status: AuthStatus.loading);
    
    try {
      final userJson = await _storage.read(key: AppConstants.userStorageKey);
      if (userJson != null) {
        final user = User.fromJson(jsonDecode(userJson));
        state = AuthState(status: AuthStatus.authenticated, user: user);
      } else {
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    } catch (e) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, error: null);
    
    try {
      final user = await _apiService.login(email, password);
      await _storage.write(
        key: AppConstants.userStorageKey,
        value: jsonEncode(user.toJson()),
      );
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (e) {
      String errorMessage = 'Login failed. Please try again.';
      if (e.toString().contains('401')) {
        errorMessage = 'Invalid email or password';
      }
      state = AuthState(
        status: AuthStatus.error,
        error: errorMessage,
      );
    }
  }

  Future<void> register(String username, String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, error: null);
    
    try {
      await _apiService.register(username, email, password);
      state = const AuthState(status: AuthStatus.unauthenticated);
    } catch (e) {
      String errorMessage = 'Registration failed. Please try again.';
      if (e.toString().contains('409')) {
        errorMessage = 'Email already exists';
      }
      state = AuthState(
        status: AuthStatus.error,
        error: errorMessage,
      );
    }
  }

  Future<void> logout() async {
    await _apiService.logout();
    await _storage.delete(key: AppConstants.userStorageKey);
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

// Auth Provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return AuthNotifier(apiService);
});

// Convenience providers
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).status == AuthStatus.authenticated;
});

final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authProvider).user;
});
