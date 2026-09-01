use crate::models::{AppStatus, PlaybackRequest, StatusPayload};
use crate::mouse_hook::Recorder;
use crate::playback::Player;
use std::sync::Arc;
use tauri::{AppHandle, State};

pub struct AppState {
    pub recorder: Arc<Recorder>,
    pub player: Arc<Player>,
}

fn recorder_status(recorder: &Recorder, player: &Player) -> AppStatus {
    if recorder.is_recording() {
        if recorder.is_paused() {
            AppStatus::Paused
        } else {
            AppStatus::Recording
        }
    } else if player.is_playing() {
        AppStatus::Playing
    } else {
        AppStatus::Idle
    }
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> StatusPayload {
    StatusPayload {
        status: recorder_status(&state.recorder, &state.player),
        event_count: state.recorder.event_count(),
        loop_index: state.player.loop_index(),
        event_index: state.player.event_index(),
    }
}

#[tauri::command]
pub fn start_recording(
    state: State<'_, AppState>,
    clear_existing: bool,
    time_offset_ms: u64,
) -> Result<(), String> {
    if state.player.is_playing() {
        return Err("Cannot record while playing".into());
    }
    if state.recorder.is_recording() {
        return Err("Already recording".into());
    }
    state.recorder.start(clear_existing, time_offset_ms)
}

#[tauri::command]
pub fn stop_recording(state: State<'_, AppState>) -> Result<Vec<crate::models::MouseEvent>, String> {
    Ok(state.recorder.stop())
}

#[tauri::command]
pub fn pause_recording(state: State<'_, AppState>) -> Result<(), String> {
    state.recorder.pause()
}

#[tauri::command]
pub fn resume_recording(state: State<'_, AppState>) -> Result<(), String> {
    state.recorder.resume()
}

#[tauri::command]
pub fn start_playback(
    app: AppHandle,
    state: State<'_, AppState>,
    request: PlaybackRequest,
) -> Result<(), String> {
    if state.recorder.is_recording() {
        return Err("Cannot play while recording".into());
    }
    if state.player.is_playing() {
        return Err("Already playing".into());
    }
    state.player.start(app, request)
}

#[tauri::command]
pub fn stop_playback(state: State<'_, AppState>) -> Result<(), String> {
    state.player.stop();
    Ok(())
}

#[tauri::command]
pub fn emergency_stop(state: State<'_, AppState>) -> Result<Option<Vec<crate::models::MouseEvent>>, String> {
    let mut stopped_events = None;
    if state.recorder.is_recording() {
        stopped_events = Some(state.recorder.stop());
    }
    if state.player.is_playing() {
        state.player.stop();
    }
    Ok(stopped_events)
}
