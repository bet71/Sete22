import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles } from "@/src/theme";

type ToastType = "success" | "error" | "info";
const Ctx = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  const show = useCallback((msg: string, type: ToastType = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, type });
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
          <Animated.View
            entering={FadeInUp}
            exiting={FadeOutUp}
            testID="toast-message"
            style={[styles.toast, toast.type === "error" ? styles.error : toast.type === "success" ? styles.success : null]}
          >
            <Text style={styles.text}>{toast.msg}</Text>
          </Animated.View>
        </View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: { backgroundColor: c.surfaceInverse, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, maxWidth: 500, width: "100%" },
  success: { backgroundColor: c.success },
  error: { backgroundColor: c.error },
  text: { color: c.onSurfaceInverse, fontSize: 14, fontWeight: "500" },
}));
