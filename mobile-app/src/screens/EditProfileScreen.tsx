import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../contexts/AuthContext";
import { useStride } from "../contexts/StrideContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

export function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, updateProfile } = useAuth();
  const { userStats, setUserStats, showToast } = useStride();

  const [name, setName] = useState(user?.name || "");
  const [weight, setWeight] = useState(String(userStats.weightKg));
  const [height, setHeight] = useState(String(userStats.heightCm));
  const [stepsGoal, setStepsGoal] = useState(String(userStats.stepsGoal));
  const [avatar, setAvatar] = useState(user?.avatar || "");

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast("Photo permission denied", "📷");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatar(result.assets[0].uri);
      }
    } catch {
      showToast("Image picker unavailable", "⚠️");
    }
  };

  const onSave = async () => {
    const w = Number(weight) || userStats.weightKg;
    const h = Number(height) || userStats.heightCm;
    const g = Number(stepsGoal) || userStats.stepsGoal;
    await updateProfile({ name: name.trim() || user?.name || "Walker", avatar: avatar || user?.avatar });
    setUserStats((prev) => ({
      ...prev,
      weightKg: w,
      heightCm: h,
      stepsGoal: g,
    }));
    showToast("Profile updated", "✅");
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Edit Profile" onBack={() => navigation.goBack()} />

          <PressableScale style={styles.avatarWrap} onPress={pickImage}>
            <Image
              source={{
                uri:
                  avatar ||
                  undefined,
              }}
              style={styles.avatar}
            />
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          </PressableScale>

          <GlassCard style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.muted} />

            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Daily Steps Goal</Text>
            <TextInput
              style={styles.input}
              value={stepsGoal}
              onChangeText={setStepsGoal}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Avatar URL</Text>
            <TextInput
              style={styles.input}
              value={avatar}
              onChangeText={setAvatar}
              autoCapitalize="none"
              placeholderTextColor={colors.muted}
              placeholder="https://..."
            />
          </GlassCard>

          <PressableScale style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveText}>SAVE CHANGES</Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  avatarWrap: { alignSelf: "center", marginBottom: spacing.xl },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: "rgba(129,64,243,0.25)" },
  editBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  form: { padding: 18 },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 10,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: "600",
  },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
});
