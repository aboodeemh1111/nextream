import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ContentCard from "./ContentCard";
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from "../config";

// ContentRow component for displaying horizontal scrollable content
const ContentRow = ({
  title,
  items = [],
  onItemPress,
  onSeeAllPress,
  cardSize = "medium",
  type = "movie", // 'movie' or 'series'
  loading = false,
  showTitle = true,
  showPlayButton = false,
}) => {
  // Render empty state while loading
  if (loading) {
    return (
      <View style={styles.container}>
        {showTitle && (
          <View style={styles.headerContainer}>
            <Text style={styles.title}>{title}</Text>
          </View>
        )}

        <FlatList
          data={[1, 2, 3, 4]} // Dummy data for loading state
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `loading-${item}`}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.loadingCard,
                {
                  width:
                    cardSize === "large"
                      ? 180
                      : cardSize === "small"
                      ? 120
                      : 150,
                  height:
                    cardSize === "large"
                      ? 270
                      : cardSize === "small"
                      ? 180
                      : 225,
                  marginRight: SPACING.sm,
                  marginLeft: index === 0 ? SPACING.md : 0,
                },
              ]}
            >
              <Animated.View style={styles.loadingShimmer} />
            </View>
          )}
        />
      </View>
    );
  }

  // No content state
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {showTitle && (
        <View style={styles.headerContainer}>
          <View style={styles.titleContainer}>
            {title.includes("Top 10") && (
              <View style={styles.top10Badge}>
                <Text style={styles.top10Text}>TOP 10</Text>
              </View>
            )}
            <Text style={styles.title}>{title}</Text>
          </View>

          {onSeeAllPress && (
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={onSeeAllPress}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item, index }) => (
          <ContentCard
            item={item}
            size={cardSize}
            onPress={() => onItemPress(item, type)}
            showPlayButton={showPlayButton}
            index={index}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
  },
  top10Badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginRight: SPACING.xs,
  },
  top10Text: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: "bold",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  seeAllText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    marginRight: 2,
  },
  listContainer: {
    paddingRight: SPACING.sm,
  },
  loadingCard: {
    backgroundColor: COLORS.backgroundLighter,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md,
    overflow: "hidden",
    position: "relative",
  },
  loadingShimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});

export default ContentRow;
