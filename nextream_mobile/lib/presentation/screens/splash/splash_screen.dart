import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // Simulate splash duration
    Timer(const Duration(seconds: 9), () {
      if (mounted) {
        context.go('/home');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black, // Requested: Black background
      body: Center(
        child: SizedBox(
          width: MediaQuery.of(context).size.width * 0.8, // Requested: Bigger GIF
          height: MediaQuery.of(context).size.height * 0.5,
          child: Image.asset(
            'assets/images/splash.gif',
            fit: BoxFit.contain, // Ensure it scales nicely
          ),
        ),
      ),
    );
  }
}
