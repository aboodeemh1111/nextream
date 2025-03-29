import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  FlatList,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  RefreshControl,
} from "react-native";
import { Stack, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getContentByGenre } from "../../src/services/contentService";
import { COLORS, DEFAULT_BACKDROP, DEFAULT_POSTER } from "../../src/config";
import HeroBanner from "../../components/HeroBanner";
import ContentRow from "../../components/ContentRow";

const { width, height } = Dimensions.get("window");

// Content categories for home screen
const CONTENT_CATEGORIES = [
  { id: "trending", title: "Trending Now" },
  { id: "action", title: "Action & Adventure" },
  { id: "comedy", title: "Comedy" },
  { id: "drama", title: "Drama" },
  { id: "horror", title: "Horror" },
  { id: "sci-fi", title: "Sci-Fi" },
];

export default function HomeTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Nextream Mobile</Text>

      <Text style={styles.description}>
        This is the original home tab. We've created a new Netflix-style home
        screen that you can access below.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/home")}
      >
        <Text style={styles.buttonText}>Go to Netflix-Style Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 20,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "bold",
  },
});
