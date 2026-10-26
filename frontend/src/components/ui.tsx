import Ionicons from "@react-native-vector-icons/ionicons";
import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, TextInputProps, View } from "react-native";

import { makeStyles, useTheme } from "@/src/theme";

type BtnProps = {
  title: string;
  onPress: () => void;
  testID: string;
  variant?: "primary" | "secondary" | "danger" | "whatsapp";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
};

export function Button({ title, onPress, testID, variant = "primary", loading, disabled, icon }: BtnProps) {
  const styles = useStyles();
  const bg = styles[variant];
  const fg = styles[`${variant}Text` as const];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, bg, (disabled || loading) && { opacity: 0.6 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      {loading ? (
        <ActivityIndicator color={(fg as any).color} />
      ) : (
        <>
          {icon ? <Ionicons name={icon as any} size={20} color={(fg as any).color} /> : null}
          <Text style={[styles.btnText, fg]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, props.multiline && styles.multi, error ? styles.inputErr : null]} {...props} />
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, children }: { icon: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={36} color={colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  btn: { minHeight: 52, borderRadius: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 16, fontWeight: "600" },
  primary: { backgroundColor: c.brandPrimary },
  primaryText: { color: c.onBrandPrimary },
  secondary: { backgroundColor: c.brandTertiary },
  secondaryText: { color: c.onBrandTertiary },
  danger: { backgroundColor: c.error },
  dangerText: { color: c.onError },
  whatsapp: { backgroundColor: c.whatsapp },
  whatsappText: { color: c.onWhatsapp },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500", color: c.onSurface },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, paddingHorizontal: 12, fontSize: 16, color: c.onSurface },
  multi: { minHeight: 110, paddingTop: 12, textAlignVertical: "top" },
  inputErr: { borderColor: c.error },
  err: { color: c.error, fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: c.onSurface, textAlign: "center" },
  emptySub: { fontSize: 14, color: c.muted, textAlign: "center", marginBottom: 8 },
}));
