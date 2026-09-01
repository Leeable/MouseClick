import type { MouseEvent } from "../types/macro";

export interface MacroStats {
  durationMs: number;
  total: number;
  moves: number;
  clicks: number;
  wheels: number;
}

export function computeMacroStats(events: MouseEvent[]): MacroStats {
  let moves = 0;
  let clicks = 0;
  let wheels = 0;
  let durationMs = 0;

  for (const event of events) {
    durationMs = Math.max(durationMs, event.t);
    switch (event.type) {
      case "move":
        moves++;
        break;
      case "down":
      case "up":
        clicks++;
        break;
      case "wheel":
        wheels++;
        break;
      case "delay":
        break;
    }
  }

  return {
    durationMs,
    total: events.length,
    moves,
    clicks,
    wheels,
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}
