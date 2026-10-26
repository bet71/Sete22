import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, Category, CATEGORIES, Listing } from "@/src/api";
import { ListingCard } from "@/src/components/listing-card";
import { Button, EmptyState } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function Home() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [cat, setCat] = useState<Category | null>(null);
  const [q, setQ] = useState("");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const params = new URLSearchParams();
  if (cat) params.set("category", cat);
  if (q.trim()) params.set("q", q.trim());
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["listings", cat, q.trim()],
    queryFn: () => apiFetch<Listing[]>(`/listings?${params.toString()}`),
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.brand}>MercadoLocal</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="search-input" value={q} onChangeText={setQ} placeholder="Buscar produtos ou cidade" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chips}>
          {[{ key: null, label: "Todos", icon: "apps-outline" }, ...CATEGORIES].map((c) => {
            const active = cat === c.key;
            return (
              <Pressable key={c.label} testID={`category-chip-${c.key ?? "all"}`} onPress={() => setCat(c.key as Category | null)} style={[styles.chip, active && styles.chipActive]}>
                <Ionicons name={c.icon as any} size={16} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {isLoading ? (
        <ActivityIndicator testID="feed-loading" color={colors.brandPrimary} style={{ marginTop: 48 }} />
      ) : isError ? (
        <EmptyState icon="cloud-offline-outline" title="Não foi possível carregar">
          <Button testID="feed-retry-button" title="Tentar novamente" onPress={() => refetch()} />
        </EmptyState>
      ) : (
        <FlatList
          testID="listings-feed"
          data={data}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => <View style={{ flex: 1 / 2 }}><ListingCard item={item} /></View>}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="Nenhum anúncio encontrado" subtitle="Seja o primeiro a anunciar nesta categoria!" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, gap: 12 },
  brand: { fontSize: 24, fontWeight: "700", color: c.brandPrimary, letterSpacing: -0.5 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceTertiary, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: c.onSurface, height: 44 },
  chipsRow: { height: 56, flexGrow: 0, marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16, alignItems: "center" },
  chip: { flexShrink: 0, height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.surfaceTertiary },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { fontSize: 14, fontWeight: "500", color: c.onSurfaceTertiary },
  chipTextActive: { color: c.onBrandPrimary },
  list: { padding: 16, gap: 12 },
}));
