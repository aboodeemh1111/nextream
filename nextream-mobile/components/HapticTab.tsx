import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet } from "react-native";

export function HapticTab(props: BottomTabBarButtonProps) {
  // Extract the pointerEvents prop and remove it from the props to avoid passing it directly
  const { pointerEvents, style: propStyle, ...restProps } = props;

  // Create a new style object that includes pointerEvents
  const style = StyleSheet.flatten([
    propStyle,
    pointerEvents ? { pointerEvents } : null,
  ]);

  return (
    <PlatformPressable
      {...restProps}
      style={style}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
