import type { HotkeyConfig } from "./macro";
import { DEFAULT_HOTKEYS } from "./macro";

export type RecordMode = "overwrite" | "append";

export interface RecordSettings {
  mode: RecordMode;
  countdownSec: number;
}

export interface PlaybackSettings {
  speed: number;
  startDelayMs: number;
  loopIntervalMs: number;
}

export interface GeneralSettings {
  minimizeToTray: boolean;
  autoSaveOnStop: boolean;
}

export interface AppSettings {
  hotkeys: HotkeyConfig;
  record: RecordSettings;
  playback: PlaybackSettings;
  general: GeneralSettings;
}

export const DEFAULT_RECORD_SETTINGS: RecordSettings = {
  mode: "overwrite",
  countdownSec: 0,
};

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  speed: 1,
  startDelayMs: 0,
  loopIntervalMs: 0,
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  minimizeToTray: false,
  autoSaveOnStop: false,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  hotkeys: DEFAULT_HOTKEYS,
  record: DEFAULT_RECORD_SETTINGS,
  playback: DEFAULT_PLAYBACK_SETTINGS,
  general: DEFAULT_GENERAL_SETTINGS,
};

export function mergeSettings(partial?: Partial<AppSettings>): AppSettings {
  return {
    hotkeys: { ...DEFAULT_HOTKEYS, ...partial?.hotkeys },
    record: { ...DEFAULT_RECORD_SETTINGS, ...partial?.record },
    playback: { ...DEFAULT_PLAYBACK_SETTINGS, ...partial?.playback },
    general: { ...DEFAULT_GENERAL_SETTINGS, ...partial?.general },
  };
}
