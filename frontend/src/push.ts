import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { API } from "@/src/api";

// Registers the native device token (FCM/APNs) with the backend relay.
// Re-run on every app open / login since tokens can rotate.
export async function registerForPush(user_id: string) {
  if (Platform.OS === "web" || !Device.isDevice) return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await fetch(`${API}/register-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, platform: Platform.OS, device_token: tokenResp.data }),
    });
  } catch (e) {
    console.log("push register skipped", e);
  }
}
