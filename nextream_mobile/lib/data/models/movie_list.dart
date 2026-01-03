import 'package:equatable/equatable.dart';

/// MovieList model for home screen content lists
class MovieList extends Equatable {
  final String id;
  final String title;
  final String type;
  final String? genre;

  const MovieList({
    required this.id,
    required this.title,
    required this.type,
    this.genre,
  });

  factory MovieList.fromJson(Map<String, dynamic> json) {
    return MovieList(
      id: json['_id'] ?? '',
      title: json['title'] ?? '',
      type: json['type'] ?? '',
      genre: json['genre'],
    );
  }

  @override
  List<Object?> get props => [id, title, type, genre];
}
