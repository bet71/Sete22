import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, categoryLabel, CATEGORIES, fileUrl, formatPrice, Listing, Partner, serviceLabel, User } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useConfirm } from "@/src/components/confirm";
import { useToast } from "@/src/components/toast";
import { Button, EmptyState } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

type Stats = { users: number; listings: number; partners_pending: number; partners_approved: number; by_category: Record<string, number>; total_value: number };
type Tab = "partners" | "listings" | "users";
const TAB_LABEL: Record<Tab, string> = { partners: "Parceiros", listings: "Anúncios", users: "Usuários" };

export default function Admin() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("partners");
  const isAdmin = user?.role === "admin";
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => apiFetch<Stats>("/admin/stats"), enabled: isAdmin });
  const partners = useQuery({ queryKey: ["admin-partners"], queryFn: () => apiFetch<Partner[]>("/admin/partners"), enabled: isAdmin });
  const listings = useQuery({ queryKey: ["admin-listings"], queryFn: () => apiFetch<Listing[]>("/admin/listings"), enabled: isAdmin });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => apiFetch<User[]>("/admin/users"), enabled: isAdmin });
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (!isAdmin)
    return (
      <View style={[styles.root, { justifyContent: "center", paddingTop: insets.top }]}>
        <EmptyState icon="lock-closed-outline" title="Acesso restrito" subtitle="Entre com a conta de administrador.">
          <View style={{ width: "100%", gap: 12 }}>
            <Button testID="admin-login-button" title="Entrar como admin" onPress={() => router.push("/login")} />
            <Button testID="admin-back-button-locked" title="Voltar" variant="secondary" onPress={goBack} />
          </View>
        </EmptyState>
      </View>
    );

  const refresh = () => { stats.refetch(); listings.refetch(); users.refetch(); partners.refetch(); qc.invalidateQueries({ queryKey: ["listings"] }); qc.invalidateQueries({ queryKey: ["partners"] }); };

  const setPartnerStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      await apiFetch(`/admin/partners/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      toast(status === "approved" ? "Parceiro aprovado" : "Parceiro recusado", "success");
      refresh();
    } catch (e: any) { toast(e.message, "error"); }
  };
  const removePartner = async (id: string) => {
    if (!(await confirm({ title: "Excluir parceiro?", message: "O cadastro será apagado definitivamente." }))) return;
    try {
      await apiFetch(`/admin/partners/${id}`, { method: "DELETE" });
      toast("Parceiro excluído", "success");
      refresh();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const removeListing = async (id: string) => {
    if (!(await confirm({ title: "Remover anúncio?", message: "O vendedor será avisado e o anúncio sairá do app." }))) return;
    try {
      await apiFetch(`/listings/${id}`, { method: "DELETE" });
      toast("Anúncio removido", "success");
      refresh();
    } catch (e: any) { toast(e.message, "error"); }
  };
  const removeUser = async (id: string) => {
    if (!(await confirm({ title: "Remover usuário?", message: "O usuário e TODOS os anúncios dele serão apagados." }))) return;
    try {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
      toast("Usuário e seus anúncios removidos", "success");
      refresh();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const s = stats.data;
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="admin-back-button" onPress={goBack} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.h1}>Painel Admin</Text>
        <Pressable testID="admin-logout-button" onPress={async () => { await logout(); router.replace("/(tabs)"); }} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={refresh} tintColor={colors.brandPrimary} />}>
        <View style={styles.statsRow}>
          <Stat label="Usuários" value={s ? String(s.users) : "–"} icon="people-outline" testID="admin-stat-users" />
          <Stat label="Anúncios" value={s ? String(s.listings) : "–"} icon="pricetags-outline" testID="admin-stat-listings" />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Parceiros pendentes" value={s ? String(s.partners_pending) : "–"} icon="time-outline" testID="admin-stat-partners-pending" />
          <Stat label="Parceiros aprovados" value={s ? String(s.partners_approved) : "–"} icon="shield-checkmark-outline" testID="admin-stat-partners-approved" />
        </View>
        <View style={styles.statWide} testID="admin-stat-total-value">
          <Text style={styles.wideLabel}>Valor total anunciado</Text>
          <Text style={styles.wideBig}>{s ? formatPrice(s.total_value) : "–"}</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <View key={c.key} style={styles.catStat}>
                <Text style={styles.catNum}>{s?.by_category[c.key] ?? 0}</Text>
                <Text style={styles.catLbl}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.segment}>
          {(["partners", "listings", "users"] as const).map((t) => (
            <Pressable key={t} testID={`admin-tab-${t}`} onPress={() => setTab(t)} style={[styles.segBtn, tab === t && styles.segActive]}>
              <Text style={[styles.segText, tab === t && styles.segTextActive]}>{TAB_LABEL[t]}{t === "partners" && s?.partners_pending ? ` (${s.partners_pending})` : ""}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "partners" ? (
          partners.isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : !partners.data?.length ? (
            <EmptyState icon="construct-outline" title="Nenhum cadastro de parceiro" />
          ) : partners.data.map((p) => (
            <View key={p.id} style={styles.card} testID={`admin-partner-${p.id}`}>
              <View style={styles.cardTop}>
                {p.photo ? <Image source={{ uri: fileUrl(p.photo) }} style={styles.thumb} contentFit="cover" /> : (
                  <View style={[styles.thumb, styles.thumbFallback]}><Ionicons name="construct-outline" size={26} color={colors.brandPrimary} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{p.business_name}</Text>
                  <Text style={styles.meta}>{serviceLabel(p.service)} · {p.city}/{p.state}</Text>
                  <Text style={styles.meta}>Responsável: <Text style={styles.strong}>{p.owner_name}</Text> · {p.whatsapp}</Text>
                  <View style={[styles.badge, p.status === "approved" ? styles.bApproved : p.status === "rejected" ? styles.bRejected : styles.bPending]}>
                    <Text style={styles.badgeText} testID={`admin-partner-status-${p.id}`}>{p.status === "approved" ? "Aprovado" : p.status === "rejected" ? "Recusado" : "Pendente"}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.desc} numberOfLines={4}>{p.description}</Text>
              <View style={styles.actions}>
                {p.status !== "approved" && (
                  <View style={{ flex: 1 }}><Button testID={`admin-approve-partner-${p.id}`} title="Aprovar" icon="checkmark" onPress={() => setPartnerStatus(p.id, "approved")} /></View>
                )}
                {p.status !== "rejected" && (
                  <View style={{ flex: 1 }}><Button testID={`admin-reject-partner-${p.id}`} title="Recusar" variant="secondary" icon="close" onPress={() => setPartnerStatus(p.id, "rejected")} /></View>
                )}
                <Pressable testID={`admin-delete-partner-${p.id}`} onPress={() => removePartner(p.id)} style={styles.iconBtn} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            </View>
          ))
        ) : tab === "listings" ? (
          listings.isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : !listings.data?.length ? (
            <EmptyState icon="pricetags-outline" title="Nenhum anúncio" />
          ) : listings.data.map((l) => (
            <View key={l.id} style={styles.card} testID={`admin-listing-${l.id}`}>
              <Pressable onPress={() => router.push(`/listing/${l.id}`)} style={styles.cardTop}>
                <Image source={{ uri: fileUrl(l.photos[0]) }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{l.title}</Text>
                  <Text style={styles.price}>{formatPrice(l.price)}</Text>
                  <Text style={styles.meta}>Vendedor: <Text style={styles.strong}>{l.owner_name}</Text></Text>
                  <Text style={styles.meta}>{categoryLabel(l.category)} · {l.condition === "novo" ? "Novo" : "Usado"} · {l.city}/{l.state}</Text>
                </View>
              </Pressable>
              <Button testID={`admin-remove-listing-${l.id}`} title="Remover anúncio" variant="danger" icon="trash-outline" onPress={() => removeListing(l.id)} />
            </View>
          ))
        ) : users.isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : (
          users.data?.map((u) => (
            <View key={u.id} style={styles.card} testID={`admin-user-${u.id}`}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{u.name.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{u.name} {u.role === "admin" ? "(admin)" : ""}</Text>
                  <Text style={styles.meta}>{u.email}</Text>
                  {u.city ? <Text style={styles.meta}>{u.city}/{u.state} · {u.whatsapp}</Text> : null}
                  <Text style={styles.meta}>{u.listings_count ?? 0} anúncio(s)</Text>
                </View>
                {u.role !== "admin" && (
                  <Pressable testID={`admin-remove-user-${u.id}`} onPress={() => removeUser(u.id)} style={styles.iconBtn} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  function Stat({ label, value, icon, testID }: { label: string; value: string; icon: string; testID: string }) {
    return (
      <View style={styles.stat} testID={testID}>
        <Ionicons name={icon as any} size={22} color={colors.brandPrimary} />
        <Text style={styles.statBig}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    );
  }
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  h1: { flex: 1, fontSize: 20, fontWeight: "700", color: c.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, padding: 16, borderRadius: 20, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, gap: 4 },
  statWide: { padding: 16, borderRadius: 20, backgroundColor: c.brandPrimary, gap: 4 },
  statBig: { fontSize: 24, fontWeight: "700", color: c.onSurface },
  statLabel: { fontSize: 13, color: c.muted },
  wideLabel: { fontSize: 13, color: c.onBrandPrimary, opacity: 0.85 },
  wideBig: { fontSize: 24, fontWeight: "700", color: c.onBrandPrimary },
  catLbl: { fontSize: 10, color: c.onBrandPrimary, opacity: 0.85, textAlign: "center" },
  catRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, rowGap: 12 },
  catStat: { width: "20%", alignItems: "center" },
  catNum: { fontSize: 18, fontWeight: "700", color: c.onBrandPrimary },
  thumbFallback: { backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 4 },
  bPending: { backgroundColor: c.warning },
  bApproved: { backgroundColor: c.success },
  bRejected: { backgroundColor: c.error },
  badgeText: { fontSize: 11, fontWeight: "700", color: c.onSuccess },
  desc: { fontSize: 13, lineHeight: 19, color: c.onSurfaceTertiary },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 4, marginTop: 4 },
  segBtn: { flex: 1, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: c.surfaceSecondary },
  segText: { fontSize: 14, fontWeight: "500", color: c.muted },
  segTextActive: { color: c.brandPrimary },
  card: { padding: 12, borderRadius: 12, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, gap: 12 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: c.surfaceTertiary },
  title: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  price: { fontSize: 15, fontWeight: "700", color: c.brandPrimary },
  meta: { fontSize: 12, color: c.muted },
  strong: { color: c.onSurface, fontWeight: "600" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: c.onBrandSecondary },
}));
