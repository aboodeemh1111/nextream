import 'package:equatable/equatable.dart';

/// User model matching web client
class User extends Equatable {
  final String id;
  final String username;
  final String email;
  final String? profilePic;
  final bool isAdmin;
  final String accessToken;

  const User({
    required this.id,
    required this.username,
    required this.email,
    this.profilePic,
    required this.isAdmin,
    required this.accessToken,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      profilePic: json['profilePic'],
      isAdmin: json['isAdmin'] ?? false,
      accessToken: json['accessToken'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'username': username,
      'email': email,
      'profilePic': profilePic,
      'isAdmin': isAdmin,
      'accessToken': accessToken,
    };
  }

  User copyWith({
    String? id,
    String? username,
    String? email,
    String? profilePic,
    bool? isAdmin,
    String? accessToken,
  }) {
    return User(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      profilePic: profilePic ?? this.profilePic,
      isAdmin: isAdmin ?? this.isAdmin,
      accessToken: accessToken ?? this.accessToken,
    );
  }

  @override
  List<Object?> get props => [id, username, email, profilePic, isAdmin, accessToken];
}
