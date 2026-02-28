import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { OKRProvider } from "@/lib/okr-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import Colors from "@/constants/colors";
import LoginScreen from "@/app/login";

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "返回" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="objective/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="create-objective"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.95],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="create-kr"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.85],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="update-progress"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.65],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="score-kr"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.7],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="manage-users"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.9],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="manage-departments"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.9],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="create-user"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.85],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="create-department"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.7],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="import-okr"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.9],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen
        name="change-password"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.7],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AuthGate>
                <OKRProvider>
                  <RootLayoutNav />
                </OKRProvider>
              </AuthGate>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
});
