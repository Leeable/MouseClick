import { useEffect, useRef } from "react";
import {
  isRegistered,
  register,
  unregister,
  unregisterAll,
} from "@tauri-apps/plugin-global-shortcut";
import type { HotkeyConfig } from "../types/macro";

export interface HotkeyHandlers {
  onStartRecord: () => void;
  onStopRecord: () => void;
  onTogglePlay: () => void;
  onTogglePauseRecord: () => void;
  onEmergencyStop: () => void;
}

export function useGlobalHotkeys(hotkeys: HotkeyConfig, handlers: HotkeyHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let cancelled = false;

    const bind = async () => {
      try {
        await unregisterAll();
        if (cancelled) return;

        const entries: { key: string; run: () => void }[] = [
          { key: hotkeys.startRecord, run: () => handlersRef.current.onStartRecord() },
          { key: hotkeys.stopRecord, run: () => handlersRef.current.onStopRecord() },
          { key: hotkeys.togglePlay, run: () => handlersRef.current.onTogglePlay() },
          { key: hotkeys.pauseRecord, run: () => handlersRef.current.onTogglePauseRecord() },
          { key: hotkeys.emergencyStop, run: () => handlersRef.current.onEmergencyStop() },
        ];

        const seen = new Set<string>();
        for (const { key, run } of entries) {
          if (!key || seen.has(key)) continue;
          seen.add(key);
          if (await isRegistered(key)) {
            await unregister(key);
          }
          if (cancelled) return;
          await register(key, (event) => {
            if (event.state !== "Pressed") return;
            run();
          });
        }
      } catch (err) {
        console.error("hotkey registration failed:", err);
      }
    };

    void bind();

    return () => {
      cancelled = true;
      void unregisterAll();
    };
  }, [hotkeys]);
}
