import Ionicons from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { Button, Field } from "@/src/components/ui";
import { useTheme } from "@/src/theme";
import { useAuthStyles } from "./login";

export default function ChangePassword() {
  const insets = useSafeAreaInsets();
  const styles = useAuthStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/account"));

  const submit = async () => {
    if (!current || !next) return setError("Preencha todos os campos");
    if (next.length < 6) return setError("A nova senha precisa ter pelo menos 6 caracteres");
    if (next !== confirm) return setError("A confirmação não confere");
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: current, new_password: next }) });
      toast("Senha alterada com sucesso!", "success");
      goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <Pressable testID="change-password-back-button" onPress={goBack} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Alterar senha</Text>
        <Text style={styles.sub}>A nova senha fica salva apenas no banco de dados, de forma criptografada.</Text>
        <View style={styles.form}>
          <Field testID="current-password-input" label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry />
          <Field testID="new-password-input" label="Nova senha" value={next} onChangeText={setNext} secureTextEntry placeholder="Mínimo 6 caracteres" />
          <Field testID="confirm-password-input" label="Confirmar nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry onSubmitEditing={submit} />
          {error ? <Text testID="change-password-error" style={styles.error}>{error}</Text> : null}
          <Button testID="change-password-submit-button" title="Salvar nova senha" onPress={submit} loading={loading} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
