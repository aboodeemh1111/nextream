import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Share,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getMovieDetails } from "../../src/services/contentService";
import { COLORS, DEFAULT_BACKDROP, DEFAULT_POSTER } from "../../src/config";
import { useAuth } from "../../src/context/AuthContext";

const { width, height } = Dimensions.get("window");

export default function MovieDetailScreen() {
  const params = useLocalSearchParams();
  const movieId = params.id as string;
  const { user } = useAuth();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMovieDetails();
  }, [movieId]);

  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMovieDetails(movieId);
      setMovie(data);
    } catch (err) {
      console.error("Error fetching movie details:", err);
      setError("Unable to load movie details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    if (!movie) return;

    router.push({
      pathname: "/video",
      params: {
        videoUrl: movie.video,
        title: movie.title,
        contentId: movie._id,
        type: "movie",
      },
    });
  };

  const handleAddToList = () => {
    // Implement add to watchlist functionality
    console.log("Add to my list:", movie?.title);
  };

  const handleShare = async () => {
    try {
      if (!movie) return;

      await Share.share({
        message: `Check out "${movie.title}" on Nextream! ${movie.desc}`,
        title: `Watch ${movie.title} on Nextream`,
      });
    } catch (error) {
      console.error("Error sharing content:", error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchMovieDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!movie) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Movie not found</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar translucent backgroundColor="transparent" />

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: movie.img || DEFAULT_BACKDROP }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.9)", COLORS.background]}
            style={styles.gradientOverlay}
          />
        </View>

        {/* Movie Info */}
        <View style={styles.infoContainer}>
          {/* Poster and Title */}
          <View style={styles.headerContainer}>
            <Image
              source={{ uri: movie.imgSm || movie.img || DEFAULT_POSTER }}
              style={styles.poster}
              resizeMode="cover"
            />
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{movie.title}</Text>
              <View style={styles.metaContainer}>
                {movie.year && (
                  <Text style={styles.metaText}>{movie.year}</Text>
                )}
                {movie.limit && (
                  <View style={styles.limitBadge}>
                    <Text style={styles.limitText}>{movie.limit}+</Text>
                  </View>
                )}
                {movie.duration && (
                  <Text style={styles.metaText}>{movie.duration}</Text>
                )}
              </View>
              {movie.genre && (
                <Text style={styles.genreText}>{movie.genre}</Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
              <Ionicons name="play" size={20} color="#000" />
              <Text style={styles.playButtonText}>Play</Text>
            </TouchableOpacity>

            <View style={styles.smallButtonsContainer}>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={handleAddToList}
              >
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.smallButtonText}>My List</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smallButton}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={22} color="#fff" />
                <Text style={styles.smallButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>{movie.desc}</Text>

          {/* Trailer Section */}
          {movie.trailer && (
            <View style={styles.trailerContainer}>
              <Text style={styles.sectionTitle}>Trailer</Text>
              <TouchableOpacity
                style={styles.trailerThumbnail}
                onPress={() =>
                  router.push({
                    pathname: "/video",
                    params: {
                      videoUrl: movie.trailer,
                      title: `${movie.title} - Trailer`,
                      isTrailer: "true",
                    },
                  })
                }
              >
                <Image
                  source={{
                    uri: movie.imgTitle || movie.img || DEFAULT_BACKDROP,
                  }}
                  style={styles.trailerImage}
                  resizeMode="cover"
                />
                <View style={styles.playIconContainer}>
                  <Ionicons name="play-circle" size={50} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Additional Info */}
          <View style={styles.additionalInfoContainer}>
            {movie.director && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Director:</Text>
                <Text style={styles.infoValue}>{movie.director}</Text>
              </View>
            )}

            {movie.cast && movie.cast.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cast:</Text>
                <Text style={styles.infoValue}>{movie.cast.join(", ")}</Text>
              </View>
            )}

            {movie.tags && movie.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {movie.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorText: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 16,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  heroContainer: {
    height: height * 0.4,
    width: width,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 8,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  title: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metaText: {
    color: "#CCC",
    fontSize: 14,
    marginRight: 8,
  },
  genreText: {
    color: "#CCC",
    fontSize: 14,
  },
  limitBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
  },
  limitText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  actionContainer: {
    marginBottom: 20,
  },
  playButton: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  playButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 4,
  },
  smallButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  smallButton: {
    alignItems: "center",
  },
  smallButtonText: {
    color: "#CCC",
    fontSize: 12,
    marginTop: 4,
  },
  description: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  trailerContainer: {
    marginBottom: 24,
  },
  trailerThumbnail: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  trailerImage: {
    width: "100%",
    height: "100%",
  },
  playIconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  additionalInfoContainer: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    color: "#CCC",
    fontSize: 14,
    width: 80,
  },
  infoValue: {
    color: "#FFF",
    fontSize: 14,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  tag: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: "#FFF",
    fontSize: 12,
  },
});
