import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Slider from "@mui/material/Slider";
import MenuItem from "@mui/material/MenuItem";
import { useEffect, useState } from "react";
import type { HotkeyConfig } from "../types/macro";
import { DEFAULT_HOTKEYS } from "../types/macro";
import type { AppSettings } from "../types/settings";
import { DEFAULT_APP_SETTINGS } from "../types/settings";

interface Props {
  open: boolean;
  value: AppSettings;
  onClose: () => void;
  onSave: (next: AppSettings) => void;
}

type HotkeyField = keyof HotkeyConfig;

const HOTKEY_LABELS: Record<HotkeyField, string> = {
  startRecord: "开始录制",
  stopRecord: "停止录制",
  togglePlay: "播放 / 停止",
  pauseRecord: "暂停 / 继续录制",
  emergencyStop: "紧急停止",
};

function formatCombo(e: React.KeyboardEvent): string | null {
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");
  let key = e.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
}

export default function SettingsDrawer({ open, value, onClose, onSave }: Props) {
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState<AppSettings>(value);
  const [capturing, setCapturing] = useState<HotkeyField | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setCapturing(null);
      setTab(0);
    }
  }, [open, value]);

  const updateHotkey = (field: HotkeyField, combo: string) => {
    setDraft((prev) => ({
      ...prev,
      hotkeys: { ...prev.hotkeys, [field]: combo },
    }));
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 400 } }}>
      <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
        <Typography variant="h6" gutterBottom>
          设置
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="快捷键" />
          <Tab label="录制" />
          <Tab label="播放" />
          <Tab label="通用" />
        </Tabs>

        <Box sx={{ flex: 1, overflow: "auto" }}>
          {tab === 0 && (
            <Stack spacing={2}>
              <Alert severity="info" sx={{ mb: 1 }}>
                全局快捷键，应用未聚焦时也生效
              </Alert>
              {(Object.keys(HOTKEY_LABELS) as HotkeyField[]).map((field) => (
                <Stack key={field} spacing={1}>
                  <Typography variant="subtitle2">{HOTKEY_LABELS[field]}</Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      value={draft.hotkeys[field]}
                      onChange={(e) => updateHotkey(field, e.target.value)}
                      onKeyDown={(e) => {
                        if (capturing !== field) return;
                        e.preventDefault();
                        const combo = formatCombo(e);
                        if (combo) {
                          updateHotkey(field, combo);
                          setCapturing(null);
                        }
                      }}
                      placeholder={capturing === field ? "请按下快捷键…" : ""}
                      focused={capturing === field}
                    />
                    <Button variant="outlined" onClick={() => setCapturing(field)}>
                      {capturing === field ? "等待" : "捕获"}
                    </Button>
                  </Stack>
                </Stack>
              ))}
              <Button
                size="small"
                onClick={() =>
                  setDraft((prev) => ({ ...prev, hotkeys: DEFAULT_HOTKEYS }))
                }
              >
                恢复默认快捷键
              </Button>
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={2.5}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">录制模式</Typography>
                <TextField
                  select
                  size="small"
                  value={draft.record.mode}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      record: {
                        ...prev.record,
                        mode: e.target.value as "overwrite" | "append",
                      },
                    }))
                  }
                >
                  <MenuItem value="overwrite">覆盖当前宏事件</MenuItem>
                  <MenuItem value="append">追加到当前宏末尾</MenuItem>
                </TextField>
              </Stack>
              <TextField
                size="small"
                type="number"
                label="录制倒计时（秒）"
                value={draft.record.countdownSec}
                inputProps={{ min: 0, max: 10 }}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    record: {
                      ...prev.record,
                      countdownSec: Math.max(0, Math.min(10, Number(e.target.value) || 0)),
                    },
                  }))
                }
                helperText="开始录制前的倒计时，便于切换到目标窗口"
              />
            </Stack>
          )}

          {tab === 2 && (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  播放速度 ×{draft.playback.speed.toFixed(2)}
                </Typography>
                <Slider
                  min={0.25}
                  max={4}
                  step={0.25}
                  value={draft.playback.speed}
                  onChange={(_, v) =>
                    setDraft((prev) => ({
                      ...prev,
                      playback: { ...prev.playback, speed: v as number },
                    }))
                  }
                />
              </Box>
              <TextField
                size="small"
                type="number"
                label="播放前延迟（毫秒）"
                value={draft.playback.startDelayMs}
                inputProps={{ min: 0, max: 60000 }}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    playback: {
                      ...prev.playback,
                      startDelayMs: Math.max(0, Number(e.target.value) || 0),
                    },
                  }))
                }
              />
              <TextField
                size="small"
                type="number"
                label="循环间隔（毫秒）"
                value={draft.playback.loopIntervalMs}
                inputProps={{ min: 0, max: 600000 }}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    playback: {
                      ...prev.playback,
                      loopIntervalMs: Math.max(0, Number(e.target.value) || 0),
                    },
                  }))
                }
                helperText="每轮播放之间的等待时间"
              />
            </Stack>
          )}

          {tab === 3 && (
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.general.minimizeToTray}
                    onChange={(_, checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        general: { ...prev.general, minimizeToTray: checked },
                      }))
                    }
                  />
                }
                label="关闭窗口时最小化到托盘"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.general.autoSaveOnStop}
                    onChange={(_, checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        general: { ...prev.general, autoSaveOnStop: checked },
                      }))
                    }
                  />
                }
                label="停止录制后自动保存（需已有关联文件路径）"
              />
            </Stack>
          )}
        </Box>

        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 2 }}>
          <Button
            onClick={() => setDraft(DEFAULT_APP_SETTINGS)}
          >
            全部恢复默认
          </Button>
          <Button onClick={onClose}>取消</Button>
          <Button variant="contained" onClick={() => onSave(draft)}>
            保存
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
