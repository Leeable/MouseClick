import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Store } from "@tauri-apps/plugin-store";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import MacroList from "./components/MacroList";
import EventTimeline from "./components/EventTimeline";
import ControlBar from "./components/ControlBar";
import SettingsDrawer from "./components/SettingsDrawer";
import CountdownOverlay from "./components/CountdownOverlay";
import {
  cloneMacro,
  createEmptyMacro,
  type AppStatus,
  type Macro,
  type MouseEvent,
  type StatusPayload,
} from "./types/macro";
import {
  DEFAULT_APP_SETTINGS,
  mergeSettings,
  type AppSettings,
} from "./types/settings";
import { useGlobalHotkeys } from "./hooks/useGlobalHotkeys";
import * as api from "./lib/tauri";

const SETTINGS_KEY = "appSettings";
const RECENT_KEY = "recentFiles";
const MAX_RECENT = 8;

function statusLabel(status: AppStatus): string {
  switch (status) {
    case "idle":
      return "空闲";
    case "recording":
      return "录制中";
    case "paused":
      return "已暂停";
    case "playing":
      return "播放中";
  }
}

function statusColor(status: AppStatus): "default" | "error" | "success" | "warning" {
  switch (status) {
    case "idle":
      return "default";
    case "recording":
      return "error";
    case "paused":
      return "warning";
    case "playing":
      return "success";
  }
}

function macroPayload(macro: Macro) {
  return {
    version: 1 as const,
    name: macro.name,
    createdAt: macro.createdAt,
    events: macro.events,
    loop: macro.loop,
  };
}

export default function App() {
  const initial = useMemo(() => createEmptyMacro("宏 1"), []);
  const [macros, setMacros] = useState<Macro[]>([initial]);
  const [selectedId, setSelectedId] = useState<string>(initial.id);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [loopIndex, setLoopIndex] = useState(0);
  const [eventIndex, setEventIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const macrosRef = useRef(macros);
  const selectedIdRef = useRef(selectedId);
  const statusRef = useRef(status);
  const settingsRef = useRef(settings);
  const undoStack = useRef<MouseEvent[][]>([]);
  const redoStack = useRef<MouseEvent[][]>([]);
  const [editRevision, setEditRevision] = useState(0);

  useEffect(() => {
    macrosRef.current = macros;
  }, [macros]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
    setEditRevision((n) => n + 1);
  }, [selectedId]);

  const selected = useMemo(
    () => macros.find((m) => m.id === selectedId) ?? null,
    [macros, selectedId],
  );

  const updateSelected = useCallback((updater: (macro: Macro) => Macro) => {
    setMacros((prev) => {
      const idx = prev.findIndex((m) => m.id === selectedIdRef.current);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = updater(prev[idx]);
      return next;
    });
  }, []);

  const bumpEdit = () => setEditRevision((n) => n + 1);

  const commitEventsEdit = useCallback(
    (next: MouseEvent[]) => {
      const current = macrosRef.current.find((m) => m.id === selectedIdRef.current);
      if (!current) return;
      undoStack.current = [...undoStack.current.slice(-49), current.events];
      redoStack.current = [];
      bumpEdit();
      updateSelected((m) => ({ ...m, events: next }));
    },
    [updateSelected],
  );

  const undoEvents = useCallback(() => {
    const current = macrosRef.current.find((m) => m.id === selectedIdRef.current);
    if (!current || undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(current.events);
    bumpEdit();
    updateSelected((m) => ({ ...m, events: prev }));
  }, [updateSelected]);

  const redoEvents = useCallback(() => {
    const current = macrosRef.current.find((m) => m.id === selectedIdRef.current);
    if (!current || redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(current.events);
    bumpEdit();
    updateSelected((m) => ({ ...m, events: next }));
  }, [updateSelected]);

  const persistSettings = useCallback(async (next: AppSettings) => {
    const store = await Store.load("settings.json");
    await store.set(SETTINGS_KEY, next);
    await store.save();
  }, []);

  const pushRecent = useCallback(async (path: string) => {
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENT);
      void (async () => {
        const store = await Store.load("settings.json");
        await store.set(RECENT_KEY, next);
        await store.save();
      })();
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = await Store.load("settings.json");
        const saved = await store.get<Partial<AppSettings>>(SETTINGS_KEY);
        const recent = await store.get<string[]>(RECENT_KEY);
        if (!cancelled) {
          if (saved) setSettings(mergeSettings(saved));
          if (recent) setRecentFiles(recent);
        }
      } catch {
        // first run
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unlistenClose: (() => void) | undefined;
    let unlistenInstance: (() => void) | undefined;

    void (async () => {
      const win = getCurrentWindow();
      unlistenClose = await win.onCloseRequested(async (event) => {
        event.preventDefault();
        if (settingsRef.current.general.minimizeToTray) {
          await win.hide();
        } else {
          await api.exitApp();
        }
      });

      unlistenInstance = await listen("instance-already-running", () => {
        setToast("MouseClick 已在运行，请勿重复打开");
      });
    })();

    return () => {
      unlistenClose?.();
      unlistenInstance?.();
    };
  }, []);

  const syncStatus = useCallback(async () => {
    try {
      const payload = await api.getStatus();
      setStatus(payload.status);
      setLoopIndex(payload.loop_index);
      setEventIndex(payload.event_index);
    } catch {
      // ignore
    }
  }, []);

  const autoSaveIfNeeded = useCallback(async (macro: Macro) => {
    if (!settingsRef.current.general.autoSaveOnStop || !macro.filePath) return;
    try {
      await writeTextFile(macro.filePath, JSON.stringify(macroPayload(macro), null, 2));
      setToast("已自动保存");
    } catch (err) {
      setToast(`自动保存失败: ${String(err)}`);
    }
  }, []);

  const beginRecording = useCallback(async () => {
    if (!selectedIdRef.current) {
      setToast("请先选择一个宏");
      return;
    }
    const cfg = settingsRef.current.record;
    const clearExisting = cfg.mode === "overwrite";

    const run = async () => {
      try {
        const macro = macrosRef.current.find((m) => m.id === selectedIdRef.current);
        const timeOffsetMs =
          !clearExisting && macro && macro.events.length > 0
            ? macro.events[macro.events.length - 1].t
            : 0;

        if (clearExisting) {
          updateSelected((m) => ({ ...m, events: [] }));
        }
        await api.startRecording(clearExisting, timeOffsetMs);
        setStatus("recording");
        setToast(
          clearExisting ? "录制已开始（覆盖模式）" : "录制已开始（追加模式）",
        );
      } catch (err) {
        setToast(String(err));
      }
    };

    if (cfg.countdownSec > 0) {
      let left = cfg.countdownSec;
      setCountdown(left);
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          left -= 1;
          if (left <= 0) {
            window.clearInterval(timer);
            setCountdown(null);
            resolve();
          } else {
            setCountdown(left);
          }
        }, 1000);
      });
    }
    await run();
  }, [updateSelected]);

  const handleStopRecord = useCallback(async () => {
    try {
      const events = await api.stopRecording();
      updateSelected((m) => ({ ...m, events }));
      setStatus("idle");
      setToast(`录制结束，共 ${events.length} 个事件`);
      const macro = macrosRef.current.find((m) => m.id === selectedIdRef.current);
      if (macro) {
        await autoSaveIfNeeded({ ...macro, events });
      }
    } catch (err) {
      setToast(String(err));
    }
  }, [updateSelected, autoSaveIfNeeded]);

  const handlePauseRecord = useCallback(async () => {
    try {
      await api.pauseRecording();
      setStatus("paused");
    } catch (err) {
      setToast(String(err));
    }
  }, []);

  const handleResumeRecord = useCallback(async () => {
    try {
      await api.resumeRecording();
      setStatus("recording");
    } catch (err) {
      setToast(String(err));
    }
  }, []);

  const handleTogglePauseRecord = useCallback(async () => {
    if (statusRef.current === "paused") {
      await handleResumeRecord();
    } else if (statusRef.current === "recording") {
      await handlePauseRecord();
    }
  }, [handlePauseRecord, handleResumeRecord]);

  const handleTogglePlay = useCallback(async () => {
    if (statusRef.current === "playing") {
      try {
        await api.stopPlayback();
        setStatus("idle");
      } catch (err) {
        setToast(String(err));
      }
      return;
    }

    const macro = macrosRef.current.find((m) => m.id === selectedIdRef.current);
    if (!macro || macro.events.length === 0) {
      setToast("当前宏没有可播放的事件");
      return;
    }

    try {
      await api.startPlayback(macro.events, macro.loop, settingsRef.current.playback);
      setStatus("playing");
    } catch (err) {
      setToast(String(err));
    }
  }, []);

  const handleEmergencyStop = useCallback(async () => {
    try {
      const stoppedEvents = await api.emergencyStop();
      if (stoppedEvents) {
        updateSelected((m) => ({ ...m, events: stoppedEvents }));
      }
      setStatus("idle");
      setCountdown(null);
      setToast("已紧急停止");
    } catch (err) {
      setToast(String(err));
    }
  }, [updateSelected]);

  const saveSettings = useCallback(
    async (next: AppSettings) => {
      setSettings(next);
      try {
        await persistSettings(next);
        setToast("设置已保存");
      } catch (err) {
        setToast(String(err));
      }
    },
    [persistSettings],
  );

  useGlobalHotkeys(settings.hotkeys, {
    onStartRecord: () => void beginRecording(),
    onStopRecord: () => void handleStopRecord(),
    onTogglePlay: () => void handleTogglePlay(),
    onTogglePauseRecord: () => void handleTogglePauseRecord(),
    onEmergencyStop: () => void handleEmergencyStop(),
  });

  useEffect(() => {
    let unsubs: Array<() => void> = [];
    (async () => {
      unsubs.push(
        await listen<MouseEvent>("mouse-record-event", (event) => {
          updateSelected((m) => ({ ...m, events: [...m.events, event.payload] }));
        }),
      );
      unsubs.push(
        await listen<StatusPayload>("playback-status", (event) => {
          setStatus(event.payload.status);
          setLoopIndex(event.payload.loop_index);
          setEventIndex(event.payload.event_index);
        }),
      );
      await syncStatus();
    })();
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [syncStatus, updateSelected]);

  const handleCreate = () => {
    const macro = createEmptyMacro(`宏 ${macros.length + 1}`);
    setMacros((prev) => [...prev, macro]);
    setSelectedId(macro.id);
  };

  const handleDuplicate = (id: string) => {
    const source = macros.find((m) => m.id === id);
    if (!source) return;
    const copy = cloneMacro(source);
    setMacros((prev) => [...prev, copy]);
    setSelectedId(copy.id);
    setToast("已复制宏");
  };

  const handleRename = (id: string) => {
    const target = macros.find((m) => m.id === id);
    if (!target) return;
    const name = window.prompt("重命名宏", target.name);
    if (!name?.trim()) return;
    setMacros((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name: name.trim() } : m)),
    );
  };

  const handleDelete = (id: string) => {
    setMacros((prev) => {
      if (prev.length <= 1) {
        setToast("至少保留一个宏");
        return prev;
      }
      const idx = prev.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      const next = prev.filter((m) => m.id !== id);
      const fallback = next[Math.max(0, idx - 1)] ?? next[0];
      setSelectedId(fallback.id);
      return next;
    });
  };

  const loadMacroFromPath = useCallback(
    async (path: string) => {
      const text = await readTextFile(path);
      const parsed = JSON.parse(text) as Partial<Macro>;
      if (!parsed?.events || !Array.isArray(parsed.events)) {
        throw new Error("无效的宏文件");
      }
      const macro: Macro = {
        version: 1,
        id: crypto.randomUUID(),
        name: parsed.name || "导入的宏",
        createdAt: parsed.createdAt || new Date().toISOString(),
        events: parsed.events,
        loop: parsed.loop || { mode: "count", count: 1 },
        filePath: path,
      };
      setMacros((prev) => [...prev, macro]);
      setSelectedId(macro.id);
      await pushRecent(path);
      setToast("宏已加载");
    },
    [pushRecent],
  );

  const handleOpen = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "MouseClick Macro", extensions: ["mouseclick.json", "json"] }],
      });
      if (!path || Array.isArray(path)) return;
      await loadMacroFromPath(path);
    } catch (err) {
      setToast(String(err));
    }
  };

  const handleOpenRecent = async (path: string) => {
    try {
      await loadMacroFromPath(path);
    } catch (err) {
      setToast(String(err));
    }
  };

  const handleSave = async (saveAs: boolean) => {
    if (!selected) return;
    try {
      let path = !saveAs ? selected.filePath : undefined;
      if (!path) {
        const picked = await save({
          defaultPath: `${selected.name}.mouseclick.json`,
          filters: [{ name: "MouseClick Macro", extensions: ["mouseclick.json"] }],
        });
        if (!picked) return;
        path = picked;
      }
      await writeTextFile(path, JSON.stringify(macroPayload(selected), null, 2));
      updateSelected((m) => ({ ...m, filePath: path }));
      await pushRecent(path);
      setToast(saveAs ? "已另存为" : "已保存");
    } catch (err) {
      setToast(String(err));
    }
  };

  const editable = status === "idle";
  void editRevision;
  const canUndoEvents = undoStack.current.length > 0;
  const canRedoEvents = redoStack.current.length > 0;

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <CountdownOverlay open={countdown !== null} seconds={countdown ?? 0} />

      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{
          flexShrink: 0,
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(255,255,255,0.72)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            MouseClick
          </Typography>
          <Chip size="small" color={statusColor(status)} label={statusLabel(status)} />
          <Tooltip title="打开">
            <IconButton onClick={() => void handleOpen()}>
              <FolderOpenOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="保存">
            <IconButton onClick={() => void handleSave(false)} disabled={!selected}>
              <SaveOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Button size="small" onClick={() => void handleSave(true)} disabled={!selected}>
            另存为
          </Button>
          <Tooltip title="设置">
            <IconButton onClick={() => setSettingsOpen(true)}>
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
          gap: 2,
          p: 2,
          overflow: "hidden",
        }}
      >
        <Paper
          sx={{
            p: 2,
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MacroList
            macros={macros}
            selectedId={selectedId}
            recentFiles={recentFiles}
            onSelect={setSelectedId}
            onCreate={handleCreate}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onOpenRecent={(path) => void handleOpenRecent(path)}
          />
        </Paper>

        <Paper
          sx={{
            p: 2,
            height: "100%",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <EventTimeline
              events={selected?.events ?? []}
              highlightIndex={status === "playing" ? Math.max(0, eventIndex - 1) : -1}
              editable={editable}
              onChange={commitEventsEdit}
              onUndo={undoEvents}
              onRedo={redoEvents}
              canUndo={canUndoEvents}
              canRedo={canRedoEvents}
            />
          </Box>
          <Divider sx={{ flexShrink: 0 }} />
          <Box sx={{ flexShrink: 0 }}>
            <ControlBar
              status={status}
              loop={selected?.loop ?? { mode: "count", count: 1 }}
              loopIndex={loopIndex}
              eventIndex={eventIndex}
              eventCount={selected?.events.length ?? 0}
              playback={settings.playback}
              disabled={!selected}
              onLoopChange={(loop) => updateSelected((m) => ({ ...m, loop }))}
              onStartRecord={() => void beginRecording()}
              onStopRecord={() => void handleStopRecord()}
              onPauseRecord={() => void handlePauseRecord()}
              onResumeRecord={() => void handleResumeRecord()}
              onTogglePlay={() => void handleTogglePlay()}
            />
          </Box>
        </Paper>
      </Box>

      <SettingsDrawer
        open={settingsOpen}
        value={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => void saveSettings(next)}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3200}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" variant="filled" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
