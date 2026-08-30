import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { describeError } from "../api/client";
import { supportApi, type ApiSupportMessage, type ApiSupportThread } from "../api/endpoints";
import { GlassCard } from "../components/GlassCard";
import { PressableScale } from "../components/PressableScale";
import { ScreenHeader } from "../components/ScreenHeader";
import { radii, spacing } from "../theme";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

function Bubble({ message }: { message: ApiSupportMessage }) {
  const styles = useStyles();
  const mine = message.sender === "user";
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}

export function SupportChatScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<any>(null);

  const [thread, setThread] = useState<ApiSupportThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setThread(await supportApi.thread());
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setDraft("");
    setError(null);
    try {
      await supportApi.send(body);
      // Reload rather than append: the first message also creates the thread,
      // and the server owns its id and subject.
      await load();
    } catch (caught) {
      setError(describeError(caught));
      setDraft(body);
    } finally {
      setSending(false);
    }
  }, [draft, sending, load]);

  const messages = thread?.messages ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Support" onBack={navigation.canGoBack() ? navigation.goBack : undefined} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
        >
          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {!loading && error && messages.length === 0 && (
            <GlassCard style={styles.notice}>
              <Ionicons name="cloud-offline-outline" size={22} color={colors.coralInk} />
              <Text style={styles.noticeTitle}>Could not load your messages</Text>
              <Text style={styles.noticeBody}>{error}</Text>
              <PressableScale onPress={() => void load()} style={styles.retry}>
                <Text style={styles.retryText}>Try again</Text>
              </PressableScale>
            </GlassCard>
          )}

          {!loading && !error && messages.length === 0 && (
            <GlassCard style={styles.notice}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.primary} />
              <Text style={styles.noticeTitle}>Ask us anything</Text>
              <Text style={styles.noticeBody}>
                Steps not counting, a coupon that would not scan, anything else — write below
                and a person will answer.
              </Text>
            </GlassCard>
          )}

          {messages.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}

          {thread?.status === "closed" && (
            <Text style={styles.closedNote}>
              This conversation was closed. Writing again starts a new one.
            </Text>
          )}
        </ScrollView>

        {error && messages.length > 0 && <Text style={styles.inlineError}>{error}</Text>}

        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TextInput
            style={styles.input}
            placeholder="Write a message…"
            placeholderTextColor={colors.muted}
            value={draft}
            onChangeText={setDraft}
            multiline
            editable={!sending}
          />
          <PressableScale
            onPress={send}
            style={draft.trim() && !sending ? styles.send : [styles.send, styles.sendDisabled]}
            disabled={!draft.trim() || sending}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { paddingVertical: spacing.xxxl, alignItems: "center" },

  notice: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  noticeTitle: { fontSize: 17, fontWeight: "400", color: colors.text },
  noticeBody: { fontSize: 15, fontWeight: "400", color: colors.slate, textAlign: "center" },
  retry: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontWeight: "400", fontSize: 15 },

  bubbleRow: { flexDirection: "row", marginBottom: spacing.md },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", padding: spacing.md, borderRadius: radii.lg },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radii.sm },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radii.sm,
  },
  bubbleText: { fontSize: 15, fontWeight: "400", color: colors.text },
  bubbleTextMine: { color: colors.textLight },
  bubbleTime: { fontSize: 13, fontWeight: "400", color: colors.muted, marginTop: 4 },
  bubbleTimeMine: { color: "rgba(255,255,255,0.7)" },

  closedNote: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  inlineError: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.coralInk,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sendDisabled: { backgroundColor: colors.muted },
}));
