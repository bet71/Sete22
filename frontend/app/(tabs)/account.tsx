import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, fileUrl, formatPrice, Listing } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useConfirm } from "@/src/components/confirm";
import { useToast } from "@/src/components/toast";
import { Button, EmptyState } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function Account() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: () => apiFetch<Listing[]>("/my/listings"),
    enabled: !!user,
  });

  if (!user)
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: "center" }]}>
        <EmptyState icon="person-circle-outline" title="Sua conta" subtitle="Entre para ver e gerenciar seus anúncios.">
          <View style={{ width: "100%", gap: 12 }}>
            <Button testID="account-login-button" title="Entrar" onPress={() => router.push("/login")} />
            <Button testID="account-register-button" title="Criar conta" variant="secondary" onPress={() => router.push("/register")} />
          </View>
        </EmptyState>
      </View>
    );

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Remover anúncio?", message: "Esta ação não pode ser desfeita." }))) return;
    try {
      await apiFetch(`/listings/${id}`, { method: "DELETE" });
      toast("Anúncio removido", "success");
      refetch();
      qc.invalidateQueries({ queryKey: ["listings"] });
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: bottomChrome + 24 }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
    >
      <View style={styles.profile} testID="account-profile-card">
        <View style={styles.avatar}><Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} testID="account-user-name">{user.name}</Text>
          <Text style={styles.meta}>{user.email}</Text>
          {user.city ? <Text style={styles.meta}>{user.city}/{user.state} · {user.whatsapp}</Text> : null}
        </View>
      </View>

      {user.role === "admin" && (
        <Button testID="open-admin-panel-button" icon="shield-checkmark-outline" title="Painel do administrador" onPress={() => router.push("/admin")} />
      )}

      <Text style={styles.section}>Meus anúncios</Text>
      {isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} />
      ) : !data?.length ? (
        <EmptyState icon="storefront-outline" title="Você ainda não tem anúncios">
          <Button testID="create-first-listing-button" title="Criar anúncio" onPress={() => router.push("/(tabs)/sell")} />
        </EmptyState>
      ) : (
        data.map((l) => (
          <Pressable key={l.id} testID={`my-listing-${l.id}`} onPress={() => router.push(`/listing/${l.id}`)} style={styles.row}>
            <Image source={{ uri: fileUrl(l.photos[0]) }} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{l.title}</Text>
              <Text style={styles.rowPrice}>{formatPrice(l.price)}</Text>
              <Text style={styles.meta}>{l.condition === "novo" ? "Novo" : "Usado"} · {l.delivers ? "Entrega" : "Retirada"}</Text>
            </View>
            <Pressable testID={`delete-my-listing-${l.id}`} onPress={() => remove(l.id)} style={styles.del} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </Pressable>
        ))
      )}

      <Button testID="change-password-button" title="Alterar senha" variant="secondary" icon="key-outline" onPress={() => router.push("/change-password")} />
      <Button testID="logout-button" title="Sair da conta" variant="secondary" icon="log-out-outline" onPress={async () => { await logout(); toast("Você saiu da conta"); }} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 16, gap: 16 },
  profile: { flexDirection: "row", gap: 16, alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "700", color: c.onBrandPrimary },
  name: { fontSize: 18, fontWeight: "600", color: c.onSurface },
  meta: { fontSize: 13, color: c.muted },
  section: { fontSize: 18, fontWeight: "600", color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: c.surfaceTertiary },
  rowTitle: { fontSize: 15, fontWeight: "500", color: c.onSurface },
  rowPrice: { fontSize: 15, fontWeight: "700", color: c.brandPrimary },
  del: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
}));
