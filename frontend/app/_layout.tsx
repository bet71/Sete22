import { QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { LogBox, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AuthProvider } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/toast";
import { Button } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { makeStyles } from "@/src/theme";
import { storage } from "@/src/utils/storage";

LogBox.ignoreAllLogs(true);

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

export default function RootLayout() {
  const router = useRouter();
  const [nudge, setNudge] = useState(false);
  const styles = useStyles();

  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (data: any) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      url.startsWith("http") ? Linking.openURL(url) : router.push(url);
    };
    const tapSub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    Notifications.getLastNotificationResponseAsync().then((r) => r && open(r.notification.request.content.data));
    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const last = await storage.getItem("pushNudgeAt", 0);
      if (last && Date.now() - Number(last) <= 7 * 24 * 60 * 60 * 1000) return;
      setNudge(true);
    })();
    return () => tapSub.remove();
  }, [router]);

  const closeNudge = async (openSettings: boolean) => {
    await storage.setItem("pushNudgeAt", Date.now());
    setNudge(false);
    if (openSettings) Linking.openSettings();
  };

  return (
    <GestureHandlerRootView style={rootStyles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <AuthProvider>
              <ToastProvider>
                <Stack screenOptions={{ headerShown: false }} />
                <Modal transparent visible={nudge} animationType="fade" onRequestClose={() => closeNudge(false)}>
                  <View style={styles.backdrop}>
                    <View style={styles.sheet} testID="push-nudge-dialog">
                      <Text style={styles.title}>Ative as notificações</Text>
                      <Text style={styles.sub}>Saiba na hora quando surgirem anúncios novos e novidades sobre os seus.</Text>
                      <Button testID="push-nudge-open-settings" title="Abrir Ajustes" onPress={() => closeNudge(true)} />
                      <Button testID="push-nudge-later" title="Agora não" variant="secondary" onPress={() => closeNudge(false)} />
                    </View>
                  </View>
                </Modal>
              </ToastProvider>
            </AuthProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const rootStyles = StyleSheet.create({ root: { flex: 1 } });

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: c.surfaceSecondary, borderRadius: 20, padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: "600", color: c.onSurface },
  sub: { fontSize: 14, color: c.muted, marginBottom: 8 },
}));
