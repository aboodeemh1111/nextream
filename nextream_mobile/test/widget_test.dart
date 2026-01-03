import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:nextream_mobile/main.dart';

void main() {
  testWidgets('App starts and shows login screen', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: NextreamApp(),
      ),
    );

    // Wait for widgets to settle
    await tester.pumpAndSettle();

    // Verify that the app starts with authentication screen
    expect(find.text('NEXTREAM'), findsOneWidget);
  });
}
