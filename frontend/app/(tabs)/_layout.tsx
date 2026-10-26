import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="sell">
          <NativeTabs.Trigger.Icon sf="plus.circle.fill" />
          <NativeTabs.Trigger.Label>Anunciar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="assistant">
          <NativeTabs.Trigger.Icon sf="sparkles" />
          <NativeTabs.Trigger.Label>Assistente</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="account">
          <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
          <NativeTabs.Trigger.Label>Conta</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  const icon = (name: string) =>
    function TabIcon({ color, size }: { color: string; size: number }) {
      return <Ionicons name={name as any} size={size} color={color} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontWeight: "500" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: icon("home"), tabBarButtonTestID: "tab-home" } as any} />
      <Tabs.Screen name="sell" options={{ title: "Anunciar", tabBarIcon: icon("add-circle"), tabBarButtonTestID: "tab-sell" } as any} />
      <Tabs.Screen name="assistant" options={{ title: "Assistente", tabBarIcon: icon("sparkles"), tabBarButtonTestID: "tab-assistant" } as any} />
      <Tabs.Screen name="account" options={{ title: "Conta", tabBarIcon: icon("person-circle"), tabBarButtonTestID: "tab-account" } as any} />
    </Tabs>
  );
}
