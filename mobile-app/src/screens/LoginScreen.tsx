import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { AuthStackParamList } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { radii, spacing, type, shadows } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

type Nav = NativeStackNavigationProp<AuthStackParamList, "Login">;

export function LoginScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<Nav>();
  const { login } = useAuth();
  const [email, setEmail] = useState("xaliq@stride.app");
  const [password, setPassword] = useState("stride");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) setError(res.error || "Login failed");
  };

  return (
    <LinearGradient colors={["#0B0D10", "#1A1030", "#0B0D10"]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>STRIDE</Text>
          <Text style={styles.sub}>Move more. Earn more. Live better.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={colors.slate}
              placeholder="you@email.com"
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors.slate}
              placeholder="••••••••"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PressableScale style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>LOG IN</Text>}
            </PressableScale>

            <PressableScale onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={styles.link}>Forgot password?</Text>
            </PressableScale>
          </View>

          <PressableScale onPress={() => navigation.navigate("Register")} style={styles.secondary}>
            <Text style={styles.secondaryText}>Create an account</Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  brand: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
  },
  sub: { color: colors.mutedDark, textAlign: "center", marginTop: 8, marginBottom: 32, fontWeight: "400" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  label: { color: colors.muted, fontSize: 13, fontWeight: "600", letterSpacing: 1, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: colors.inputSurface,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textLight,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.surface,
  },
  error: { color: colors.coralInk, marginTop: 12, fontWeight: "400", fontSize: 15 },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: 16,
    alignItems: "center",
    ...shadows.fab,
  },
  primaryText: { color: colors.onPrimary, fontWeight: "600", letterSpacing: 1 },
  link: { color: colors.emeraldInk, textAlign: "center", marginTop: 16, fontWeight: "400" },
  secondary: { marginTop: 24, alignItems: "center" },
  secondaryText: { color: colors.textLight, fontWeight: "600" },
}));
