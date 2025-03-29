import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  RefreshControl,
} from "react-native";
import { Stack, router } from "expo-router";
import {
  getContentByGenre,
  getRecommendations,
} from "../services/contentService";
import { COLORS } from "../config";
import HeroBanner from "../../components/HeroBanner";
import ContentRow from "../../components/ContentRow";

// Define spacing locally since we have an import issue
const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const { width } = Dimensions.get("window");

// Content categories for home screen
const CONTENT_CATEGORIES = [
  { id: "trending", title: "Trending Now" },
  { id: "action", title: "Action & Adventure" },
  { id: "comedy", title: "Comedy" },
  { id: "drama", title: "Drama" },
  { id: "horror", title: "Horror" },
  { id: "sci-fi", title: "Sci-Fi & Fantasy" },
];

export default function HomeScreen() {
  const [featuredContent, setFeaturedContent] = useState<any>(null);
  const [categoryContent, setCategoryContent] = useState<Record<string, any[]>>(
    {}
  );
  const [recommendedContent, setRecommendedContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchInitialContent();
  }, []);

  const fetchInitialContent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch trending content first for the hero banner
      const trending = await getContentByGenre("trending", "all");

      if (trending && trending.length > 0) {
        // Pick a random item from first 5 trending items for the hero banner
        const randomIndex = Math.floor(
          Math.random() * Math.min(trending.length, 5)
        );
        const featured = trending[randomIndex];

        // Add isTrending flag for UI
        setFeaturedContent({
          ...featured,
          isTrending: true,
        });

        // Store trending content
        setCategoryContent((prev) => ({
          ...prev,
          trending,
        }));

        // Fetch other categories in parallel
        const categoryPromises = CONTENT_CATEGORIES.filter(
          (cat) => cat.id !== "trending"
        ).map(async (category) => {
          try {
            const content = await getContentByGenre(category.id, "all");
            return { id: category.id, content };
          } catch (err) {
            console.error(`Error fetching ${category.id} content:`, err);
            return { id: category.id, content: [] };
          }
        });

        const categoryResults = await Promise.all(categoryPromises);

        // Convert array of results to record
        const contentByCategory = categoryResults.reduce(
          (acc, { id, content }) => {
            acc[id] = content || [];
            return acc;
          },
          { trending } as Record<string, any[]>
        );

        setCategoryContent(contentByCategory);

        // Fetch personalized recommendations
        try {
          const recommendations = await getRecommendations();
          setRecommendedContent(recommendations || []);
        } catch (err) {
          console.error("Error fetching recommendations:", err);
        }
      }
    } catch (err) {
      console.error("Error fetching content:", err);
      setError("Failed to load content. Pull down to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchInitialContent();
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

  const handlePlayFeatured = () => {
    if (featuredContent) {
      handleContentPress(featuredContent);
    }
  };

  const handleMoreInfoFeatured = () => {
    if (featuredContent) {
      handleContentPress(featuredContent);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <Stack.Screen options={{ headerShown: false }} />

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading content...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          {/* Hero Banner */}
          {featuredContent && (
            <HeroBanner
              content={featuredContent}
              onPlayPress={handlePlayFeatured}
              onMoreInfoPress={handleMoreInfoFeatured}
            />
          )}

          {/* Recommended Content */}
          {recommendedContent.length > 0 && (
            <ContentRow
              title="For You"
              items={recommendedContent}
              onItemPress={handleContentPress}
              cardSize="medium"
              showPlayButton={false}
            />
          )}

          {/* Content Categories */}
          {CONTENT_CATEGORIES.map((category) => {
            const items = categoryContent[category.id] || [];
            if (items.length === 0) return null;

            return (
              <ContentRow
                key={category.id}
                title={category.title}
                items={items}
                onItemPress={handleContentPress}
                cardSize={category.id === "trending" ? "large" : "medium"}
                showPlayButton={category.id === "trending"}
              />
            );
          })}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Nextream • Netflix-inspired Streaming App
            </Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.text,
    marginTop: SPACING.md,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  retryButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
  },
  footer: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    color: COLORS.muted,
    fontSize: 12,
  },
});
