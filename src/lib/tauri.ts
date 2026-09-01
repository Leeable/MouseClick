import { invoke } from "@tauri-apps/api/core";
import type { MouseEvent, StatusPayload } from "../types/macro";
import type { PlaybackSettings } from "../types/settings";

export type { StatusPayload };

type PlaybackRequest = {
  events: MouseEvent[];
  loop_config: { mode: "count" | "infinite"; count: number };
  playback_options: {
    speed: number;
    start_delay_ms: number;
    loop_interval_ms: number;
  };
};

export async function getStatus(): Promise<StatusPayload> {
  return invoke("get_status");
}

export async function startRecording(
  clearExisting: boolean,
  timeOffsetMs = 0,
): Promise<void> {
  return invoke("start_recording", {
    clearExisting,
    timeOffsetMs,
  });
}

export async function stopRecording(): Promise<MouseEvent[]> {
  return invoke("stop_recording");
}

export async function pauseRecording(): Promise<void> {
  return invoke("pause_recording");
}

export async function resumeRecording(): Promise<void> {
  return invoke("resume_recording");
}

export async function startPlayback(
  events: MouseEvent[],
  loopConfig: { mode: "count" | "infinite"; count: number },
  playback: PlaybackSettings,
): Promise<void> {
  const request: PlaybackRequest = {
    events,
    loop_config: loopConfig,
    playback_options: {
      speed: playback.speed,
      start_delay_ms: playback.startDelayMs,
      loop_interval_ms: playback.loopIntervalMs,
    },
  };
  return invoke("start_playback", { request });
}

export async function stopPlayback(): Promise<void> {
  return invoke("stop_playback");
}

export async function emergencyStop(): Promise<MouseEvent[] | null> {
  return invoke("emergency_stop");
}

export async function exitApp(): Promise<void> {
  return invoke("exit_app");
}
