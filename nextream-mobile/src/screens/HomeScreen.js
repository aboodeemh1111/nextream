import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Text,
  ImageBackground,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ContentRow from "../components/ContentRow";
import {
  getFeaturedContent,
  getContentLists,
  getRecommendations,
  getListContent,
} from "../services/contentService";
import { COLORS, DEFAULT_BACKDROP } from "../config";
import { useAuth } from "../context/AuthContext";

const { width, height } = Dimensions.get("window");

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featuredContent, setFeaturedContent] = useState(null);
  const [contentRows, setContentRows] = useState([]);
  const [recommendedContent, setRecommendedContent] = useState([]);
  const [error, setError] = useState(null);

  // Fetch initial content
  useEffect(() => {
    fetchContent();
  }, []);

  // Refresh content (pull to refresh)
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContent();
    setRefreshing(false);
  };

  // Fetch all content for the home screen
  const fetchContent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch featured content for hero banner
      const featured = await getFeaturedContent();
      if (featured && featured.length > 0) {
        setFeaturedContent(featured[0]); // Get first featured item
      }

      // Fetch content lists (movies and series)
      const lists = await getContentLists();

      // Populate content rows from lists
      const rows = [];

      // Process each list to get its content
      if (lists && lists.length > 0) {
        for (const list of lists) {
          try {
            const listContent = await getListContent(list._id);
            if (
              listContent &&
              listContent.content &&
              listContent.content.length > 0
            ) {
              rows.push({
                _id: list._id,
                title: list.title,
                type: list.type,
                content: listContent.content,
              });
            }
          } catch (err) {
            console.error(
              `Error fetching content for list ${list.title}:`,
              err
            );
          }
        }
      }

      setContentRows(rows);

      // Fetch personalized recommendations if user is logged in
      if (user) {
        try {
          const recommendations = await getRecommendations();
          if (recommendations && recommendations.length > 0) {
            setRecommendedContent(recommendations);
          }
        } catch (err) {
          console.error("Error fetching recommendations:", err);
          // Non-critical, can continue without recommendations
        }
      }
    } catch (err) {
      console.error("Error fetching home content:", err);
      setError("Failed to load content. Pull down to refresh.");
    } finally {
      setLoading(false);
    }
  };

  // Handle content item press
  const handleContentPress = (item, type) => {
    if (!item) return;

    if (type === "movie" || !item.isSeries) {
      navigation.navigate("MovieDetail", { movieId: item._id });
    } else {
      navigation.navigate("SeriesDetail", { seriesId: item._id });
    }
  };

  // Handle play button press for featured content
  const handlePlayFeatured = () => {
    if (featuredContent) {
      if (featuredContent.isSeries) {
        navigation.navigate("SeriesDetail", { seriesId: featuredContent._id });
      } else {
        navigation.navigate("MovieDetail", { movieId: featuredContent._id });
      }
    }
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading amazing content...</Text>
      </View>
    );
  }

  // Error state
  if (error && !loading && contentRows.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchContent}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Featured Content Hero Banner */}
        {featuredContent && (
          <View style={styles.featuredContainer}>
            <ImageBackground
              source={{
                uri:
                  featuredContent.imgTitle ||
                  featuredContent.img ||
                  DEFAULT_BACKDROP,
              }}
              style={styles.featuredImage}
              resizeMode="cover"
            >
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.8)", "#000"]}
                style={styles.featuredGradient}
              >
                <View style={styles.featuredContent}>
                  <Text style={styles.featuredTitle}>
                    {featuredContent.title}
                  </Text>

                  <View style={styles.featuredMeta}>
                    {featuredContent.year && (
                      <Text style={styles.featuredMetaText}>
                        {featuredContent.year}
                      </Text>
                    )}

                    {featuredContent.genre && (
                      <Text style={styles.featuredMetaText}>
                        {featuredContent.year ? " • " : ""}
                        {featuredContent.genre}
                      </Text>
                    )}

                    {featuredContent.limit && (
                      <View style={styles.limitBadge}>
                        <Text style={styles.limitText}>
                          {featuredContent.limit}+
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.featuredDesc} numberOfLines={2}>
                    {featuredContent.desc}
                  </Text>

                  <View style={styles.featuredButtons}>
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={handlePlayFeatured}
                    >
                      <Ionicons name="play" size={22} color="#000" />
                      <Text style={styles.playButtonText}>Play</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.myListButton}
                      onPress={() => {
                        /* Add to My List function */
                      }}
                    >
                      <Ionicons name="add-outline" size={24} color="#FFF" />
                      <Text style={styles.myListButtonText}>My List</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </View>
        )}

        {/* Personalized Recommendations */}
        {recommendedContent && recommendedContent.length > 0 && (
          <ContentRow
            title="Recommended for You"
            items={recommendedContent}
            onItemPress={(item) =>
              handleContentPress(item, item.isSeries ? "series" : "movie")
            }
            cardSize="large"
          />
        )}

        {/* Content Rows from Lists */}
        {contentRows.map((row) => (
          <ContentRow
            key={row._id}
            title={row.title}
            items={row.content}
            onItemPress={(item) => handleContentPress(item, row.type)}
            cardSize="medium"
            type={row.type}
            onSeeAllPress={() =>
              navigation.navigate("SeeAll", {
                title: row.title,
                items: row.content,
                type: row.type,
              })
            }
          />
        ))}
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
    padding: 20,
  },
  loadingText: {
    color: "#FFF",
    marginTop: 10,
    fontSize: 16,
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
  // Featured Content Styles
  featuredContainer: {
    height: height * 0.65,
    width: width,
    marginBottom: 16,
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "75%",
    justifyContent: "flex-end",
    paddingBottom: 16,
  },
  featuredContent: {
    paddingHorizontal: 16,
  },
  featuredTitle: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 8,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featuredMetaText: {
    color: "#CCC",
    fontSize: 14,
  },
  limitBadge: {
    marginLeft: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  limitText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  featuredDesc: {
    color: "#CCC",
    fontSize: 14,
    marginBottom: 16,
  },
  featuredButtons: {
    flexDirection: "row",
  },
  playButton: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginRight: 16,
  },
  playButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 4,
  },
  myListButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#CCC",
  },
  myListButtonText: {
    color: "#FFF",
    fontSize: 16,
    marginLeft: 4,
  },
});

export default HomeScreen;
