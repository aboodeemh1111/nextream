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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getSeriesDetails,
  getSeriesSeasons,
  getSeasonEpisodes,
  trackContentView,
} from "../services/contentService";
import { COLORS, DEFAULT_BACKDROP, DEFAULT_POSTER } from "../config";
import { useAuth } from "../context/AuthContext";

const { width, height } = Dimensions.get("window");

const SeriesDetailScreen = ({ route, navigation }) => {
  const { seriesId } = route.params;
  const { user } = useAuth();
  const [series, setSeries] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSeriesDetails();
  }, [seriesId]);

  const fetchSeriesDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch series details
      const seriesData = await getSeriesDetails(seriesId);
      setSeries(seriesData);

      // Fetch seasons
      const seasonsData = await getSeriesSeasons(seriesId);
      setSeasons(seasonsData);

      // Select the first season by default if available
      if (seasonsData && seasonsData.length > 0) {
        setSelectedSeason(seasonsData[0]);
        fetchEpisodes(seasonsData[0]._id);
      }

      // Track view for recommendations
      if (user) {
        trackContentView(seriesId).catch((err) =>
          console.error("Error tracking view:", err)
        );
      }
    } catch (err) {
      console.error("Error fetching series details:", err);
      setError("Unable to load series details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEpisodes = async (seasonId) => {
    if (!seasonId) return;

    try {
      setEpisodesLoading(true);
      const episodesData = await getSeasonEpisodes(seasonId);
      setEpisodes(episodesData);
    } catch (err) {
      console.error("Error fetching episodes:", err);
    } finally {
      setEpisodesLoading(false);
    }
  };

  const handleSeasonSelect = (season) => {
    setSelectedSeason(season);
    fetchEpisodes(season._id);
  };

  const handlePlayEpisode = (episode) => {
    navigation.navigate("VideoPlayer", {
      videoUrl: episode.video,
      title: `${series?.title} - ${episode.title}`,
      contentId: episode._id,
      type: "episode",
      episodeNumber: episode.episodeNumber,
      seasonNumber: selectedSeason?.seasonNumber,
    });
  };

  const handlePlayTrailer = () => {
    if (!series || !series.trailer) return;

    navigation.navigate("VideoPlayer", {
      videoUrl: series.trailer,
      title: `${series.title} - Trailer`,
      isTrailer: true,
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
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
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
                {series.status && (
                  <Text style={styles.statusText}>{series.status}</Text>
                )}
              </View>
              {series.genre && (
                <Text style={styles.genreText}>{series.genre}</Text>
              )}
              {series.totalSeasons > 0 && (
                <Text style={styles.seasonsText}>
                  {series.totalSeasons}{" "}
                  {series.totalSeasons === 1 ? "Season" : "Seasons"}
                </Text>
              )}
              {series.isOriginal && (
                <View style={styles.originalBadge}>
                  <Text style={styles.originalText}>ORIGINAL</Text>
                </View>
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
            {series.director && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Creator:</Text>
                <Text style={styles.infoValue}>{series.director}</Text>
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
                {series.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Season Selection */}
          {seasons.length > 0 && (
            <View style={styles.seasonsContainer}>
              <Text style={styles.sectionTitle}>Seasons</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.seasonsList}
              >
                {seasons.map((season) => (
                  <TouchableOpacity
                    key={season._id}
                    style={[
                      styles.seasonButton,
                      selectedSeason?._id === season._id &&
                        styles.seasonButtonActive,
                    ]}
                    onPress={() => handleSeasonSelect(season)}
                  >
                    <Text
                      style={[
                        styles.seasonButtonText,
                        selectedSeason?._id === season._id &&
                          styles.seasonButtonTextActive,
                      ]}
                    >
                      Season {season.seasonNumber}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Episodes */}
          {selectedSeason && (
            <View style={styles.episodesContainer}>
              <View style={styles.episodeHeader}>
                <Text style={styles.sectionTitle}>
                  {selectedSeason.title ||
                    `Season ${selectedSeason.seasonNumber}`}
                </Text>
                {selectedSeason.description && (
                  <Text style={styles.seasonDescription}>
                    {selectedSeason.description}
                  </Text>
                )}
              </View>

              {episodesLoading ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={styles.episodesLoading}
                />
              ) : episodes.length === 0 ? (
                <Text style={styles.noEpisodesText}>No episodes available</Text>
              ) : (
                <FlatList
                  data={episodes}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={styles.episodeItem}
                      onPress={() => handlePlayEpisode(item)}
                    >
                      <View style={styles.episodeNumberContainer}>
                        <Text style={styles.episodeNumber}>
                          {item.episodeNumber}
                        </Text>
                      </View>

                      <View style={styles.episodeThumbnail}>
                        <Image
                          source={{
                            uri:
                              item.thumbnail || series.img || DEFAULT_BACKDROP,
                          }}
                          style={styles.thumbnailImage}
                          resizeMode="cover"
                        />
                        <View style={styles.playIconSmall}>
                          <Ionicons name="play-circle" size={36} color="#fff" />
                        </View>
                      </View>

                      <View style={styles.episodeInfo}>
                        <Text style={styles.episodeTitle}>{item.title}</Text>
                        {item.duration && (
                          <Text style={styles.episodeDuration}>
                            {item.duration}
                          </Text>
                        )}
                        <Text
                          style={styles.episodeDescription}
                          numberOfLines={2}
                        >
                          {item.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

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
    flexWrap: "wrap",
  },
  metaText: {
    color: "#CCC",
    fontSize: 14,
    marginRight: 8,
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
  statusText: {
    color: "#CCC",
    fontSize: 14,
    textTransform: "capitalize",
  },
  genreText: {
    color: "#CCC",
    fontSize: 14,
    marginBottom: 4,
  },
  seasonsText: {
    color: "#CCC",
    fontSize: 14,
    marginBottom: 4,
  },
  originalBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  originalText: {
    color: "#FFF",
    fontSize: 10,
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
  seasonsList: {
    flexDirection: "row",
  },
  seasonButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  seasonButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(229, 9, 20, 0.2)",
  },
  seasonButtonText: {
    color: "#FFF",
    fontWeight: "500",
  },
  seasonButtonTextActive: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  episodesContainer: {
    marginBottom: 24,
  },
  episodeHeader: {
    marginBottom: 12,
  },
  seasonDescription: {
    color: "#CCC",
    fontSize: 14,
    marginTop: 4,
  },
  episodesLoading: {
    marginVertical: 16,
  },
  noEpisodesText: {
    color: "#CCC",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 16,
  },
  episodeItem: {
    flexDirection: "row",
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    overflow: "hidden",
  },
  episodeNumberContainer: {
    width: 36,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    paddingTop: 12,
  },
  episodeNumber: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  episodeThumbnail: {
    width: 120,
    height: 68,
    position: "relative",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  playIconSmall: {
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
    padding: 8,
  },
  episodeTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 2,
  },
  episodeDuration: {
    color: "#CCC",
    fontSize: 12,
    marginBottom: 4,
  },
  episodeDescription: {
    color: "#CCC",
    fontSize: 12,
    lineHeight: 16,
  },
});

export default SeriesDetailScreen;
