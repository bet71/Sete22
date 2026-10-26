import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, fileUrl, Partner, Service, serviceLabel, SERVICES, whatsappServiceUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, EmptyState } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function Services() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [svc, setSvc] = useState<Service | null>(null);
  const [q, setQ] = useState("");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const params = new URLSearchParams();
  if (svc) params.set("service", svc);
  if (q.trim()) params.set("q", q.trim());
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["partners", svc, q.trim()],
    queryFn: () => apiFetch<Partner[]>(`/partners?${params.toString()}`),
  });

  const join = () => router.push(user ? "/partner-form" : "/login");

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Empresas parceiras</Text>
            <Text style={styles.sub}>Profissionais aprovados da sua região</Text>
          </View>
          <Pressable testID="join-partner-button" onPress={join} style={styles.joinBtn}>
            <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.joinText}>Cadastrar</Text>
          </Pressable>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="services-search-input" value={q} onChangeText={setQ} placeholder="Buscar profissional ou cidade" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chips}>
          {[{ key: null, label: "Todos", icon: "apps-outline" }, ...SERVICES].map((c) => {
            const active = svc === c.key;
            return (
              <Pressable key={c.label} testID={`service-chip-${c.key ?? "all"}`} onPress={() => setSvc(c.key as Service | null)} style={[styles.chip, active && styles.chipActive]}>
                <Ionicons name={c.icon as any} size={16} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {isLoading ? (
        <ActivityIndicator testID="services-loading" color={colors.brandPrimary} style={{ marginTop: 48 }} />
      ) : isError ? (
        <EmptyState icon="cloud-offline-outline" title="Não foi possível carregar">
          <Button testID="services-retry-button" title="Tentar novamente" onPress={() => refetch()} />
        </EmptyState>
      ) : (
        <FlatList
          testID="partners-list"
          data={data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState icon="construct-outline" title="Nenhum profissional ainda" subtitle="Você presta serviços? Cadastre sua empresa e apareça aqui após aprovação.">
              <Button testID="empty-join-partner-button" title="Cadastrar meu serviço" onPress={join} />
            </EmptyState>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`partner-card-${item.id}`}>
              <View style={styles.cardTop}>
                {item.photo ? (
                  <Image source={{ uri: fileUrl(item.photo) }} style={styles.logo} contentFit="cover" />
                ) : (
                  <View style={[styles.logo, styles.logoFallback]}>
                    <Ionicons name={(SERVICES.find((s) => s.key === item.service)?.icon ?? "construct-outline") as any} size={26} color={colors.brandPrimary} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.business_name}</Text>
                  <View style={styles.tag}><Text style={styles.tagText}>{serviceLabel(item.service)}</Text></View>
                  <View style={styles.row}>
                    <Ionicons name="location-outline" size={12} color={colors.muted} />
                    <Text style={styles.meta}>{item.city}/{item.state}</Text>
                  </View>
                </View>
                <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              </View>
              <Text style={styles.desc} numberOfLines={4}>{item.description}</Text>
              <Button testID={`partner-whatsapp-${item.id}`} variant="whatsapp" icon="logo-whatsapp" title="Chamar no WhatsApp" onPress={() => Linking.openURL(whatsappServiceUrl(item.whatsapp, item.business_name))} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  h1: { fontSize: 22, fontWeight: "700", color: c.onSurface },
  sub: { fontSize: 13, color: c.muted },
  joinBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: c.brandPrimary },
  joinText: { fontSize: 14, fontWeight: "600", color: c.onBrandPrimary },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceTertiary, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: c.onSurface, height: 44 },
  chipsRow: { height: 56, flexGrow: 0, marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16, alignItems: "center" },
  chip: { flexShrink: 0, height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.surfaceTertiary },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { fontSize: 14, fontWeight: "500", color: c.onSurfaceTertiary },
  chipTextActive: { color: c.onBrandPrimary },
  list: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 16, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, gap: 12 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  logo: { width: 56, height: 56, borderRadius: 12, backgroundColor: c.surfaceTertiary },
  logoFallback: { backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "600", color: c.onSurface },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.brandTertiary },
  tagText: { fontSize: 12, fontWeight: "600", color: c.onBrandTertiary },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 12, color: c.muted },
  desc: { fontSize: 14, lineHeight: 20, color: c.onSurfaceTertiary },
}));
