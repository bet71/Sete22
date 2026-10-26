import Ionicons from "@react-native-vector-icons/ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API, apiFetch, Category, CATEGORIES, fileUrl, formatPrice, getToken } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, EmptyState, Field } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";
import { uploadForm } from "@/src/utils/upload";

type Price = { min: number; max: number; suggested: number; reasoning: string };

export default function Sell() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const empty = { title: "", description: "", price: "", city: "", state: "", whatsapp: "" };
  const [f, setF] = useState(empty);
  const [photos, setPhotos] = useState<string[]>([]);
  const [condition, setCondition] = useState<"novo" | "usado">("usado");
  const [category, setCategory] = useState<Category | null>(null);
  const [delivers, setDelivers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<"gen" | "price" | null>(null);
  const [price, setPrice] = useState<Price | null>(null);
  const [permBlocked, setPermBlocked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof empty) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (user) setF((p) => ({ ...p, city: p.city || user.city, state: p.state || user.state, whatsapp: p.whatsapp || user.whatsapp }));
  }, [user]);

  if (!user)
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: "center" }]}>
        <EmptyState icon="pricetag-outline" title="Entre para anunciar" subtitle="Faça login ou crie sua conta grátis para publicar anúncios.">
          <View style={{ width: "100%", gap: 12 }}>
            <Button testID="sell-login-button" title="Entrar" onPress={() => router.push("/login")} />
            <Button testID="sell-register-button" title="Criar conta" variant="secondary" onPress={() => router.push("/register")} />
          </View>
        </EmptyState>
      </View>
    );

  const pickPhotos = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain && perm.status === "denied") return setPermBlocked(true);
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!req.granted) return setPermBlocked(!req.canAskAgain);
    }
    setPermBlocked(false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 5 - photos.length, quality: 0.6 });
    if (res.canceled) return;
    setUploading(true);
    try {
      const token = await getToken();
      for (const a of res.assets.slice(0, 5 - photos.length)) {
        const r = await uploadForm(`${API}/upload`, { headers: { Authorization: `Bearer ${token}` }, files: { file: { uri: a.uri, name: a.fileName ?? "foto.jpg", mimeType: a.mimeType ?? "image/jpeg" } } });
        if (!r.ok) throw new Error(r.status === 402 ? "Sem créditos de armazenamento" : "Falha ao enviar foto");
        const { path } = await r.json();
        setPhotos((p) => [...p, path]);
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    const hint = [f.title, f.description].filter(Boolean).join(". ");
    if (hint.length < 2) return toast("Escreva ao menos o nome do produto no título", "info");
    setAiLoading("gen");
    try {
      const r = await apiFetch<{ title: string; description: string }>("/ai/generate", { method: "POST", body: JSON.stringify({ hint, category, condition }) });
      setF((p) => ({ ...p, title: r.title, description: r.description }));
      toast("Título e descrição gerados pela IA", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setAiLoading(null);
    }
  };

  const suggestPrice = async () => {
    if (f.title.length < 2) return toast("Preencha o título primeiro", "info");
    setAiLoading("price");
    try {
      setPrice(await apiFetch<Price>("/ai/price", { method: "POST", body: JSON.stringify({ title: f.title, description: f.description, category, condition, city: f.city }) }));
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setAiLoading(null);
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    const priceNum = parseFloat(f.price.replace(/\./g, "").replace(",", "."));
    if (!photos.length) e.photos = "Adicione pelo menos 1 foto";
    if (f.title.trim().length < 3) e.title = "Título muito curto";
    if (f.description.trim().length < 5) e.description = "Descreva o produto";
    if (!priceNum || priceNum <= 0) e.price = "Informe um valor válido";
    if (!category) e.category = "Escolha uma categoria";
    if (f.city.trim().length < 2) e.city = "Informe a cidade";
    if (f.state.trim().length < 2) e.state = "UF";
    if (f.whatsapp.replace(/\D/g, "").length < 10) e.whatsapp = "WhatsApp inválido (inclua o DDD)";
    setErrors(e);
    if (Object.keys(e).length) return toast("Verifique os campos destacados", "error");
    setSaving(true);
    try {
      const l = await apiFetch("/listings", { method: "POST", body: JSON.stringify({ ...f, price: priceNum, condition, category, delivers, photos }) });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      setF({ ...empty, city: user.city, state: user.state, whatsapp: user.whatsapp });
      setPhotos([]);
      setCategory(null);
      setPrice(null);
      toast("Anúncio publicado!", "success");
      router.push(`/listing/${l.id}`);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.h1}>Novo anúncio</Text>
      </View>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + 24 }]}>
        <Text style={styles.label}>Fotos ({photos.length}/5)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.length < 5 && (
            <Pressable testID="add-photo-button" onPress={pickPhotos} style={[styles.photo, styles.addPhoto, errors.photos ? { borderColor: colors.error } : null]} disabled={uploading}>
              {uploading ? <ActivityIndicator color={colors.brandPrimary} /> : <><Ionicons name="camera-outline" size={26} color={colors.brandPrimary} /><Text style={styles.addText}>Adicionar</Text></>}
            </Pressable>
          )}
          {photos.map((p, i) => (
            <View key={p}>
              <Image source={{ uri: fileUrl(p) }} style={styles.photo} contentFit="cover" />
              <Pressable testID={`remove-photo-${i}`} onPress={() => setPhotos((x) => x.filter((y) => y !== p))} style={styles.removePhoto} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.onSurfaceInverse} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
        {errors.photos ? <Text style={styles.err}>{errors.photos}</Text> : null}
        {permBlocked && (
          <View style={styles.permBox} testID="photo-permission-blocked">
            <Text style={styles.permText}>Permita o acesso às fotos para adicionar imagens ao anúncio.</Text>
            <Button testID="open-settings-button" title="Abrir Ajustes" variant="secondary" onPress={() => Linking.openSettings()} />
          </View>
        )}

        <Field testID="listing-title-input" label="Título" value={f.title} onChangeText={set("title")} placeholder="Ex: iPhone 13 128GB" error={errors.title} />
        <Field testID="listing-description-input" label="Descrição" value={f.description} onChangeText={set("description")} placeholder="Detalhes, estado de conservação, tempo de uso..." multiline error={errors.description} />
        <Button testID="ai-generate-button" variant="secondary" icon="sparkles" title="Melhorar título e descrição com IA" onPress={generate} loading={aiLoading === "gen"} />

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.key} testID={`sell-category-${c.key}`} onPress={() => setCategory(c.key)} style={[styles.catBtn, category === c.key && styles.catActive]}>
              <Ionicons name={c.icon as any} size={18} color={category === c.key ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
              <Text style={[styles.catText, category === c.key && styles.catTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
        {errors.category ? <Text style={styles.err}>{errors.category}</Text> : null}

        <Text style={styles.label}>Condição</Text>
        <View style={styles.segment}>
          {(["novo", "usado"] as const).map((c) => (
            <Pressable key={c} testID={`condition-${c}`} onPress={() => setCondition(c)} style={[styles.segBtn, condition === c && styles.segActive]}>
              <Text style={[styles.segText, condition === c && styles.segTextActive]}>{c === "novo" ? "Novo" : "Usado"}</Text>
            </Pressable>
          ))}
        </View>

        <Field testID="listing-price-input" label="Valor (R$)" value={f.price} onChangeText={set("price")} keyboardType="decimal-pad" placeholder="0,00" error={errors.price} />
        <Button testID="ai-price-button" variant="secondary" icon="analytics-outline" title="Sugerir preço justo com IA" onPress={suggestPrice} loading={aiLoading === "price"} />
        {price && (
          <View style={styles.priceBox} testID="ai-price-result">
            <Text style={styles.priceTitle}>Sugestão: {formatPrice(price.suggested)}</Text>
            <Text style={styles.priceRange}>Faixa de mercado: {formatPrice(price.min)} – {formatPrice(price.max)}</Text>
            <Text style={styles.priceReason}>{price.reasoning}</Text>
            <Button testID="ai-price-apply-button" title="Usar este valor" onPress={() => setF((p) => ({ ...p, price: price.suggested.toFixed(2).replace(".", ",") }))} />
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 2 }}><Field testID="listing-city-input" label="Cidade" value={f.city} onChangeText={set("city")} placeholder="Sua cidade" error={errors.city} /></View>
          <View style={{ flex: 1 }}><Field testID="listing-state-input" label="UF" value={f.state} onChangeText={(v) => set("state")(v.toUpperCase())} maxLength={2} autoCapitalize="characters" placeholder="SP" error={errors.state} /></View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Faz entrega?</Text>
            <Text style={styles.hint}>{delivers ? "Sim, eu entrego" : "Não, retirada no local"}</Text>
          </View>
          <Switch testID="listing-delivers-switch" value={delivers} onValueChange={setDelivers} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor={colors.surfaceSecondary} />
        </View>

        <Field testID="listing-whatsapp-input" label="WhatsApp para contato" value={f.whatsapp} onChangeText={set("whatsapp")} keyboardType="phone-pad" placeholder="(11) 99999-9999" error={errors.whatsapp} />

        <Button testID="publish-listing-button" title={saving ? "Publicando..." : "Publicar anúncio"} onPress={submit} loading={saving} disabled={uploading} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  h1: { fontSize: 24, fontWeight: "700", color: c.onSurface },
  content: { padding: 16, gap: 16 },
  label: { fontSize: 14, fontWeight: "500", color: c.onSurface },
  hint: { fontSize: 13, color: c.muted },
  err: { color: c.error, fontSize: 12, marginTop: -8 },
  photo: { width: 96, height: 96, borderRadius: 12, backgroundColor: c.surfaceTertiary },
  addPhoto: { borderWidth: 1.5, borderStyle: "dashed", borderColor: c.borderStrong, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: c.brandTertiary },
  addText: { fontSize: 12, color: c.brandPrimary, fontWeight: "500" },
  removePhoto: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: c.scrim, alignItems: "center", justifyContent: "center" },
  permBox: { padding: 12, borderRadius: 12, backgroundColor: c.surfaceTertiary, gap: 8 },
  permText: { fontSize: 13, color: c.onSurfaceTertiary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: { width: "48%", flexGrow: 1, height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  catActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  catText: { fontSize: 14, fontWeight: "500", color: c.onSurfaceTertiary },
  catTextActive: { color: c.onBrandPrimary },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: c.surfaceSecondary },
  segText: { fontSize: 14, fontWeight: "500", color: c.muted },
  segTextActive: { color: c.brandPrimary },
  priceBox: { padding: 16, borderRadius: 12, backgroundColor: c.brandTertiary, gap: 8 },
  priceTitle: { fontSize: 18, fontWeight: "700", color: c.onBrandTertiary },
  priceRange: { fontSize: 14, color: c.onBrandTertiary },
  priceReason: { fontSize: 13, color: c.onSurfaceTertiary, marginBottom: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
}));
