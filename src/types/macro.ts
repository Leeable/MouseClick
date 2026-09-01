export type MouseButton = "left" | "right" | "middle" | "x1" | "x2";

export type MouseEvent =
  | { t: number; type: "move"; x: number; y: number }
  | { t: number; type: "down" | "up"; button: MouseButton; x: number; y: number }
  | { t: number; type: "wheel"; delta: number; x: number; y: number }
  | { t: number; type: "delay"; ms: number };

export type LoopMode = "count" | "infinite";

export interface LoopConfig {
  mode: LoopMode;
  count: number;
}

export interface Macro {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  events: MouseEvent[];
  loop: LoopConfig;
  filePath?: string;
}

export type AppStatus = "idle" | "recording" | "paused" | "playing";

export interface StatusPayload {
  status: AppStatus;
  event_count: number;
  loop_index: number;
  event_index: number;
}

export interface HotkeyConfig {
  startRecord: string;
  stopRecord: string;
  togglePlay: string;
  pauseRecord: string;
  emergencyStop: string;
}

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  startRecord: "F9",
  stopRecord: "F10",
  togglePlay: "F8",
  pauseRecord: "F11",
  emergencyStop: "Escape",
};

export function createEmptyMacro(name = "未命名宏"): Macro {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    events: [],
    loop: { mode: "count", count: 1 },
  };
}

export function cloneMacro(macro: Macro, name?: string): Macro {
  return {
    ...macro,
    id: crypto.randomUUID(),
    name: name ?? `${macro.name} 副本`,
    createdAt: new Date().toISOString(),
    filePath: undefined,
    events: structuredClone(macro.events),
  };
}

export function insertDelayEvent(events: MouseEvent[], ms: number): MouseEvent[] {
  const lastT = events.length > 0 ? events[events.length - 1].t : 0;
  return [...events, { t: lastT + Math.max(0, ms), type: "delay", ms: Math.max(0, ms) }];
}

export function normalizeEventTimes(events: MouseEvent[]): MouseEvent[] {
  if (events.length === 0) return events;
  let offset = 0;
  return events.map((event) => {
    if (event.type === "delay") {
      offset += event.ms;
      return { ...event, t: offset };
    }
    const t = event.t + offset;
    return { ...event, t };
  });
}
