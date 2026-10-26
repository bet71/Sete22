import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, categoryLabel, fileUrl, formatPrice, Listing, whatsappUrl } from "@/src/api";
import { Button, EmptyState } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const { data, isLoading, isError } = useQuery({ queryKey: ["listing", id], queryFn: () => apiFetch<Listing>(`/listings/${id}`) });
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (isLoading) return <View style={[styles.root, styles.center]}><ActivityIndicator color={colors.brandPrimary} /></View>;
  if (isError || !data)
    return (
      <View style={[styles.root, styles.center]}>
        <EmptyState icon="alert-circle-outline" title="Anúncio não encontrado" subtitle="Ele pode ter sido removido.">
          <Button testID="detail-back-home-button" title="Voltar" onPress={goBack} />
        </EmptyState>
      </View>
    );

  const imgW = Math.min(width, 700);
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / imgW))} testID="detail-photo-carousel">
            {data.photos.map((p) => (
              <Image key={p} source={{ uri: fileUrl(p) }} style={{ width: imgW, height: imgW * 0.85, backgroundColor: colors.surfaceTertiary }} contentFit="cover" transition={200} />
            ))}
          </ScrollView>
          <LinearGradient colors={["transparent", colors.scrim]} style={styles.scrim} pointerEvents="none" />
          <View style={styles.dots} pointerEvents="none">
            {data.photos.map((p, i) => <View key={p} style={[styles.dot, i === page && styles.dotActive]} />)}
          </View>
          <Pressable testID="detail-back-button" onPress={goBack} style={[styles.backBtn, { top: insets.top + 8 }]}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <View style={styles.tags}>
            <View style={styles.tag}><Text style={styles.tagText}>{categoryLabel(data.category)}</Text></View>
            <View style={[styles.tag, data.condition === "novo" && styles.tagBrand]}>
              <Text style={[styles.tagText, data.condition === "novo" && styles.tagBrandText]} testID="detail-condition">{data.condition === "novo" ? "Novo" : "Usado"}</Text>
            </View>
          </View>
          <Text style={styles.title} testID="detail-title">{data.title}</Text>
          <Text style={styles.price} testID="detail-price">{formatPrice(data.price)}</Text>

          <View style={styles.card} testID="detail-seller-card">
            <View style={styles.avatar}><Text style={styles.avatarText}>{data.owner_name.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Vendedor</Text>
              <Text style={styles.seller} testID="detail-seller-name">{data.owner_name}</Text>
              <Text style={styles.meta}>{data.city}/{data.state}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Info icon="location-outline" label="Localização" value={`${data.city} - ${data.state}`} testID="detail-location" />
            <Info icon="car-outline" label="Entrega" value={data.delivers ? "Faz entrega" : "Não entrega"} testID="detail-delivery" />
          </View>

          <Text style={styles.section}>Descrição</Text>
          <Text style={styles.desc} testID="detail-description">{data.description}</Text>
        </View>
      </ScrollView>
      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="whatsapp-contact-button" variant="whatsapp" icon="logo-whatsapp" title="Chamar no WhatsApp" onPress={() => Linking.openURL(whatsappUrl(data.whatsapp, data.title))} />
      </View>
    </View>
  );

  function Info({ icon, label, value, testID }: { icon: string; label: string; value: string; testID: string }) {
    return (
      <View style={styles.info}>
        <Ionicons name={icon as any} size={20} color={colors.brandPrimary} />
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.infoValue} testID={testID}>{value}</Text>
      </View>
    );
  }
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  center: { justifyContent: "center", alignItems: "center" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 80 },
  dots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.onSurfaceInverse, opacity: 0.5 },
  dotActive: { opacity: 1, width: 18 },
  backBtn: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 12 },
  tags: { flexDirection: "row", gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: c.surfaceTertiary },
  tagText: { fontSize: 12, fontWeight: "600", color: c.onSurfaceTertiary },
  tagBrand: { backgroundColor: c.brandPrimary },
  tagBrandText: { color: c.onBrandPrimary },
  title: { fontSize: 22, fontWeight: "600", color: c.onSurface },
  price: { fontSize: 28, fontWeight: "700", color: c.brandPrimary },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700", color: c.onBrandSecondary },
  cardLabel: { fontSize: 12, color: c.muted },
  seller: { fontSize: 16, fontWeight: "600", color: c.onSurface },
  meta: { fontSize: 13, color: c.muted },
  infoRow: { flexDirection: "row", gap: 12 },
  info: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: c.brandTertiary, gap: 4 },
  infoValue: { fontSize: 14, fontWeight: "600", color: c.onBrandTertiary },
  section: { fontSize: 18, fontWeight: "600", color: c.onSurface, marginTop: 8 },
  desc: { fontSize: 15, lineHeight: 22, color: c.onSurfaceTertiary },
  cta: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surfaceSecondary, borderTopWidth: 1, borderTopColor: c.border },
}));
