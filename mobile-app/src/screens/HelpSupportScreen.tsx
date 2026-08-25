import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useStride } from "../contexts/StrideContext";
import { describeError } from "../api/client";
import { supportApi, type ApiFaqEntry } from "../api/endpoints";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

export function HelpSupportScreen() {
  const navigation = useNavigation<any>();
  const { showToast } = useStride();
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [faqs, setFaqs] = useState<ApiFaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Served by the API so support can fix an answer without shipping an app update.
  const loadFaq = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFaqs(await supportApi.faq());
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFaq();
  }, [loadFaq]);

  const toggleFAQ = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Help & Support" onBack={() => navigation.goBack()} />

        <Text style={styles.sub}>Find answers quickly or reach the STRIDE member helpdesk.</Text>

        <Text style={styles.section}>FAQ</Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <GlassCard style={styles.faqCard}>
            <Text style={styles.faqQ}>Could not load answers</Text>
            <Text style={styles.faqA}>{error}</Text>
            <PressableScale style={styles.retry} onPress={() => void loadFaq()}>
              <Text style={styles.retryText}>Try again</Text>
            </PressableScale>
          </GlassCard>
        ) : faqs.length === 0 ? (
          <GlassCard style={styles.faqCard}>
            <Text style={styles.faqA}>No answers published yet. Start a chat below.</Text>
          </GlassCard>
        ) : (
          faqs.map((faq) => {
            const open = openIds.includes(faq.id);
            return (
              <GlassCard key={faq.id} style={styles.faqCard}>
                <PressableScale style={styles.faqHeader} onPress={() => toggleFAQ(faq.id)}>
                  <Text style={styles.faqQ}>{faq.question}</Text>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.slate}
                  />
                </PressableScale>
                {open ? <Text style={styles.faqA}>{faq.answer}</Text> : null}
              </GlassCard>
            );
          })
        )}

        <Text style={styles.section}>Contact</Text>
        <PressableScale style={styles.action} onPress={() => showToast("Opening email support…", "✉️")}>
          <View style={[styles.actionIcon, { backgroundColor: "rgba(129,64,243,0.12)" }]}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.actionMeta}>
            <Text style={styles.actionTitle}>Email Support</Text>
            <Text style={styles.actionSub}>support@stride.app</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </PressableScale>

        <PressableScale style={styles.action} onPress={() => navigation.navigate("SupportChat")}>
          <View style={[styles.actionIcon, { backgroundColor: "rgba(0,225,148,0.12)" }]}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.emerald} />
          </View>
          <View style={styles.actionMeta}>
            <Text style={styles.actionTitle}>Message support</Text>
            <Text style={styles.actionSub}>A person replies, usually within a day</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.xxl, alignItems: "center" },
  retry: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontWeight: "600", fontSize: 13 },
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  sub: { color: colors.slate, fontSize: 12, lineHeight: 18, marginBottom: spacing.lg, marginTop: -4 },
  section: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  faqCard: { marginBottom: spacing.md, padding: 14 },
  faqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  faqQ: { flex: 1, color: colors.charcoal, fontWeight: "700", fontSize: 13 },
  faqA: { color: colors.slate, fontSize: 12, lineHeight: 18, marginTop: 10 },
  action: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: spacing.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionMeta: { flex: 1 },
  actionTitle: { color: colors.charcoal, fontWeight: "800", fontSize: 13 },
  actionSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
