import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal, Text, View } from "react-native";

import { Button } from "@/src/components/ui";
import { makeStyles } from "@/src/theme";

type Opts = { title: string; message: string; confirmText?: string };
const Ctx = createContext<(o: Opts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirm = useCallback((o: Opts) => {
    setOpts(o);
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);

  const close = (v: boolean) => {
    setOpts(null);
    resolver.current(v);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal transparent visible={!!opts} animationType="fade" onRequestClose={() => close(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} testID="confirm-dialog">
            <Text style={styles.title}>{opts?.title}</Text>
            <Text style={styles.sub}>{opts?.message}</Text>
            <Button testID="confirm-dialog-confirm" title={opts?.confirmText ?? "Remover"} variant="danger" onPress={() => close(true)} />
            <Button testID="confirm-dialog-cancel" title="Cancelar" variant="secondary" onPress={() => close(false)} />
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: c.surfaceSecondary, borderRadius: 20, padding: 24, gap: 12, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { fontSize: 20, fontWeight: "600", color: c.onSurface },
  sub: { fontSize: 14, color: c.muted, marginBottom: 8 },
}));
