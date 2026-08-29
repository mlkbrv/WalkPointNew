/**
 * Creating a partner offer.
 *
 * The form now matches what the server actually stores. "Discount %" and the
 * free-text "Category" are gone — neither existed in the coupon model, so they
 * were typed into a field that was thrown away. What replaces them is the pair
 * the economy needs: what the coupon costs in coins, and how many exist.
 *
 * The button says "Save draft" rather than "Publish" because that is what it
 * does. Nothing reaches users until a moderator approves it.
 */

import { useCallback, useState } from "react";
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

import { describeError } from "../api/client";
import { businessApi } from "../api/endpoints";
import { useStride } from "../contexts/StrideContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

/** Mirrors the server's own bounds so a bad value is caught before the round trip. */
const LIMITS = { cost: [1, 1_000_000], quantity: [1, 1_000_000], days: [1, 3650] };

function invalidField(
  title: string,
  cost: number,
  quantity: number,
  days: number,
): string | null {
  if (title.trim().length < 2) return "Give the coupon a title of at least 2 characters.";
  if (!Number.isInteger(cost) || cost < LIMITS.cost[0] || cost > LIMITS.cost[1]) {
    return "Cost must be a whole number of coins, at least 1.";
  }
  if (!Number.isInteger(quantity) || quantity < LIMITS.quantity[0]) {
    return "Quantity must be a whole number, at least 1.";
  }
  if (!Number.isInteger(days) || days < LIMITS.days[0]) {
    return "The offer has to run for at least one day.";
  }
  return null;
}

export function CreateCouponScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<{ goBack: () => void }>();
  const { showToast } = useStride();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [cost, setCost] = useState("5000");
  const [quantity, setQuantity] = useState("100");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = useCallback(async () => {
    const costCoins = Number(cost);
    const quantityTotal = Number(quantity);
    const runDays = Number(days);

    const problem = invalidField(title, costCoins, quantityTotal, runDays);
    if (problem) {
      setError(problem);
      return;
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + runDays);

    setBusy(true);
    setError(null);
    try {
      await businessApi.createCoupon({
        title: title.trim(),
        description: description.trim(),
        rules: rules.trim(),
        cost_coins: costCoins,
        quantity_total: quantityTotal,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      });
      showToast("Draft saved — submit it for review", "📝");
      navigation.goBack();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }, [title, description, rules, cost, quantity, days, showToast, navigation]);

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Create Coupon" onBack={() => navigation.goBack()} />

          <GlassCard style={styles.form}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="20% off any lunch combo"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="What the customer gets."
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Rules</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={rules}
              onChangeText={setRules}
              multiline
              placeholder="One per customer, dine-in only, not with other offers."
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Cost in coins</Text>
            <TextInput
              style={styles.input}
              value={cost}
              onChangeText={setCost}
              keyboardType="number-pad"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.hint}>
              What a user pays. At 50 coins for 5,000 steps, 5,000 coins is a long way walked.
            </Text>

            <Text style={styles.label}>How many exist</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Runs for (days)</Text>
            <TextInput
              style={styles.input}
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
              placeholderTextColor={colors.muted}
            />
          </GlassCard>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PressableScale style={styles.createBtn} disabled={busy} onPress={() => void onCreate()}>
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.createText}>SAVE DRAFT</Text>
            )}
          </PressableScale>
          <Text style={styles.footnote}>
            Drafts are private. Submit one from the manager to send it to moderation.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
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
    backgroundColor: colors.inputSurface,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: "600",
  },
  multiline: { minHeight: 76, textAlignVertical: "top" },
  hint: { color: colors.muted, fontSize: 10, marginTop: 6, lineHeight: 14 },
  error: {
    color: colors.coralInk,
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.md,
    textAlign: "center",
  },
  createBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  createText: { color: colors.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  footnote: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 16,
  },
}));
