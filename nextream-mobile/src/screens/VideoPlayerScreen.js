import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
  BackHandler,
} from "react-native";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../config";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { trackContentView } from "../services/contentService";

const { width, height } = Dimensions.get("window");

const VideoPlayerScreen = ({ route, navigation }) => {
  const {
    videoUrl,
    title,
    contentId,
    type = "movie",
    episodeNumber,
    seasonNumber,
    isTrailer = false,
  } = route.params;

  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const controlsTimeout = useRef(null);

  // Lock to landscape orientation and handle back button
  useEffect(() => {
    lockOrientation();

    // Track content view if not a trailer
    if (!isTrailer && contentId) {
      trackContentView(contentId).catch((err) =>
        console.error("Error tracking content view:", err)
      );
    }

    // Handle hardware back button
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => {
      unlockOrientation();
      backHandler.remove();
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  // Auto-hide controls after a delay
  useEffect(() => {
    if (controlsVisible && !status.paused && !loading) {
      controlsTimeout.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [controlsVisible, status.paused, loading]);

  const lockOrientation = async () => {
    try {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE
      );
    } catch (error) {
      console.error("Failed to lock orientation:", error);
    }
  };

  const unlockOrientation = async () => {
    try {
      await ScreenOrientation.unlockAsync();
    } catch (error) {
      console.error("Failed to unlock orientation:", error);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
    return true;
  };

  const togglePlayPause = async () => {
    if (videoRef.current) {
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
  };

  const handlePlaybackStatusUpdate = (status) => {
    setStatus(status);
    if (status.isLoaded) {
      setLoading(false);
      // Calculate progress
      if (status.durationMillis > 0) {
        const currentProgress = status.positionMillis / status.durationMillis;
        setProgress(currentProgress);
      }
    }
  };

  const handleVideoError = (error) => {
    console.error("Video playback error:", error);
    setError("Failed to load video. Please try again.");
    setLoading(false);
  };

  const toggleControls = () => {
    setControlsVisible(!controlsVisible);
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
  };

  const formatTime = (milliseconds) => {
    if (!milliseconds) return "0:00";

    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const seekVideo = async (value) => {
    if (videoRef.current && status.durationMillis) {
      const seek = value * status.durationMillis;
      await videoRef.current.setPositionAsync(seek);
    }
  };

  const renderVideoTitle = () => {
    let displayTitle = title || "";

    if (!isTrailer && type === "episode" && seasonNumber && episodeNumber) {
      displayTitle = `S${seasonNumber}:E${episodeNumber} - ${title}`;
    }

    return displayTitle;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />

      <TouchableOpacity
        activeOpacity={1}
        style={styles.videoContainer}
        onPress={toggleControls}
      >
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          rate={1.0}
          volume={1.0}
          isMuted={false}
          resizeMode="contain"
          shouldPlay={true}
          isLooping={false}
          style={styles.video}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={handleVideoError}
          useNativeControls={false}
        />

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={handleBackPress}
            >
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Video controls */}
        {controlsVisible && !error && (
          <View style={styles.controlsContainer}>
            {/* Top bar */}
            <View style={styles.topControls}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackPress}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.videoTitle} numberOfLines={1}>
                {renderVideoTitle()}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Center play/pause button */}
            <TouchableOpacity
              style={styles.centerButton}
              onPress={togglePlayPause}
            >
              <Ionicons
                name={status.isPlaying ? "pause" : "play"}
                size={50}
                color="#fff"
              />
            </TouchableOpacity>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              <Text style={styles.timeText}>
                {formatTime(status.positionMillis)} /{" "}
                {formatTime(status.durationMillis)}
              </Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressBackground} />
                <View
                  style={[styles.progressBar, { width: `${progress * 100}%` }]}
                />
              </View>

              <TouchableOpacity
                style={styles.fullscreenButton}
                onPress={() => {
                  // Toggle fullscreen logic here when needed
                }}
              >
                <Ionicons name="scan-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  controlsContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "space-between",
  },
  topControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  videoTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  centerButton: {
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  timeText: {
    color: "#fff",
    fontSize: 14,
    marginRight: 10,
  },
  progressContainer: {
    flex: 1,
    height: 5,
    position: "relative",
    marginRight: 10,
  },
  progressBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 5,
  },
  progressBar: {
    height: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  fullscreenButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default VideoPlayerScreen;
