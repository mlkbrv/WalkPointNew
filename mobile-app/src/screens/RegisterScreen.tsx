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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { AuthStackParamList, UserRole } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { radii, spacing, type, shadows } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

type Nav = NativeStackNavigationProp<AuthStackParamList, "Register">;

export function RegisterScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<Nav>();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await register(name, email, password);
    setLoading(false);
    if (!res.ok) setError(res.error || "Registration failed");
  };

  return (
    <LinearGradient colors={["#0B0D10", "#1B0F33", "#0B0D10"]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Join STRIDE</Text>
          <Text style={styles.sub}>Start earning coins for the steps you already take</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.slate} placeholder="Your name" />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholderTextColor={colors.slate} placeholder="you@email.com" />
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor={colors.slate} placeholder="Min 4 characters" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PressableScale style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>CREATE ACCOUNT</Text>}
            </PressableScale>
          </View>
          <PressableScale onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
            <Text style={styles.link}>Already have an account? Log in</Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  title: { color: colors.textLight, fontSize: 34, fontWeight: "700", textAlign: "center" },
  sub: { color: colors.mutedDark, textAlign: "center", marginTop: 8, marginBottom: 20 },
  card: { backgroundColor: colors.card, borderRadius: radii.xl, padding: 20, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  label: { color: colors.muted, fontSize: 13, fontWeight: "600", letterSpacing: 1, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: colors.inputSurface, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.textLight, borderWidth: 1, borderColor: colors.border, ...shadows.surface },
  error: { color: colors.coralInk, marginTop: 12, fontWeight: "400" },
  primaryBtn: { marginTop: 20, backgroundColor: colors.primary, borderRadius: radii.full, paddingVertical: 16, alignItems: "center", ...shadows.fab },
  primaryText: { color: colors.onPrimary, fontWeight: "600", letterSpacing: 1 },
  link: { color: colors.primary, textAlign: "center", fontWeight: "400" },
}));
