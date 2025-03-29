import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

// Import screens (we'll create these next)
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import DownloadsScreen from "../screens/DownloadsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SeriesDetailScreen from "../screens/SeriesDetailScreen";
import MovieDetailScreen from "../screens/MovieDetailScreen";
import PlayerScreen from "../screens/PlayerScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

// Import auth context (we'll create this later)
import { useAuth } from "../context/AuthContext";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const SearchStack = createNativeStackNavigator();
const DownloadsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

// Auth navigator for login/register screens
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

// Home stack with series/movie details
const HomeStackNavigator = () => (
  <HomeStack.Navigator>
    <HomeStack.Screen
      name="HomeMain"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <HomeStack.Screen
      name="SeriesDetail"
      component={SeriesDetailScreen}
      options={{ title: "" }}
    />
    <HomeStack.Screen
      name="MovieDetail"
      component={MovieDetailScreen}
      options={{ title: "" }}
    />
    <HomeStack.Screen
      name="Player"
      component={PlayerScreen}
      options={{ headerShown: false }}
    />
  </HomeStack.Navigator>
);

// Search stack
const SearchStackNavigator = () => (
  <SearchStack.Navigator>
    <SearchStack.Screen
      name="SearchMain"
      component={SearchScreen}
      options={{ headerShown: false }}
    />
    <SearchStack.Screen
      name="SeriesDetail"
      component={SeriesDetailScreen}
      options={{ title: "" }}
    />
    <SearchStack.Screen
      name="MovieDetail"
      component={MovieDetailScreen}
      options={{ title: "" }}
    />
    <SearchStack.Screen
      name="Player"
      component={PlayerScreen}
      options={{ headerShown: false }}
    />
  </SearchStack.Navigator>
);

// Downloads stack
const DownloadsStackNavigator = () => (
  <DownloadsStack.Navigator>
    <DownloadsStack.Screen
      name="DownloadsMain"
      component={DownloadsScreen}
      options={{ headerShown: false }}
    />
    <DownloadsStack.Screen
      name="Player"
      component={PlayerScreen}
      options={{ headerShown: false }}
    />
  </DownloadsStack.Navigator>
);

// Profile stack
const ProfileStackNavigator = () => (
  <ProfileStack.Navigator>
    <ProfileStack.Screen
      name="ProfileMain"
      component={ProfileScreen}
      options={{ headerShown: false }}
    />
  </ProfileStack.Navigator>
);

// Main tab navigator
const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;

        if (route.name === "Home") {
          iconName = focused ? "home" : "home-outline";
        } else if (route.name === "Search") {
          iconName = focused ? "search" : "search-outline";
        } else if (route.name === "Downloads") {
          iconName = focused ? "download" : "download-outline";
        } else if (route.name === "Profile") {
          iconName = focused ? "person" : "person-outline";
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: "#E50914", // Netflix red
      tabBarInactiveTintColor: "gray",
      tabBarStyle: {
        backgroundColor: "#121212",
        borderTopColor: "#222",
      },
      headerShown: false,
    })}
  >
    <Tab.Screen name="Home" component={HomeStackNavigator} />
    <Tab.Screen name="Search" component={SearchStackNavigator} />
    <Tab.Screen name="Downloads" component={DownloadsStackNavigator} />
    <Tab.Screen name="Profile" component={ProfileStackNavigator} />
  </Tab.Navigator>
);

// Main app navigator that checks authentication state
const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    // We could show a splash screen here
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
