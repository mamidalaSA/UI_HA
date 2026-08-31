import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import type { MainTabParamList, RootStackParamList } from "./src/navigation/types";
import HistoryScreen from "./src/screens/HistoryScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PrescriptionScreen from "./src/screens/PrescriptionScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import { colors } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: focused ? "700" : "500", color: focused ? colors.primary : colors.textMuted }}>
      {label}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="TODAY" focused={focused} /> }}
      />
      <Tab.Screen
        name="Prescription"
        component={PrescriptionScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="RX" focused={focused} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="HISTORY" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={token ? "Main" : "Register"}>
      {token ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Register" component={RegisterScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
