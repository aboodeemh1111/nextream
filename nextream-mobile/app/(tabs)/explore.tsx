import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  StatusBar,
} from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  searchContent,
  getContentByGenre,
  getRecommendations,
} from "../../src/services/contentService";
import { COLORS, DEFAULT_BACKDROP, DEFAULT_POSTER } from "../../src/config";

const { width, height } = Dimensions.get("window");

// Genre buttons with icons
const GENRES = [
  { id: "trending", label: "Trending", icon: "trending-up" },
  { id: "action", label: "Action", icon: "flash" },
  { id: "comedy", label: "Comedy", icon: "happy" },
  { id: "drama", label: "Drama", icon: "film" },
  { id: "documentary", label: "Documentary", icon: "videocam" },
  { id: "horror", label: "Horror", icon: "skull" },
  { id: "sci-fi", label: "Sci-Fi", icon: "planet" },
  { id: "fantasy", label: "Fantasy", icon: "color-wand" },
];

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [contentType, setContentType] = useState("all"); // 'all', 'movie', 'series'
  const [selectedGenre, setSelectedGenre] = useState("trending");

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [genreContent, setGenreContent] = useState<any[]>([]);
  const [featuredContent, setFeaturedContent] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial trending content
    fetchInitialContent();
  }, []);

  useEffect(() => {
    // Reapply search when content type changes
    if (searchQuery.trim()) {
      handleSearch();
    } else {
      // If no search, fetch genre content when type changes
      fetchContentByGenre(selectedGenre, contentType);
    }
  }, [contentType]);

  const fetchInitialContent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get trending content
      const trending = await getContentByGenre("trending", contentType);
      setGenreContent(trending || []);
      setSelectedGenre("trending");

      // Select a random item for the hero banner
      if (trending && trending.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * Math.min(trending.length, 5)
        );
        setFeaturedContent(trending[randomIndex]);
      }
    } catch (err) {
      console.error("Error fetching content:", err);
      setError("Failed to load content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setSearchResults([]);

      const results = await searchContent(searchQuery, contentType);
      setSearchResults(results || []);
      setSelectedGenre(""); // Clear genre selection when searching
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchContentByGenre = async (genre: string, type?: string) => {
    try {
      setLoading(true);
      setError(null);
      setGenreContent([]);
      setSelectedGenre(genre);

      const content = await getContentByGenre(genre, type || "all");
      setGenreContent(content || []);
    } catch (err) {
      console.error(`Error fetching ${genre} content:`, err);
      setError(`Failed to load ${genre} content. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    fetchContentByGenre(selectedGenre || "trending", contentType);
  };

  const handleContentPress = (item: any) => {
    const contentType = item.isSeries ? "series" : "movie";

    if (contentType === "movie") {
      router.push({
        pathname: "/movie/[id]",
        params: { id: item._id },
      });
    } else {
      router.push({
        pathname: "/series/[id]",
        params: { id: item._id },
      });
    }
  };

  const renderHeroBanner = () => {
    if (!featuredContent) return null;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.heroContainer}
        onPress={() => handleContentPress(featuredContent)}
      >
        <ImageBackground
          source={{ uri: featuredContent.img || DEFAULT_BACKDROP }}
          style={styles.heroImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.95)"]}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>{featuredContent.title}</Text>
              <Text style={styles.heroYear}>
                {featuredContent.year}
                {featuredContent.limit && ` • ${featuredContent.limit}+`}
                {featuredContent.isSeries ? " • Series" : " • Movie"}
              </Text>
              <Text numberOfLines={2} style={styles.heroDesc}>
                {featuredContent.desc || "No description available"}
              </Text>

              <View style={styles.heroButtons}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => handleContentPress(featuredContent)}
                >
                  <Ionicons name="play" size={20} color="#000" />
                  <Text style={styles.playButtonText}>Play</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.infoButton}>
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.infoButtonText}>More Info</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Search Bar - Fixed at top */}
      <View style={styles.searchContainer}>
        <TouchableOpacity style={styles.backButton}>
          <Ionicons name="menu" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search movies and TV shows..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="search" size={20} color="#999" />
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              if (searchQuery.trim()) {
                handleSearch();
              } else {
                fetchContentByGenre(selectedGenre || "trending", contentType);
              }
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Banner - Only show when not searching */}
          {!searchQuery.trim() && renderHeroBanner()}

          {/* Content Type Tabs */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                contentType === "all" && styles.activeFilterButton,
              ]}
              onPress={() => setContentType("all")}
            >
              <Text
                style={[
                  styles.filterText,
                  contentType === "all" && styles.activeFilterText,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                contentType === "movie" && styles.activeFilterButton,
              ]}
              onPress={() => setContentType("movie")}
            >
              <Text
                style={[
                  styles.filterText,
                  contentType === "movie" && styles.activeFilterText,
                ]}
              >
                Movies
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                contentType === "series" && styles.activeFilterButton,
              ]}
              onPress={() => setContentType("series")}
            >
              <Text
                style={[
                  styles.filterText,
                  contentType === "series" && styles.activeFilterText,
                ]}
              >
                Series
              </Text>
            </TouchableOpacity>
          </View>

          {/* Genre Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.genreContainer}
            contentContainerStyle={styles.genrePillsContainer}
          >
            {GENRES.map((genre) => (
              <TouchableOpacity
                key={genre.id}
                style={[
                  styles.genrePill,
                  selectedGenre === genre.id && styles.activeGenrePill,
                ]}
                onPress={() => fetchContentByGenre(genre.id, contentType)}
              >
                <Ionicons
                  name={genre.icon as any}
                  size={16}
                  color={selectedGenre === genre.id ? "#FFF" : "#CCC"}
                  style={styles.genreIcon}
                />
                <Text
                  style={[
                    styles.genreText,
                    selectedGenre === genre.id && styles.activeGenreText,
                  ]}
                >
                  {genre.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {searchQuery.trim() ? (
            // Search Results
            searchResults.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Search Results</Text>
                <FlatList
                  data={searchResults}
                  numColumns={3}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.posterCard}
                      onPress={() => handleContentPress(item)}
                    >
                      <Image
                        source={{ uri: item.img || DEFAULT_POSTER }}
                        style={styles.posterImage}
                        resizeMode="cover"
                      />
                      {item.isSeries && (
                        <View style={styles.seriesBadge}>
                          <Text style={styles.seriesBadgeText}>SERIES</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={styles.gridContainer}
                />
              </View>
            ) : (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search-outline" size={64} color="#444" />
                <Text style={styles.noResultsText}>
                  No results found for "{searchQuery}"
                </Text>
                <Text style={styles.noResultsSubtext}>
                  Try different keywords or browse by genre
                </Text>
              </View>
            )
          ) : // Genre Results
          genreContent.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>
                {GENRES.find((g) => g.id === selectedGenre)?.label ||
                  "Recommended for You"}
              </Text>
              <FlatList
                data={genreContent}
                numColumns={3}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.posterCard}
                    onPress={() => handleContentPress(item)}
                  >
                    <Image
                      source={{ uri: item.img || DEFAULT_POSTER }}
                      style={styles.posterImage}
                      resizeMode="cover"
                    />
                    {item.isSeries && (
                      <View style={styles.seriesBadge}>
                        <Text style={styles.seriesBadgeText}>SERIES</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.gridContainer}
              />
            </View>
          ) : (
            <View style={styles.noResultsContainer}>
              <Ionicons name="film-outline" size={64} color="#444" />
              <Text style={styles.noResultsText}>
                No content found for {selectedGenre}
              </Text>
              <Text style={styles.noResultsSubtext}>
                Try a different genre or search
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: StatusBar.currentHeight || 40,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    marginRight: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
    height: 40,
  },
  clearButton: {
    padding: 4,
  },
  heroContainer: {
    width: width,
    height: height * 0.6,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroGradient: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  heroContent: {
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 8,
  },
  heroYear: {
    fontSize: 14,
    color: "#CCC",
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 14,
    color: "#CCC",
    textAlign: "center",
    marginBottom: 24,
  },
  heroButtons: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 4,
    marginRight: 12,
  },
  playButtonText: {
    color: "#000",
    fontWeight: "bold",
    marginLeft: 6,
  },
  infoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  infoButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    marginLeft: 6,
  },
  filterContainer: {
    flexDirection: "row",
    padding: 16,
    paddingVertical: 12,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 12,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  activeFilterButton: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    color: "#CCC",
    fontSize: 14,
  },
  activeFilterText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  genreContainer: {
    maxHeight: 50,
    marginBottom: 16,
  },
  genrePillsContainer: {
    paddingHorizontal: 16,
  },
  genrePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  activeGenrePill: {
    backgroundColor: COLORS.primary,
  },
  genreIcon: {
    marginRight: 6,
  },
  genreText: {
    color: "#CCC",
    fontSize: 14,
  },
  activeGenreText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  gridContainer: {
    padding: 8,
  },
  posterCard: {
    width: (width - 48) / 3, // Three columns with padding
    margin: 4,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  posterImage: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 4,
  },
  seriesBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(229, 9, 20, 0.8)",
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  seriesBadgeText: {
    color: "#FFF",
    fontSize: 8,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  noResultsText: {
    color: "#CCC",
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
  },
  noResultsSubtext: {
    color: "#AAA",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
});
