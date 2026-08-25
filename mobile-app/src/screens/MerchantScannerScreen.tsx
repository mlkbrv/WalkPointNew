import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useStride } from "../contexts/StrideContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

export function MerchantScannerScreen() {
  const navigation = useNavigation<any>();
  const { redeemMerchantCode, showToast } = useStride();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [scanned, setScanned] = useState(false);

  const validate = (raw?: string) => {
    const value = (raw ?? code).trim();
    if (!value) {
      showToast("Enter a code", "⚠️");
      return;
    }
    const res = redeemMerchantCode(value);
    setResult(res);
    setCode("");
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    validate(data);
    setTimeout(() => setScanned(false), 2000);
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
              barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39"] }}
              onBarcodeScanned={onBarcode}
            />
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Align QR / barcode inside the frame</Text>
          </View>
        ) : (
          <GlassCard style={styles.permCard}>
            <Ionicons name="camera-outline" size={36} color={colors.primary} />
            <Text style={styles.permTitle}>Camera access needed</Text>
            <Text style={styles.permBody}>Allow camera permission to scan customer codes, or enter codes manually below.</Text>
            <PressableScale style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Grant Camera Permission</Text>
            </PressableScale>
          </GlassCard>
        )}

        <GlassCard style={styles.manual}>
          <Text style={styles.label}>Manual Code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="SBX-LATTE-50"
            placeholderTextColor={colors.muted}
          />
          <PressableScale style={styles.validateBtn} onPress={() => validate()}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
            <Text style={styles.validateText}>Validate</Text>
          </PressableScale>
        </GlassCard>

        {result ? (
          <View style={[styles.result, result.ok ? styles.resultOk : styles.resultBad]}>
            <Ionicons
              name={result.ok ? "checkmark-circle" : "close-circle"}
              size={18}
              color={result.ok ? colors.emerald : colors.coral}
            />
            <Text style={[styles.resultText, { color: result.ok ? colors.emerald : colors.coral }]}>
              {result.message}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
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
    fontWeight: "700",
    letterSpacing: 1,
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
});
