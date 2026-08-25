import "react-native-gesture-handler";
import React, { useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/contexts/AuthContext";
import { HealthProvider } from "./src/contexts/HealthContext";
import { ServerDataProvider } from "./src/contexts/ServerDataContext";
import { StrideProvider } from "./src/contexts/StrideContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AnimatedSplashScreen } from "./src/components/AnimatedSplashScreen";
import { usePushRegistration } from "./src/hooks/usePushRegistration";
import { useStepSync } from "./src/hooks/useStepSync";
import { colors } from "./src/theme";

/**
 * Device-level side effects that need every provider above them: keeping the
 * server's step total up to date, and keeping this device's push token current.
 * They render nothing — they live in a component only so they can use hooks.
 */
function DeviceSync() {
  useStepSync();
  usePushRegistration();
  return null;
}

export default function App() {
  const [isSplashFinished, setIsSplashFinished] = useState(false);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <HealthProvider>
            <ServerDataProvider>
              <StrideProvider>
                <DeviceSync />
                <StatusBar hidden translucent />
                <View style={styles.root}>
                  <RootNavigator />
                  {!isSplashFinished ? (
                    <AnimatedSplashScreen onFinish={() => setIsSplashFinished(true)} />
                  ) : null}
                </View>
              </StrideProvider>
            </ServerDataProvider>
          </HealthProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
});
