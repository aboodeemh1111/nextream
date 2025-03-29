import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../src/config";

const { width } = Dimensions.get("window");

// Card size presets
const CARD_SIZES = {
  small: {
    width: width * 0.28,
    height: width * 0.42,
    margin: 4,
  },
  medium: {
    width: width * 0.33,
    height: width * 0.5,
    margin: 5,
  },
  large: {
    width: width * 0.4,
    height: width * 0.6,
    margin: 6,
  },
};

interface ContentRowProps {
  title: string;
  items: any[];
  onItemPress: (item: any) => void;
  cardSize?: "small" | "medium" | "large";
  showPlayButton?: boolean;
}

const ContentRow: React.FC<ContentRowProps> = ({
  title,
  items,
  onItemPress,
  cardSize = "medium",
  showPlayButton = false,
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  const size = CARD_SIZES[cardSize];

  const renderItem = ({ item }: { item: any }) => {
    const imageUrl =
      item.posterUrl || item.backdropUrl || item.img || item.imgSm;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { width: size.width, height: size.height, margin: size.margin },
        ]}
        onPress={() => onItemPress(item)}
        activeOpacity={0.7}
      >
        <Image
          source={
            imageUrl
              ? { uri: imageUrl }
              : require("../assets/placeholder-poster.png")
          }
          style={styles.cardImage}
          resizeMode="cover"
        />

        {showPlayButton && (
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => onItemPress(item)}
            activeOpacity={0.9}
          >
            <Ionicons name="play-circle" size={36} color={COLORS.text} />
          </TouchableOpacity>
        )}

        {item.releaseYear && (
          <Text style={styles.yearText}>{item.releaseYear}</Text>
        )}

        {item.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 10,
  },
  card: {
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: COLORS.background,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  playButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    boxShadow: "0px 2px 3px rgba(0, 0, 0, 0.8)",
    elevation: 5,
  },
  yearText: {
    position: "absolute",
    bottom: 10,
    left: 10,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "bold",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  newBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  newBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "bold",
  },
});

export default ContentRow;
