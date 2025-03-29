import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../src/config";

const { width, height } = Dimensions.get("window");
const BANNER_HEIGHT = height * 0.7;

// Define spacing locally to avoid import issues
const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

interface HeroBannerProps {
  content: {
    title: string;
    description?: string;
    posterUrl?: string;
    backdropUrl?: string;
    releaseYear?: string | number;
    rating?: string;
    isTrending?: boolean;
  };
  onPlayPress: () => void;
  onMoreInfoPress: () => void;
}

const HeroBanner: React.FC<HeroBannerProps> = ({
  content,
  onPlayPress,
  onMoreInfoPress,
}) => {
  // Use backdrop if available, otherwise fallback to poster
  const imageUrl = content.backdropUrl || content.posterUrl;

  return (
    <View style={styles.container}>
      <ImageBackground
        source={
          imageUrl
            ? { uri: imageUrl }
            : require("../assets/placeholder-backdrop.png")
        }
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(0,0,0,0.6)",
            "rgba(0,0,0,0.9)",
            COLORS.background,
          ]}
          style={styles.gradient}
        >
          <View style={styles.contentContainer}>
            {content.isTrending && (
              <View style={styles.trendingBadge}>
                <Text style={styles.trendingText}>Trending</Text>
              </View>
            )}

            <Text
              style={[
                styles.title,
                Platform.OS === "ios"
                  ? styles.titleShadowIOS
                  : Platform.OS === "android"
                  ? styles.titleShadowAndroid
                  : styles.titleShadowWeb,
              ]}
              numberOfLines={2}
            >
              {content.title}
            </Text>

            <View style={styles.metaContainer}>
              {content.releaseYear && (
                <Text style={styles.metaText}>{content.releaseYear}</Text>
              )}

              {content.rating && (
                <>
                  <View style={styles.metaDot} />
                  <Text style={styles.metaText}>{content.rating}</Text>
                </>
              )}
            </View>

            {content.description && (
              <Text style={styles.description} numberOfLines={3}>
                {content.description}
              </Text>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={onPlayPress}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={22} color={COLORS.textDark} />
                <Text style={styles.playButtonText}>Play</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.infoButton}
                onPress={onMoreInfoPress}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color={COLORS.text}
                />
                <Text style={styles.infoButtonText}>More Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: BANNER_HEIGHT,
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
    paddingBottom: 20,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  trendingBadge: {
    backgroundColor: COLORS.primary,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: SPACING.sm,
  },
  trendingText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "bold",
  },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: SPACING.sm,
  },
  titleShadowIOS: {
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.5)",
  },
  titleShadowAndroid: {
    elevation: 5,
  },
  titleShadowWeb: {
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.5)",
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  metaText: {
    color: COLORS.text,
    fontSize: 14,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.muted,
    marginHorizontal: 6,
  },
  description: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: SPACING.lg,
    lineHeight: 20,
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
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginRight: SPACING.md,
  },
  playButtonText: {
    color: COLORS.textDark,
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 6,
  },
  infoButton: {
    backgroundColor: COLORS.secondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  infoButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 6,
  },
});

export default HeroBanner;
