import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { useStride } from "../contexts/StrideContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

export function CreateCouponScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { createMerchantCoupon, showToast } = useStride();

  const [title, setTitle] = useState("");
  const [discount, setDiscount] = useState("20");
  const [tokenPrice, setTokenPrice] = useState("5000");
  const [expirationDays, setExpirationDays] = useState("30");
  const [logoUrl, setLogoUrl] = useState("");
  const [category, setCategory] = useState("FOOD");

  const onCreate = () => {
    if (!title.trim()) {
      showToast("Title is required", "⚠️");
      return;
    }
    const days = Number(expirationDays) || 30;
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const brandName = user?.businessName || user?.name || "Merchant";
    createMerchantCoupon({
      title: title.trim(),
      brandId: user?.id || "merchant",
      brandName,
      logo: logoUrl.trim() || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=100&q=80",
      category: category.trim().toUpperCase() || "REWARD",
      stepsCost: Number(tokenPrice) || 5000,
      image: logoUrl.trim() || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=400&q=80",
      discountPercent: Number(discount) || 0,
      expiresAt: expires.toISOString(),
      published: true,
    });
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Create Coupon" onBack={() => navigation.goBack()} />

          <GlassCard style={styles.form}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="20% Off Lunch Combo"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Discount %</Text>
            <TextInput
              style={styles.input}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Token Price</Text>
            <TextInput
              style={styles.input}
              value={tokenPrice}
              onChangeText={setTokenPrice}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Expiration Days</Text>
            <TextInput
              style={styles.input}
              value={expirationDays}
              onChangeText={setExpirationDays}
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Logo URL</Text>
            <TextInput
              style={styles.input}
              value={logoUrl}
              onChangeText={setLogoUrl}
              autoCapitalize="none"
              placeholder="https://..."
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="FOOD"
              placeholderTextColor={colors.muted}
            />
          </GlassCard>

          <PressableScale style={styles.createBtn} onPress={onCreate}>
            <Text style={styles.createText}>PUBLISH COUPON</Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
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
  createBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  createText: { color: colors.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
});
