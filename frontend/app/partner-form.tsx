import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API, apiFetch, fileUrl, getToken, Partner, Service, SERVICES } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, EmptyState, Field } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";
import { uploadForm } from "@/src/utils/upload";

export default function PartnerForm() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ business_name: "", description: "", city: "", state: "", whatsapp: "" });
  const [service, setService] = useState<Service | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permBlocked, setPermBlocked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/services"));

  const existing = useQuery({ queryKey: ["my-partner", user?.id], queryFn: () => apiFetch<Partner | null>("/my/partner"), enabled: !!user });

  useEffect(() => {
    const p = existing.data;
    if (p) {
      setF({ business_name: p.business_name, description: p.description, city: p.city, state: p.state, whatsapp: p.whatsapp });
      setService(p.service);
      setPhoto(p.photo ?? null);
    } else if (user && existing.isFetched) {
      setF((x) => ({ ...x, business_name: x.business_name || user.name, city: x.city || user.city, state: x.state || user.state, whatsapp: x.whatsapp || user.whatsapp }));
    }
  }, [existing.data, existing.isFetched, user]);

  if (!user)
    return (
      <View style={[styles.root, { justifyContent: "center", paddingTop: insets.top }]}>
        <EmptyState icon="construct-outline" title="Entre para cadastrar seu serviço">
          <Button testID="partner-login-button" title="Entrar" onPress={() => router.replace("/login")} />
        </EmptyState>
      </View>
    );

  const pickPhoto = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain && perm.status === "denied") return setPermBlocked(true);
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!req.granted) return setPermBlocked(!req.canAskAgain);
    }
    setPermBlocked(false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled) return;
    setUploading(true);
    try {
      const a = res.assets[0];
      const token = await getToken();
      const r = await uploadForm(`${API}/upload`, { headers: { Authorization: `Bearer ${token}` }, files: { file: { uri: a.uri, name: a.fileName ?? "logo.jpg", mimeType: a.mimeType ?? "image/jpeg" } } });
      if (!r.ok) throw new Error("Falha ao enviar foto");
      setPhoto((await r.json()).path);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (f.business_name.trim().length < 2) e.business_name = "Informe o nome";
    if (!service) e.service = "Escolha o tipo de serviço";
    if (f.description.trim().length < 10) e.description = "Descreva seus serviços (mín. 10 letras)";
    if (f.city.trim().length < 2) e.city = "Informe a cidade";
    if (f.state.trim().length < 2) e.state = "UF";
    if (f.whatsapp.replace(/\D/g, "").length < 10) e.whatsapp = "WhatsApp inválido (inclua o DDD)";
    setErrors(e);
    if (Object.keys(e).length) return toast("Verifique os campos destacados", "error");
    setSaving(true);
    try {
      await apiFetch("/my/partner", { method: "POST", body: JSON.stringify({ ...f, service, photo }) });
      qc.invalidateQueries({ queryKey: ["my-partner"] });
      toast("Cadastro enviado! Aguarde a aprovação do administrador.", "success");
      goBack();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const status = existing.data?.status;
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="partner-form-back-button" onPress={goBack} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.h1}>{existing.data ? "Meu cadastro de serviço" : "Cadastrar meu serviço"}</Text>
      </View>
      {existing.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 48 }} />
      ) : (
        <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          {status ? (
            <View style={[styles.status, status === "approved" ? styles.stApproved : status === "rejected" ? styles.stRejected : styles.stPending]} testID="partner-status-banner">
              <Text style={styles.statusText}>
                {status === "approved" ? "Aprovado — seu serviço aparece na aba Serviços." : status === "rejected" ? "Não aprovado — revise e envie novamente." : "Aguardando aprovação do administrador."}
              </Text>
              {status === "approved" ? <Text style={styles.statusHint}>Se você editar, o cadastro volta para análise.</Text> : null}
            </View>
          ) : (
            <Text style={styles.hint}>Seu cadastro será analisado pelo administrador antes de aparecer para os clientes.</Text>
          )}

          <View style={styles.photoRow}>
            <Pressable testID="partner-photo-button" onPress={pickPhoto} disabled={uploading} style={styles.photoBox}>
              {uploading ? <ActivityIndicator color={colors.brandPrimary} /> : photo ? <Image source={{ uri: fileUrl(photo) }} style={styles.photoImg} contentFit="cover" /> : <Ionicons name="camera-outline" size={26} color={colors.brandPrimary} />}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Foto ou logo (opcional)</Text>
              <Text style={styles.hint}>Toque para escolher uma imagem</Text>
            </View>
          </View>
          {permBlocked && (
            <View style={styles.permBox} testID="partner-photo-permission-blocked">
              <Text style={styles.hint}>Permita o acesso às fotos para adicionar sua logo.</Text>
              <Button testID="partner-open-settings-button" title="Abrir Ajustes" variant="secondary" onPress={() => Linking.openSettings()} />
            </View>
          )}

          <Field testID="partner-name-input" label="Nome da empresa ou profissional" value={f.business_name} onChangeText={set("business_name")} placeholder="Ex: João Elétrica" error={errors.business_name} />

          <Text style={styles.label}>O que você faz?</Text>
          <View style={styles.grid}>
            {SERVICES.map((s) => (
              <Pressable key={s.key} testID={`partner-service-${s.key}`} onPress={() => setService(s.key)} style={[styles.svcBtn, service === s.key && styles.svcActive]}>
                <Ionicons name={s.icon as any} size={18} color={service === s.key ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                <Text style={[styles.svcText, service === s.key && styles.svcTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          {errors.service ? <Text style={styles.err}>{errors.service}</Text> : null}

          <Field testID="partner-description-input" label="Descrição dos serviços" value={f.description} onChangeText={set("description")} multiline placeholder="Ex: Instalações elétricas, troca de disjuntores, atendimento 24h..." error={errors.description} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 2 }}><Field testID="partner-city-input" label="Cidade" value={f.city} onChangeText={set("city")} error={errors.city} /></View>
            <View style={{ flex: 1 }}><Field testID="partner-state-input" label="UF" value={f.state} onChangeText={(v) => set("state")(v.toUpperCase())} maxLength={2} autoCapitalize="characters" error={errors.state} /></View>
          </View>
          <Field testID="partner-whatsapp-input" label="WhatsApp para clientes" value={f.whatsapp} onChangeText={set("whatsapp")} keyboardType="phone-pad" placeholder="(11) 99999-9999" error={errors.whatsapp} />
          <Button testID="partner-submit-button" title={existing.data ? "Salvar e reenviar para aprovação" : "Enviar para aprovação"} onPress={submit} loading={saving} disabled={uploading} />
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  back: { width: 44, height: 44, justifyContent: "center" },
  h1: { flex: 1, fontSize: 18, fontWeight: "700", color: c.onSurface },
  content: { padding: 16, gap: 16 },
  label: { fontSize: 14, fontWeight: "500", color: c.onSurface },
  hint: { fontSize: 13, color: c.muted },
  err: { color: c.error, fontSize: 12, marginTop: -8 },
  status: { padding: 12, borderRadius: 12, gap: 2 },
  stPending: { backgroundColor: c.warning },
  stApproved: { backgroundColor: c.success },
  stRejected: { backgroundColor: c.error },
  statusText: { fontSize: 14, fontWeight: "600", color: c.onSuccess },
  statusHint: { fontSize: 12, color: c.onSuccess },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photoBox: { width: 80, height: 80, borderRadius: 16, overflow: "hidden", backgroundColor: c.brandTertiary, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  photoImg: { width: "100%", height: "100%" },
  permBox: { padding: 12, borderRadius: 12, backgroundColor: c.surfaceTertiary, gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  svcBtn: { width: "48%", flexGrow: 1, height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  svcActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  svcText: { fontSize: 14, fontWeight: "500", color: c.onSurfaceTertiary },
  svcTextActive: { color: c.onBrandPrimary },
}));
