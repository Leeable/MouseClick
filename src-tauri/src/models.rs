use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
    X1,
    X2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum MouseEvent {
    Move {
        t: u64,
        x: i32,
        y: i32,
    },
    Down {
        t: u64,
        button: MouseButton,
        x: i32,
        y: i32,
    },
    Up {
        t: u64,
        button: MouseButton,
        x: i32,
        y: i32,
    },
    Wheel {
        t: u64,
        delta: i32,
        x: i32,
        y: i32,
    },
    Delay {
        t: u64,
        ms: u64,
    },
}

impl MouseEvent {
    pub fn t(&self) -> u64 {
        match self {
            MouseEvent::Move { t, .. }
            | MouseEvent::Down { t, .. }
            | MouseEvent::Up { t, .. }
            | MouseEvent::Wheel { t, .. }
            | MouseEvent::Delay { t, .. } => *t,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LoopMode {
    Count,
    Infinite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopConfig {
    pub mode: LoopMode,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackOptions {
    pub speed: f64,
    pub start_delay_ms: u64,
    pub loop_interval_ms: u64,
}

impl Default for PlaybackOptions {
    fn default() -> Self {
        Self {
            speed: 1.0,
            start_delay_ms: 0,
            loop_interval_ms: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppStatus {
    Idle,
    Recording,
    Paused,
    Playing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusPayload {
    pub status: AppStatus,
    pub event_count: usize,
    pub loop_index: u32,
    pub event_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackRequest {
    pub events: Vec<MouseEvent>,
    pub loop_config: LoopConfig,
    #[serde(default)]
    pub playback_options: PlaybackOptions,
}
