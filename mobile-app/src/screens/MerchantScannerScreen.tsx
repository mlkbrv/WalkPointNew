/**
 * Voucher redemption for a partner.
 *
 * Scanning is deliberately two steps. `preview` reads the code without
 * consuming it, so a mis-scan, an expired voucher, or one already used costs
 * nothing; only the explicit confirm calls `scan`, which burns it. That call is
 * not idempotent on purpose — a second scan of the same voucher must fail, and
 * the server is what enforces it.
 */

import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";

import { describeError } from "../api/client";
import { redemptionsApi, type ApiScanPreview } from "../api/endpoints";
import { useStride } from "../contexts/StrideContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

/** Vouchers are identified by a UUID the server generates; anything else is not a code. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Outcome = { ok: boolean; message: string };

/**
 * What a scanned code turns out to be, and the one button that consumes it.
 * Rendered only between a successful `preview` and the merchant's decision.
 */
function VoucherPreview({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: ApiScanPreview;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const usedOn = preview.used_at
    ? ` on ${new Date(preview.used_at).toLocaleDateString()}`
    : "";

  return (
    <GlassCard style={styles.preview}>
      <Text style={styles.previewTitle}>{preview.coupon_title}</Text>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Paid</Text>
        <Text style={styles.previewValue}>{preview.cost_paid} coins</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Valid until</Text>
        <Text style={styles.previewValue}>
          {new Date(preview.valid_until).toLocaleDateString()}
        </Text>
      </View>

      {preview.is_redeemable ? (
        <PressableScale style={styles.validateBtn} disabled={busy} onPress={onConfirm}>
          {busy ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.validateText}>Redeem</Text>
            </>
          )}
        </PressableScale>
      ) : (
        <View style={[styles.result, styles.resultBad]}>
          <Ionicons name="close-circle" size={18} color={colors.coralInk} />
          <Text style={[styles.resultText, { color: colors.coralInk }]}>
            {preview.status === "used"
              ? `Already redeemed${usedOn}.`
              : "This voucher has expired."}
          </Text>
        </View>
      )}

      <PressableScale style={styles.cancel} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </PressableScale>
    </GlassCard>
  );
}

export function MerchantScannerScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { showToast } = useStride();
  const [permission, requestPermission] = useCameraPermissions();

  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<ApiScanPreview | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  /** Guards the camera, which fires continuously while a code is in frame. */
  const scanningRef = useRef(false);

  const lookUp = useCallback(
    async (raw: string) => {
      const token = raw.trim();
      if (!token) {
        showToast("Enter a code", "⚠️");
        return;
      }
      if (!UUID.test(token)) {
        setPreview(null);
        setOutcome({ ok: false, message: "That is not a STRIDE voucher code." });
        return;
      }

      setBusy(true);
      setOutcome(null);
      try {
        setPreview(await redemptionsApi.preview(token));
      } catch (caught) {
        setPreview(null);
        setOutcome({ ok: false, message: describeError(caught) });
      } finally {
        setBusy(false);
      }
    },
    [showToast],
  );

  const confirm = useCallback(async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await redemptionsApi.scan(preview.voucher_id);
      setPreview(null);
      setCode("");
      setOutcome({
        ok: true,
        message: `${result.coupon_title} redeemed for ${result.customer_label}.`,
      });
    } catch (caught) {
      // The usual failure is a race: someone else redeemed it a moment ago.
      setOutcome({ ok: false, message: describeError(caught) });
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }, [preview]);

  const onBarcode = ({ data }: { data: string }) => {
    if (scanningRef.current || preview || busy) return;
    scanningRef.current = true;
    void lookUp(data).finally(() => {
      setTimeout(() => {
        scanningRef.current = false;
      }, 2000);
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <ScreenHeader title="Merchant Scanner" onBack={() => navigation.goBack()} />

        {permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onBarcode}
            />
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Align the customer&apos;s QR inside the frame</Text>
          </View>
        ) : (
          <GlassCard style={styles.permCard}>
            <Ionicons name="camera-outline" size={36} color={colors.primary} />
            <Text style={styles.permTitle}>Camera access needed</Text>
            <Text style={styles.permBody}>
              Allow camera permission to scan customer codes, or enter codes manually below.
            </Text>
            <PressableScale style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Grant Camera Permission</Text>
            </PressableScale>
          </GlassCard>
        )}

        {/* The confirm step. Nothing is consumed until this button is pressed. */}
        {preview ? (
          <VoucherPreview
            preview={preview}
            busy={busy}
            onConfirm={() => void confirm()}
            onCancel={() => setPreview(null)}
          />
        ) : (
          <GlassCard style={styles.manual}>
            <Text style={styles.label}>Manual Code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="0000aaaa-0000-4000-8000-000000000000"
              placeholderTextColor={colors.muted}
            />
            <PressableScale
              style={styles.validateBtn}
              disabled={busy}
              onPress={() => void lookUp(code)}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="search-outline" size={18} color={colors.white} />
                  <Text style={styles.validateText}>Look up</Text>
                </>
              )}
            </PressableScale>
          </GlassCard>
        )}

        {outcome ? (
          <View style={[styles.result, outcome.ok ? styles.resultOk : styles.resultBad]}>
            <Ionicons
              name={outcome.ok ? "checkmark-circle" : "close-circle"}
              size={18}
              color={outcome.ok ? colors.emeraldInk : colors.coralInk}
            />
            <Text
              style={[styles.resultText, { color: outcome.ok ? colors.emeraldInk : colors.coralInk }]}
            >
              {outcome.message}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, padding: spacing.xl, paddingTop: 56 },
  cameraWrap: {
    height: 280,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.dark,
    marginBottom: spacing.lg,
  },
  camera: { flex: 1 },
  scanFrame: {
    position: "absolute",
    top: "20%",
    left: "15%",
    right: "15%",
    bottom: "28%",
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.lg,
  },
  scanHint: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  permCard: { padding: 24, alignItems: "center", gap: 8, marginBottom: spacing.lg },
  permTitle: { color: colors.charcoal, fontWeight: "800", fontSize: 15 },
  permBody: { color: colors.slate, fontSize: 12, textAlign: "center", lineHeight: 18 },
  permBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  permBtnText: { color: colors.white, fontWeight: "800", fontSize: 12 },
  manual: { padding: 16 },
  preview: { padding: 18, gap: 10 },
  previewTitle: { color: colors.charcoal, fontWeight: "800", fontSize: 16 },
  previewRow: { flexDirection: "row", justifyContent: "space-between" },
  previewLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  previewValue: { color: colors.charcoal, fontSize: 12, fontWeight: "800" },
  cancel: { alignSelf: "center", paddingVertical: 8 },
  cancelText: { color: colors.slate, fontSize: 12, fontWeight: "700" },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
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
    fontWeight: "700",
    fontSize: 12,
  },
  validateBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  validateText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  result: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  resultOk: { backgroundColor: "rgba(0,225,148,0.1)", borderColor: "rgba(0,225,148,0.3)" },
  resultBad: { backgroundColor: "rgba(255,107,82,0.1)", borderColor: "rgba(255,107,82,0.3)" },
  resultText: { flex: 1, fontWeight: "700", fontSize: 12 },
}));
