import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from "../config";

const { width, height } = Dimensions.get("window");

const HeroBanner = ({ content, onPlayPress, onMoreInfoPress, style }) => {
  if (!content) return null;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: content.img || content.imgTitle }}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Gradient overlay */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.1)",
          "rgba(0,0,0,0.6)",
          "rgba(0,0,0,0.9)",
          COLORS.background,
        ]}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.9 }}
      />

      {/* Content badges */}
      <View style={styles.contentContainer}>
        <View style={styles.metadataContainer}>
          {content.isOriginal && (
            <View style={styles.originalBadge}>
              <Text style={styles.badgeText}>NEXTREAM ORIGINAL</Text>
            </View>
          )}

          {content.isTrending && (
            <View style={styles.trendingContainer}>
              <View style={styles.top10Badge}>
                <Text style={styles.badgeText}>TOP 10</Text>
              </View>
              <Text style={styles.trendingText}>Trending</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{content.title}</Text>

        {/* Metadata */}
        <View style={styles.detailsRow}>
          {content.year && (
            <Text style={styles.detailText}>{content.year}</Text>
          )}

          {content.limit && (
            <Text style={styles.detailText}>
              {content.year ? " • " : ""}
              {content.limit}+
            </Text>
          )}

          {content.duration && (
            <Text style={styles.detailText}>
              {content.year || content.limit ? " • " : ""}
              {content.duration}
            </Text>
          )}

          {content.isSeries && (
            <View style={styles.seriesBadge}>
              <Text style={styles.seriesBadgeText}>SERIES</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {content.desc && (
          <Text style={styles.description} numberOfLines={3}>
            {content.desc}
          </Text>
        )}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={onPlayPress}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={22} color="#000" />
            <Text style={styles.playButtonText}>Play</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moreInfoButton}
            onPress={onMoreInfoPress}
            activeOpacity={0.8}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#FFF"
            />
            <Text style={styles.moreInfoButtonText}>More Info</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: height * 0.75,
    width: width,
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.backgroundLighter,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "100%",
    zIndex: 1,
  },
  contentContainer: {
    position: "absolute",
    bottom: SPACING.xl,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 2,
  },
  metadataContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  originalBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginRight: SPACING.sm,
  },
  badgeText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: "bold",
  },
  trendingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  top10Badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginRight: SPACING.xs,
  },
  trendingText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xxxl,
    fontWeight: "bold",
    marginBottom: SPACING.xs,
    ...Platform.select({
      ios: {
        fontWeight: "800",
      },
      android: {
        fontWeight: "bold",
      },
    }),
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  detailText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  seriesBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginLeft: SPACING.xs,
  },
  seriesBadgeText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: "bold",
  },
  description: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: SPACING.sm,
  },
  playButton: {
    backgroundColor: COLORS.text,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
  },
  playButtonText: {
    color: "#000",
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    marginLeft: SPACING.xs,
  },
  moreInfoButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
  },
  moreInfoButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: "bold",
    marginLeft: SPACING.xs,
  },
});

export default HeroBanner;
