import 'package:equatable/equatable.dart';

/// Movie model matching web client
class Movie extends Equatable {
  final String id;
  final String title;
  final String desc;
  final String img;
  final String? imgTitle;
  final String? imgSm;
  final String? trailer;
  final String? video;
  final String? year;
  final int? limit;
  final String? genre;
  final String? duration;
  final bool isSeries;
  final double? avgRating;
  final int? numRatings;
  final double? progress;

  const Movie({
    required this.id,
    required this.title,
    required this.desc,
    required this.img,
    this.imgTitle,
    this.imgSm,
    this.trailer,
    this.video,
    this.year,
    this.limit,
    this.genre,
    this.duration,
    this.isSeries = false,
    this.avgRating,
    this.numRatings,
    this.progress,
  });

  factory Movie.fromJson(Map<String, dynamic> json) {
    return Movie(
      id: json['_id'] ?? '',
      title: json['title'] ?? '',
      desc: json['desc'] ?? '',
      img: json['img'] ?? '',
      imgTitle: json['imgTitle'],
      imgSm: json['imgSm'],
      trailer: json['trailer'],
      video: json['video'],
      year: json['year'],
      limit: json['limit'],
      genre: json['genre'],
      duration: json['duration'],
      isSeries: json['isSeries'] ?? false,
      avgRating: (json['avgRating'] as num?)?.toDouble(),
      numRatings: json['numRatings'],
      progress: (json['progress'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'desc': desc,
      'img': img,
      'imgTitle': imgTitle,
      'imgSm': imgSm,
      'trailer': trailer,
      'video': video,
      'year': year,
      'limit': limit,
      'genre': genre,
      'duration': duration,
      'isSeries': isSeries,
      'avgRating': avgRating,
      'numRatings': numRatings,
      'progress': progress,
    };
  }

  String get displayImage => imgSm ?? img;

  @override
  List<Object?> get props => [
        id,
        title,
        desc,
        img,
        imgTitle,
        imgSm,
        trailer,
        video,
        year,
        limit,
        genre,
        duration,
        isSeries,
        avgRating,
        numRatings,
        progress,
      ];
}
