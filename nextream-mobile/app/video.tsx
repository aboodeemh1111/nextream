import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  BackHandler,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { trackContentView } from "../src/services/contentService";
import { COLORS } from "../src/config";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function VideoPlayerScreen() {
  const params = useLocalSearchParams();
  const videoRef = useRef<Video>(null);

  // Get params
  const videoUrl = params.videoUrl as string;
  const title = params.title as string;
  const contentId = params.contentId as string | undefined;
  const episodeId = params.episodeId as string | undefined;
  const contentType = params.type as string | undefined;
  const isTrailer = params.isTrailer === "true";

  // States
  const [status, setStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Lock to landscape orientation
    lockOrientation();

    // Track content view if not a trailer
    if (contentId && !isTrailer) {
      trackContent();
    }

    // Override hardware back button
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    // Hide controls after 3 seconds
    showControlsTemporarily();

    return () => {
      // Unlock orientation when unmounting
      unlockOrientation();

      // Remove back handler
      backHandler.remove();

      // Clear any pending timeouts
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

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

  const trackContent = async () => {
    try {
      await trackContentView({
        contentId: contentId || "",
        episodeId: episodeId || "",
        type: contentType || "movie",
      });
    } catch (error) {
      console.error("Error tracking content view:", error);
      // Non-critical operation, we can continue even if this fails
    }
  };

  const handleBackPress = () => {
    router.back();
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
    showControlsTemporarily();
  };

  const handlePlaybackStatusUpdate = (status: any) => {
    setStatus(status);
    if (status.isLoaded) {
      setLoading(false);
      if (status.durationMillis) {
        setDuration(status.durationMillis);
        setProgress(status.positionMillis / status.durationMillis);
        setCurrentTime(status.positionMillis);
      }
    } else if (status.error) {
      setError("An error occurred during playback");
      setLoading(false);
    }
  };

  const handleVideoError = (error: string) => {
    console.error("Video playback error:", error);
    setError("Unable to play video. Please try again later.");
    setLoading(false);
  };

  const handleVideoPress = () => {
    setControlsVisible(!controlsVisible);
    if (controlsVisible) {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
        controlsTimeout.current = null;
      }
    } else {
      showControlsTemporarily();
    }
  };

  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      if (status.isPlaying) {
        setControlsVisible(false);
      }
    }, 3000);
  };

  const handleSeek = (value: number) => {
    const newPosition = value * duration;
    if (videoRef.current) {
      videoRef.current.setPositionAsync(newPosition);
    }
    setProgress(value);
    setCurrentTime(newPosition);
    showControlsTemporarily();
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
          title: title,
        }}
      />
      <StatusBar hidden />

      <TouchableOpacity
        activeOpacity={1}
        style={styles.videoContainer}
        onPress={handleVideoPress}
      >
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: videoUrl }}
          shouldPlay
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={() => handleVideoError("Video playback error")}
          useNativeControls={false}
        />

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading video...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleBackPress}
            >
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {controlsVisible && !loading && !error && (
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.titleText}>{title}</Text>

            <View style={styles.playbackControls}>
              <TouchableOpacity
                style={styles.playPauseButton}
                onPress={togglePlayPause}
              >
                <Ionicons
                  name={status.isPlaying ? "pause" : "play"}
                  size={36}
                  color="#fff"
                />
              </TouchableOpacity>

              <View style={styles.progressContainer}>
                <View
                  style={[styles.progressBar, { width: `${progress * 100}%` }]}
                />
                <View
                  style={[
                    styles.progressThumb,
                    { left: `${progress * 100}%`, marginLeft: -8 },
                  ]}
                />
              </View>

              <Text style={styles.timeText}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

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
    width: SCREEN_HEIGHT,
    height: SCREEN_WIDTH,
    backgroundColor: "#000",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 20,
  },
  errorText: {
    color: "#fff",
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
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  controlsContainer: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 10 : 20,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  titleText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    position: "absolute",
    top: Platform.OS === "ios" ? 20 : 30,
    left: 70,
    right: 20,
  },
  playbackControls: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  playPauseButton: {
    marginRight: 15,
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    marginRight: 10,
    position: "relative",
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    top: -6,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    width: 100,
    textAlign: "right",
  },
});
