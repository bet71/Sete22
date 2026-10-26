import Ionicons from "@react-native-vector-icons/ionicons";
import { fetch as expoFetch } from "expo/fetch";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API, apiFetch } from "@/src/api";
import { makeStyles, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type Msg = { id: string; role: "user" | "assistant"; content: string };
const SUGGESTIONS = ["Como tirar boas fotos do produto?", "Dicas para vender rápido", "Como negociar com segurança?"];

export default function Assistant() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [session, setSession] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList>(null);
  const bottomChrome = insets.bottom;

  useEffect(() => {
    (async () => {
      let sid = (await storage.getItem("ai_session", "")) as string;
      if (!sid) {
        sid = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await storage.setItem("ai_session", sid);
      }
      setSession(sid);
      try {
        setMsgs(await apiFetch<Msg[]>(`/ai/chat/${sid}`));
      } catch {}
    })();
  }, []);

  const send = async (content: string) => {
    const t = content.trim();
    if (!t || busy || !session) return;
    setText("");
    setBusy(true);
    const aid = `a-${Date.now()}`;
    setMsgs((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: t }, { id: aid, role: "assistant", content: "" }]);
    const append = (d: string) => setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: x.content + d } : x)));
    try {
      const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: session, message: t }) };
      const res: any = Platform.OS === "web" ? await fetch(`${API}/ai/chat`, init) : await expoFetch(`${API}/ai/chat`, init);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.replace(/^data: /, "");
          if (line === "[DONE]") continue;
          try {
            const j = JSON.parse(line);
            if (j.delta) append(j.delta);
            if (j.error) append("Desculpe, não consegui responder agora.");
          } catch {}
        }
      }
    } catch {
      append("Sem conexão. Tente novamente.");
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const clear = async () => {
    const sid = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.setItem("ai_session", sid);
    setSession(sid);
    setMsgs([]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="chat-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Assistente IA</Text>
          <Text style={styles.sub}>Tire dúvidas sobre comprar e vender</Text>
        </View>
        <Pressable testID="chat-new-button" onPress={clear} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="refresh" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          testID="chat-messages"
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="sparkles" size={32} color={colors.brandPrimary} /></View>
              <Text style={styles.emptyTitle}>Olá! Como posso ajudar?</Text>
              {SUGGESTIONS.map((s, i) => (
                <Pressable key={s} testID={`chat-suggestion-${i}`} onPress={() => send(s)} style={styles.sugg}>
                  <Text style={styles.suggText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.me : styles.bot]}>
              <Text style={item.role === "user" ? styles.meText : styles.botText}>{item.content || "Digitando..."}</Text>
            </View>
          )}
        />
        <View style={[styles.inputBar, { paddingBottom: bottomChrome + 12 }]}>
          <TextInput testID="chat-input" value={text} onChangeText={setText} placeholder="Escreva sua pergunta..." placeholderTextColor={colors.muted} style={styles.input} multiline onSubmitEditing={() => send(text)} />
          <Pressable testID="chat-send-button" onPress={() => send(text)} disabled={busy || !text.trim()} style={[styles.send, (busy || !text.trim()) && { opacity: 0.5 }]}>
            <Ionicons name="arrow-up" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  h1: { fontSize: 24, fontWeight: "700", color: c.onSurface },
  sub: { fontSize: 13, color: c.muted },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  backBtn: { width: 40, height: 44, justifyContent: "center" },
  list: { padding: 16, paddingBottom: 32, gap: 8, flexGrow: 1 },
  empty: { alignItems: "center", gap: 12, paddingTop: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: c.onSurface, marginBottom: 8 },
  sugg: { borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  suggText: { fontSize: 14, color: c.brandPrimary, fontWeight: "500" },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 16 },
  me: { alignSelf: "flex-end", backgroundColor: c.brandPrimary, borderBottomRightRadius: 4 },
  bot: { alignSelf: "flex-start", backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4 },
  meText: { color: c.onBrandPrimary, fontSize: 15, lineHeight: 21 },
  botText: { color: c.onSurface, fontSize: 15, lineHeight: 21 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surfaceSecondary, borderTopWidth: 1, borderTopColor: c.border },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: c.surfaceTertiary, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: c.onSurface },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
