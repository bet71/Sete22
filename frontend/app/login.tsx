import Ionicons from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, Field } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email || !password) return setError("Preencha e-mail e senha");
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      toast(`Bem-vindo, ${u.name}!`, "success");
      router.replace(u.role === "admin" ? "/admin" : "/(tabs)");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable testID="login-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={styles.logo}>
          <Ionicons name="storefront" size={32} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.title}>Entrar</Text>
        <Text style={styles.sub}>Acesse sua conta para anunciar e gerenciar seus produtos.</Text>
        <View style={styles.form}>
          <Field testID="login-email-input" label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="seu@email.com" returnKeyType="next" />
          <Field testID="login-password-input" label="Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="Sua senha" returnKeyType="go" onSubmitEditing={submit} />
          {error ? <Text testID="login-error" style={styles.error}>{error}</Text> : null}
          <Button testID="login-submit-button" title="Entrar" onPress={submit} loading={loading} />
        </View>
        <Pressable testID="go-to-register-link" onPress={() => router.replace("/register")} style={styles.link}>
          <Text style={styles.linkText}>Não tem conta? <Text style={styles.linkStrong}>Cadastre-se</Text></Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

export const useAuthStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 24, gap: 8, flexGrow: 1 },
  back: { width: 44, height: 44, justifyContent: "center" },
  logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: 16, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "700", color: c.onSurface },
  sub: { fontSize: 15, color: c.muted, marginBottom: 16 },
  form: { gap: 16 },
  error: { color: c.error, fontSize: 14 },
  link: { alignItems: "center", paddingVertical: 16, minHeight: 44 },
  linkText: { fontSize: 14, color: c.muted },
  linkStrong: { color: c.brandPrimary, fontWeight: "600" },
}));
const useStyles = useAuthStyles;
