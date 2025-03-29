import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  DEFAULT_POSTER,
  COLORS,
  FONT_SIZES,
  BORDER_RADIUS,
  CONTENT_CARD,
  SPACING,
} from "../config";

const { width } = Dimensions.get("window");

// ContentCard component for displaying movies and series with Netflix-like styling
const ContentCard = ({
  item,
  onPress,
  size = "medium",
  showInfo = true,
  showPlayButton = false,
  index = 0,
}) => {
  // Animation values
  const [scaleValue] = useState(new Animated.Value(1));

  // Handle press in and out for scale animation
  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 1.05,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Calculate width based on size prop
  const getCardWidth = () => {
    switch (size) {
      case "small":
        return CONTENT_CARD.smallWidth;
      case "large":
        return CONTENT_CARD.largeWidth;
      case "featured":
        return CONTENT_CARD.featuredWidth;
      case "medium":
      default:
        return CONTENT_CARD.mediumWidth;
    }
  };

  // Calculate aspect ratio (2:3 for posters)
  const cardWidth = getCardWidth();
  const cardHeight = cardWidth / CONTENT_CARD.aspectRatio;

  // Determine left margin for first card in row
  const marginLeft = index === 0 ? SPACING.md : 0;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: cardWidth,
          marginLeft,
          marginRight: SPACING.sm,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.cardContainer,
          {
            height: cardHeight,
            transform: [{ scale: scaleValue }],
          },
        ]}
      >
        <Image
          source={{
            uri: item.img || item.imgSm || item.poster || DEFAULT_POSTER,
          }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Gradient overlay for better text visibility */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.8)"]}
          style={styles.gradient}
        />

        {/* Play button overlay for featured cards */}
        {showPlayButton && (
          <View style={styles.playButtonContainer}>
            <TouchableOpacity style={styles.playButton} onPress={onPress}>
              <Ionicons name="play" size={16} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {/* Content badges */}
        <View style={styles.badgeContainer}>
          {item.isOriginal && (
            <View style={styles.originalBadge}>
              <Text style={styles.badgeText}>ORIGINAL</Text>
            </View>
          )}

          {item.isSeries && (
            <View style={styles.seriesBadge}>
              <Text style={styles.badgeText}>SERIES</Text>
            </View>
          )}

          {item.limit && (
            <View style={styles.ageBadge}>
              <Text style={styles.ageBadgeText}>{item.limit}+</Text>
            </View>
          )}
        </View>

        {/* Card info at bottom */}
        {showInfo && (
          <View style={styles.infoOverlay}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>

            <View style={styles.detailsContainer}>
              {item.year && <Text style={styles.detail}>{item.year}</Text>}
              {item.genre && (
                <Text style={styles.detail}>
                  {item.year ? " • " : ""}
                  {item.genre}
                </Text>
              )}
              {item.duration && (
                <Text style={styles.detail}>
                  {item.year || item.genre ? " • " : ""}
                  {item.duration}
                </Text>
              )}
            </View>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  cardContainer: {
    borderRadius: BORDER_RADIUS.sm,
    overflow: "hidden",
    backgroundColor: COLORS.backgroundCard,
    position: "relative",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  playButtonContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.9,
  },
  badgeContainer: {
    position: "absolute",
    top: SPACING.xs,
    left: SPACING.xs,
    flexDirection: "row",
  },
  originalBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginRight: SPACING.xs,
  },
  seriesBadge: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginRight: SPACING.xs,
  },
  ageBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  badgeText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: "bold",
  },
  ageBadgeText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: "bold",
  },
  infoOverlay: {
    position: "absolute",
    bottom: SPACING.xs,
    left: SPACING.xs,
    right: SPACING.xs,
  },
  title: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: FONT_SIZES.sm,
    marginBottom: 2,
  },
  detailsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detail: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
});

export default ContentCard;
