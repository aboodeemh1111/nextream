import 'package:equatable/equatable.dart';

/// Review model for movie reviews
class Review extends Equatable {
  final String id;
  final String movieId;
  final String userId;
  final String username;
  final String? userProfilePic;
  final double rating;
  final String text;
  final DateTime createdAt;

  const Review({
    required this.id,
    required this.movieId,
    required this.userId,
    required this.username,
    this.userProfilePic,
    required this.rating,
    required this.text,
    required this.createdAt,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['_id'] ?? '',
      movieId: json['movieId'] ?? '',
      userId: json['userId']?['_id'] ?? json['userId'] ?? '',
      username: json['userId']?['username'] ?? json['username'] ?? 'Anonymous',
      userProfilePic: json['userId']?['profilePic'],
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      text: json['text'] ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'movieId': movieId,
      'userId': userId,
      'username': username,
      'rating': rating,
      'text': text,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  @override
  List<Object?> get props => [id, movieId, userId, username, rating, text, createdAt];
}
