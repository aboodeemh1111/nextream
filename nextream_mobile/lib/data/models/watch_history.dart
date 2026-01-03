import 'package:equatable/equatable.dart';
import 'movie.dart';

/// Watch history item
class WatchHistoryItem extends Equatable {
  final String id;
  final Movie movie;
  final DateTime watchedAt;
  final double progress;
  final bool completed;

  const WatchHistoryItem({
    required this.id,
    required this.movie,
    required this.watchedAt,
    required this.progress,
    required this.completed,
  });

  factory WatchHistoryItem.fromJson(Map<String, dynamic> json) {
    return WatchHistoryItem(
      id: json['_id'] ?? '',
      movie: Movie.fromJson(json['movie'] ?? {}),
      watchedAt: json['watchedAt'] != null
          ? DateTime.parse(json['watchedAt'])
          : DateTime.now(),
      progress: (json['progress'] as num?)?.toDouble() ?? 0.0,
      completed: json['completed'] ?? false,
    );
  }

  @override
  List<Object?> get props => [id, movie, watchedAt, progress, completed];
}

/// Currently watching item
class CurrentlyWatchingItem extends Equatable {
  final String id;
  final Movie movie;
  final DateTime lastWatchedAt;
  final double progress;

  const CurrentlyWatchingItem({
    required this.id,
    required this.movie,
    required this.lastWatchedAt,
    required this.progress,
  });

  factory CurrentlyWatchingItem.fromJson(Map<String, dynamic> json) {
    return CurrentlyWatchingItem(
      id: json['_id'] ?? '',
      movie: Movie.fromJson(json['movie'] ?? {}),
      lastWatchedAt: json['lastWatchedAt'] != null
          ? DateTime.parse(json['lastWatchedAt'])
          : DateTime.now(),
      progress: (json['progress'] as num?)?.toDouble() ?? 0.0,
    );
  }

  @override
  List<Object?> get props => [id, movie, lastWatchedAt, progress];
}
