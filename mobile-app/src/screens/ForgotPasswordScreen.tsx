import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../contexts/AuthContext";
import { radii } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await resetPassword(email);
    setLoading(false);
    if (res.ok) setMessage(res.message);
    else setError(res.message);
  };

  return (
    <LinearGradient colors={["#0B0D10", "#0D2620", "#0B0D10"]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.inner}>
        <ScreenHeader title="Reset Password" onBack={() => navigation.goBack()} light />
        <Text style={styles.sub}>We'll email you a secure reset link for your STRIDE account.</Text>
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
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}
          <PressableScale style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>SEND RESET LINK</Text>}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1 },
  inner: { flex: 1, padding: 24, paddingTop: 56 },
  sub: { color: colors.mutedDark, marginBottom: 20, lineHeight: 20 },
  card: { backgroundColor: colors.cardDark, borderRadius: radii.xl, padding: 20, borderWidth: 1, borderColor: colors.borderDark },
  label: { color: colors.mutedDark, fontSize: 13, fontWeight: "600", letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: "#0F172A", borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.textLight, borderWidth: 1, borderColor: colors.borderDark },
  error: { color: colors.coralInk, marginTop: 12, fontWeight: "400" },
  success: { color: colors.emeraldInk, marginTop: 12, fontWeight: "400" },
  primaryBtn: { marginTop: 20, backgroundColor: colors.primary, borderRadius: radii.full, paddingVertical: 16, alignItems: "center" },
  primaryText: { color: colors.onPrimary, fontWeight: "600", letterSpacing: 1 },
}));
