import "react-native-gesture-handler";
// Imported for its side effect: the background location task must be defined
// before the OS can hand a batch back, which can happen with no React tree.
import "./src/location/routeTask";
import { useState } from "react";
import { StatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./src/contexts/AuthContext";
import { HealthProvider } from "./src/contexts/HealthContext";
import { ServerDataProvider } from "./src/contexts/ServerDataContext";
import { StepointProvider } from "./src/contexts/StepointContext";
import { ThemeProvider, makeStyles, useTheme } from "./src/contexts/ThemeContext";
import { I18nProvider } from "./src/contexts/I18nContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AnimatedSplashScreen } from "./src/components/AnimatedSplashScreen";
import { usePushRegistration } from "./src/hooks/usePushRegistration";
import { useStepSync } from "./src/hooks/useStepSync";

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

/**
 * Split from `App` because it reads the theme, and a component cannot consume a
 * provider it renders itself. `ThemeProvider` is therefore the outermost thing
 * in `App`, and everything that reads a colour lives below it.
 */
function AppShell() {
  const styles = useStyles();
  const { isDark } = useTheme();
  const [isSplashFinished, setIsSplashFinished] = useState(false);

  return (
    <AuthProvider>
      <HealthProvider>
        <ServerDataProvider>
          <StepointProvider>
            <DeviceSync />
            {/* Hidden, but the style still governs the icons if it is ever shown. */}
            <StatusBar
              hidden
              translucent
              barStyle={isDark ? "light-content" : "dark-content"}
            />
            <View style={styles.root}>
              <RootNavigator />
              {!isSplashFinished ? (
                <AnimatedSplashScreen onFinish={() => setIsSplashFinished(true)} />
              ) : null}
            </View>
          </StepointProvider>
        </ServerDataProvider>
      </HealthProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {/* Above everything that renders text, and beside ThemeProvider
              rather than under any screen: language changes relabel the tab
              bar and the navigator too, not only the screen in front. */}
          <I18nProvider>
            <AppShell />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
}));
