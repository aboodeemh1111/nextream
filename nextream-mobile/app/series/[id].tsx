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
  FlatList,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getSeriesDetails } from "../../src/services/contentService";
import { COLORS, DEFAULT_BACKDROP, DEFAULT_POSTER } from "../../src/config";
import { useAuth } from "../../src/context/AuthContext";

const { width, height } = Dimensions.get("window");

export default function SeriesDetailScreen() {
  const params = useLocalSearchParams();
  const seriesId = params.id as string;
  const { user } = useAuth();

  // States
  const [series, setSeries] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);

  useEffect(() => {
    fetchSeriesDetails();
  }, [seriesId]);

  const fetchSeriesDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSeriesDetails(seriesId);
      setSeries(data);

      // Extract seasons and episodes
      if (data && data.seasons) {
        const availableSeasons = Object.keys(data.seasons).map(Number);
        setSeasons(availableSeasons);

        // Set default season
        if (availableSeasons.length > 0) {
          const firstSeason = Math.min(...availableSeasons);
          setSelectedSeason(firstSeason);
          setEpisodes(data.seasons[firstSeason] || []);
        }
      }
    } catch (err) {
      console.error("Error fetching series details:", err);
      setError("Unable to load series details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonSelect = (season: number) => {
    setSelectedSeason(season);
    if (series && series.seasons && series.seasons[season]) {
      setEpisodes(series.seasons[season]);
    } else {
      setEpisodes([]);
    }
  };

  const handlePlayEpisode = (episode: any) => {
    if (!series || !episode) return;

    router.push({
      pathname: "/video",
      params: {
        videoUrl: episode.video,
        title: `${series.title} - S${selectedSeason}E${episode.number}: ${episode.title}`,
        contentId: series._id,
        episodeId: episode._id,
        type: "series",
      },
    });
  };

  const handlePlayTrailer = () => {
    if (!series || !series.trailer) return;

    router.push({
      pathname: "/video",
      params: {
        videoUrl: series.trailer,
        title: `${series.title} - Trailer`,
        isTrailer: "true",
      },
    });
  };

  const handleAddToList = () => {
    // Implement add to watchlist functionality
    console.log("Add to my list:", series?.title);
  };

  const handleShare = async () => {
    try {
      if (!series) return;

      await Share.share({
        message: `Check out "${series.title}" on Nextream! ${series.desc}`,
        title: `Watch ${series.title} on Nextream`,
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
          onPress={fetchSeriesDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!series) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Series not found</Text>
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
            source={{ uri: series.img || DEFAULT_BACKDROP }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.9)", COLORS.background]}
            style={styles.gradientOverlay}
          />
        </View>

        {/* Series Info */}
        <View style={styles.infoContainer}>
          {/* Poster and Title */}
          <View style={styles.headerContainer}>
            <Image
              source={{ uri: series.imgSm || series.img || DEFAULT_POSTER }}
              style={styles.poster}
              resizeMode="cover"
            />
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{series.title}</Text>
              <View style={styles.metaContainer}>
                {series.year && (
                  <Text style={styles.metaText}>{series.year}</Text>
                )}
                {series.limit && (
                  <View style={styles.limitBadge}>
                    <Text style={styles.limitText}>{series.limit}+</Text>
                  </View>
                )}
                {series.duration && (
                  <Text style={styles.metaText}>{series.duration}</Text>
                )}
              </View>
              {series.genre && (
                <Text style={styles.genreText}>{series.genre}</Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            {series.trailer && (
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayTrailer}
              >
                <Ionicons name="play" size={20} color="#000" />
                <Text style={styles.playButtonText}>Play Trailer</Text>
              </TouchableOpacity>
            )}

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
          <Text style={styles.description}>{series.desc}</Text>

          {/* Additional Info */}
          <View style={styles.additionalInfoContainer}>
            {series.creator && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Creator:</Text>
                <Text style={styles.infoValue}>{series.creator}</Text>
              </View>
            )}

            {series.cast && series.cast.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cast:</Text>
                <Text style={styles.infoValue}>{series.cast.join(", ")}</Text>
              </View>
            )}

            {series.tags && series.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {series.tags.map((tag: string, index: number) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Seasons and Episodes */}
          {seasons.length > 0 && (
            <View style={styles.seasonsContainer}>
              <Text style={styles.sectionTitle}>Episodes</Text>

              {/* Season Selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.seasonTabsContainer}
              >
                {seasons.map((season) => (
                  <TouchableOpacity
                    key={season}
                    style={[
                      styles.seasonTab,
                      selectedSeason === season && styles.selectedSeasonTab,
                    ]}
                    onPress={() => handleSeasonSelect(season)}
                  >
                    <Text
                      style={[
                        styles.seasonTabText,
                        selectedSeason === season &&
                          styles.selectedSeasonTabText,
                      ]}
                    >
                      Season {season}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Episodes List */}
              {episodes.length > 0 ? (
                <View style={styles.episodesContainer}>
                  {episodes.map((episode) => (
                    <TouchableOpacity
                      key={episode._id}
                      style={styles.episodeItem}
                      onPress={() => handlePlayEpisode(episode)}
                    >
                      <View style={styles.episodeImageContainer}>
                        <Image
                          source={{
                            uri: episode.img || series.img || DEFAULT_BACKDROP,
                          }}
                          style={styles.episodeImage}
                        />
                        <View style={styles.episodePlayButton}>
                          <Ionicons name="play-circle" size={36} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.episodeInfo}>
                        <View style={styles.episodeHeader}>
                          <Text style={styles.episodeTitle}>
                            {`${episode.number}. ${episode.title}`}
                          </Text>
                          {episode.duration && (
                            <Text style={styles.episodeDuration}>
                              {episode.duration}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={styles.episodeDescription}
                          numberOfLines={2}
                        >
                          {episode.desc}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.noEpisodesContainer}>
                  <Text style={styles.noEpisodesText}>
                    No episodes available for Season {selectedSeason}
                  </Text>
                </View>
              )}
            </View>
          )}
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
  additionalInfoContainer: {
    marginBottom: 24,
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
  sectionTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  seasonsContainer: {
    marginBottom: 24,
  },
  seasonTabsContainer: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  seasonTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  selectedSeasonTab: {
    backgroundColor: COLORS.primary,
  },
  seasonTabText: {
    color: "#CCC",
    fontSize: 14,
  },
  selectedSeasonTabText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  episodesContainer: {
    marginBottom: 20,
  },
  episodeItem: {
    flexDirection: "row",
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  episodeImageContainer: {
    position: "relative",
    width: 160,
    height: 90,
  },
  episodeImage: {
    width: "100%",
    height: "100%",
  },
  episodePlayButton: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  episodeInfo: {
    flex: 1,
    padding: 10,
  },
  episodeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  episodeTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
    flex: 1,
  },
  episodeDuration: {
    color: "#CCC",
    fontSize: 12,
    marginLeft: 8,
  },
  episodeDescription: {
    color: "#CCC",
    fontSize: 12,
    lineHeight: 18,
  },
  noEpisodesContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
  },
  noEpisodesText: {
    color: "#CCC",
    fontSize: 14,
  },
});
