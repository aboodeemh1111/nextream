import 'package:flutter/material.dart';

/// App Color Palette matching web design
class AppColors {
  AppColors._();

  // Primary Colors
  static const Color primary = Color(0xFFDC2626);       // red-600
  static const Color primaryDark = Color(0xFFB91C1C);   // red-700
  static const Color primaryLight = Color(0xFFEF4444);  // red-500

  // Background Colors
  static const Color background = Color(0xFF111827);    // gray-900
  static const Color surface = Color(0xFF1F2937);       // gray-800
  static const Color surfaceLight = Color(0xFF374151);  // gray-700
  static const Color surfaceDark = Color(0xFF030712);   // gray-950

  // Text Colors
  static const Color textPrimary = Colors.white;
  static const Color textSecondary = Color(0xFF9CA3AF); // gray-400
  static const Color textMuted = Color(0xFF6B7280);     // gray-500

  // Accent Colors
  static const Color success = Color(0xFF22C55E);       // green-500
  static const Color warning = Color(0xFFFBBF24);       // yellow-400
  static const Color error = Color(0xFFEF4444);         // red-500
  static const Color info = Color(0xFF3B82F6);          // blue-500

  // Gradient Colors
  static const Color gradientStart = Color(0xFFDC2626); // red-600
  static const Color gradientMiddle = Color(0xFFC026D3); // fuchsia-600
  static const Color gradientEnd = Color(0xFF0891B2);   // cyan-600

  // Rating
  static const Color star = Color(0xFFFBBF24);          // yellow-400
}
