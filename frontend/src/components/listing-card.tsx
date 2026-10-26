import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { fileUrl, formatPrice, Listing } from "@/src/api";
import { makeStyles, useTheme } from "@/src/theme";

export function ListingCard({ item }: { item: Listing }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`listing-card-${item.id}`}
      onPress={() => router.push(`/listing/${item.id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
    >
      <View>
        <Image source={{ uri: fileUrl(item.photos[0]) }} style={styles.img} contentFit="cover" transition={200} />
        <View style={[styles.badge, item.condition === "novo" ? styles.badgeNew : null]}>
          <Text style={[styles.badgeText, item.condition === "novo" ? styles.badgeNewText : null]}>{item.condition === "novo" ? "Novo" : "Usado"}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.price} numberOfLines={1}>{formatPrice(item.price)}</Text>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={12} color={colors.muted} />
          <Text style={styles.meta} numberOfLines={1}>{item.city}/{item.state}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={12} color={colors.muted} />
          <Text style={styles.meta} numberOfLines={1}>{item.owner_name}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: c.border },
  img: { width: "100%", aspectRatio: 1, backgroundColor: c.surfaceTertiary },
  badge: { position: "absolute", top: 8, left: 8, backgroundColor: c.surfaceSecondary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeNew: { backgroundColor: c.brandPrimary },
  badgeText: { fontSize: 11, fontWeight: "600", color: c.onSurface },
  badgeNewText: { color: c.onBrandPrimary },
  body: { padding: 12, gap: 4 },
  price: { fontSize: 16, fontWeight: "700", color: c.brandPrimary },
  title: { fontSize: 14, color: c.onSurface, minHeight: 36 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 12, color: c.muted, flex: 1 },
}));
