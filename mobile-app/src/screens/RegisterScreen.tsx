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
import { radii } from "../theme";
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
  const [role, setRole] = useState<UserRole>("consumer");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await register(name, email, password, role, businessName);
    setLoading(false);
    if (!res.ok) setError(res.error || "Registration failed");
  };

  return (
    <LinearGradient colors={["#0B0D10", "#1A1030", "#0B0D10"]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Join STRIDE</Text>
          <Text style={styles.sub}>Create your walker or merchant account</Text>
          <View style={styles.roleRow}>
            <PressableScale style={[styles.roleBtn, role === "consumer" && styles.roleActive]} onPress={() => setRole("consumer")}>
              <Text style={[styles.roleText, role === "consumer" && styles.roleTextActive]}>Walker</Text>
            </PressableScale>
            <PressableScale style={[styles.roleBtn, role === "merchant" && styles.roleActive]} onPress={() => setRole("merchant")}>
              <Text style={[styles.roleText, role === "merchant" && styles.roleTextActive]}>Merchant</Text>
            </PressableScale>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.slate} placeholder="Your name" />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholderTextColor={colors.slate} placeholder="you@email.com" />
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor={colors.slate} placeholder="Min 4 characters" />
            {role === "merchant" ? (
              <>
                <Text style={styles.label}>Business name</Text>
                <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholderTextColor={colors.slate} placeholder="Cafe / Store name" />
              </>
            ) : null}
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
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  title: { color: colors.textLight, fontSize: 28, fontWeight: "900", textAlign: "center" },
  sub: { color: colors.mutedDark, textAlign: "center", marginTop: 8, marginBottom: 20 },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: radii.full, borderWidth: 1, borderColor: colors.borderDark, alignItems: "center", backgroundColor: colors.cardDark },
  roleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { color: colors.mutedDark, fontWeight: "700" },
  roleTextActive: { color: colors.onPrimary },
  card: { backgroundColor: colors.cardDark, borderRadius: radii.xl, padding: 20, borderWidth: 1, borderColor: colors.borderDark },
  label: { color: colors.mutedDark, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#0F172A", borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.textLight, borderWidth: 1, borderColor: colors.borderDark },
  error: { color: colors.coralInk, marginTop: 12, fontWeight: "600" },
  primaryBtn: { marginTop: 20, backgroundColor: colors.primary, borderRadius: radii.full, paddingVertical: 16, alignItems: "center" },
  primaryText: { color: colors.onPrimary, fontWeight: "800", letterSpacing: 1 },
  link: { color: colors.emeraldInk, textAlign: "center", fontWeight: "600" },
}));
