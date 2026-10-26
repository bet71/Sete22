import Ionicons from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, Field } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import { useAuthStyles } from "./login";

export default function Register() {
  const insets = useSafeAreaInsets();
  const styles = useAuthStyles();
  const { colors } = useTheme();
  const { register } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", password: "", city: "", state: "", whatsapp: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (Object.values(f).some((v) => !v.trim())) return setError("Preencha todos os campos");
    if (f.password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres");
    if (f.whatsapp.replace(/\D/g, "").length < 10) return setError("WhatsApp inválido (inclua o DDD)");
    setError("");
    setLoading(true);
    try {
      await register(f);
      toast("Conta criada com sucesso!", "success");
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable testID="register-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.sub}>Cadastre-se grátis e comece a vender hoje mesmo.</Text>
        <View style={styles.form}>
          <Field testID="register-name-input" label="Nome completo" value={f.name} onChangeText={set("name")} placeholder="Seu nome" />
          <Field testID="register-email-input" label="E-mail" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" placeholder="seu@email.com" />
          <Field testID="register-password-input" label="Senha" value={f.password} onChangeText={set("password")} secureTextEntry placeholder="Mínimo 6 caracteres" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 2 }}><Field testID="register-city-input" label="Cidade" value={f.city} onChangeText={set("city")} placeholder="Ex: Campinas" /></View>
            <View style={{ flex: 1 }}><Field testID="register-state-input" label="UF" value={f.state} onChangeText={(v) => set("state")(v.toUpperCase())} maxLength={2} autoCapitalize="characters" placeholder="SP" /></View>
          </View>
          <Field testID="register-whatsapp-input" label="WhatsApp (com DDD)" value={f.whatsapp} onChangeText={set("whatsapp")} keyboardType="phone-pad" placeholder="(11) 99999-9999" />
          {error ? <Text testID="register-error" style={styles.error}>{error}</Text> : null}
          <Button testID="register-submit-button" title="Criar conta" onPress={submit} loading={loading} />
        </View>
        <Pressable testID="go-to-login-link" onPress={() => router.replace("/login")} style={styles.link}>
          <Text style={styles.linkText}>Já tem conta? <Text style={styles.linkStrong}>Entrar</Text></Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}
