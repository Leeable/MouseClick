use crate::models::{
    AppStatus, LoopMode, MouseButton, MouseEvent, PlaybackOptions, PlaybackRequest, StatusPayload,
};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_ABSOLUTE, MOUSEEVENTF_LEFTDOWN,
    MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_MOVE,
    MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL, MOUSEEVENTF_XDOWN,
    MOUSEEVENTF_XUP, MOUSEINPUT,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

pub struct Player {
    playing: AtomicBool,
    stop_flag: AtomicBool,
    thread: Mutex<Option<JoinHandle<()>>>,
    loop_index: Mutex<u32>,
    event_index: Mutex<usize>,
}

impl Player {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            playing: AtomicBool::new(false),
            stop_flag: AtomicBool::new(false),
            thread: Mutex::new(None),
            loop_index: Mutex::new(0),
            event_index: Mutex::new(0),
        })
    }

    pub fn is_playing(&self) -> bool {
        self.playing.load(Ordering::SeqCst)
    }

    pub fn loop_index(&self) -> u32 {
        *self.loop_index.lock()
    }

    pub fn event_index(&self) -> usize {
        *self.event_index.lock()
    }

    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        if let Some(handle) = self.thread.lock().take() {
            let _ = handle.join();
        }
        self.playing.store(false, Ordering::SeqCst);
        self.stop_flag.store(false, Ordering::SeqCst);
    }

    pub fn start(self: &Arc<Self>, app: AppHandle, request: PlaybackRequest) -> Result<(), String> {
        if self.playing.swap(true, Ordering::SeqCst) {
            return Err("Already playing".into());
        }
        if request.events.is_empty() {
            self.playing.store(false, Ordering::SeqCst);
            return Err("No events to play".into());
        }

        self.stop_flag.store(false, Ordering::SeqCst);
        *self.loop_index.lock() = 0;
        *self.event_index.lock() = 0;

        let this = Arc::clone(self);
        let handle = thread::spawn(move || {
            this.run_playback(app, request);
        });
        *self.thread.lock() = Some(handle);
        Ok(())
    }

    fn emit_status(&self, app: &AppHandle, status: AppStatus, event_count: usize) {
        let _ = app.emit(
            "playback-status",
            StatusPayload {
                status,
                event_count,
                loop_index: *self.loop_index.lock(),
                event_index: *self.event_index.lock(),
            },
        );
    }

    fn run_playback(&self, app: AppHandle, request: PlaybackRequest) {
        let event_count = request.events.len();
        let options = request.playback_options.clone();
        self.emit_status(&app, AppStatus::Playing, event_count);

        if !sleep_interruptible(
            &self.stop_flag,
            Duration::from_millis(options.start_delay_ms),
        ) {
            self.finish_playback(&app, event_count);
            return;
        }

        let mut loop_n = 0u32;
        loop {
            if self.stop_flag.load(Ordering::SeqCst) {
                break;
            }

            match request.loop_config.mode {
                LoopMode::Count => {
                    if loop_n >= request.loop_config.count.max(1) {
                        break;
                    }
                }
                LoopMode::Infinite => {}
            }

            *self.loop_index.lock() = loop_n + 1;
            self.emit_status(&app, AppStatus::Playing, event_count);

            if !self.play_once(&app, &request.events, event_count, &options) {
                break;
            }

            loop_n += 1;

            if request.loop_config.mode == LoopMode::Count
                && loop_n >= request.loop_config.count.max(1)
            {
                break;
            }

            if options.loop_interval_ms > 0
                && !sleep_interruptible(
                    &self.stop_flag,
                    Duration::from_millis(options.loop_interval_ms),
                )
            {
                break;
            }
        }

        self.finish_playback(&app, event_count);
    }

    fn finish_playback(&self, app: &AppHandle, event_count: usize) {
        self.playing.store(false, Ordering::SeqCst);
        *self.event_index.lock() = 0;
        self.emit_status(app, AppStatus::Idle, event_count);
    }

    fn play_once(
        &self,
        app: &AppHandle,
        events: &[MouseEvent],
        event_count: usize,
        options: &PlaybackOptions,
    ) -> bool {
        let speed = options.speed.clamp(0.1, 10.0);
        let start = Instant::now();

        for (idx, event) in events.iter().enumerate() {
            if self.stop_flag.load(Ordering::SeqCst) {
                return false;
            }

            let target_ms = ((event.t() as f64) / speed) as u64;
            let target = Duration::from_millis(target_ms);
            while start.elapsed() < target {
                if self.stop_flag.load(Ordering::SeqCst) {
                    return false;
                }
                let remain = target.saturating_sub(start.elapsed());
                thread::sleep(remain.min(Duration::from_millis(5)));
            }

            *self.event_index.lock() = idx + 1;
            if idx % 8 == 0 {
                self.emit_status(app, AppStatus::Playing, event_count);
            }

            if matches!(event, MouseEvent::Delay { .. }) {
                continue;
            }

            #[cfg(windows)]
            {
                if let Err(err) = dispatch_event(event) {
                    eprintln!("playback event error: {err}");
                }
            }
        }
        true
    }
}

fn sleep_interruptible(stop_flag: &AtomicBool, duration: Duration) -> bool {
    if duration.is_zero() {
        return true;
    }
    let deadline = Instant::now() + duration;
    while Instant::now() < deadline {
        if stop_flag.load(Ordering::SeqCst) {
            return false;
        }
        thread::sleep(Duration::from_millis(10));
    }
    true
}

#[cfg(windows)]
fn to_absolute(x: i32, y: i32) -> (i32, i32) {
    unsafe {
        let w = GetSystemMetrics(SM_CXSCREEN).max(1);
        let h = GetSystemMetrics(SM_CYSCREEN).max(1);
        let ax = ((x as i64) * 65535) / (w as i64);
        let ay = ((y as i64) * 65535) / (h as i64);
        (ax as i32, ay as i32)
    }
}

#[cfg(windows)]
fn send_mouse(
    flags: windows::Win32::UI::Input::KeyboardAndMouse::MOUSE_EVENT_FLAGS,
    dx: i32,
    dy: i32,
    data: u32,
) -> Result<(), String> {
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx,
                dy,
                mouseData: data,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe {
        let sent = SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
        if sent == 0 {
            Err("SendInput failed".into())
        } else {
            Ok(())
        }
    }
}

#[cfg(windows)]
fn move_abs(x: i32, y: i32) -> Result<(), String> {
    let (ax, ay) = to_absolute(x, y);
    send_mouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, ax, ay, 0)
}

#[cfg(windows)]
fn button_flags(
    button: &MouseButton,
    down: bool,
) -> (
    windows::Win32::UI::Input::KeyboardAndMouse::MOUSE_EVENT_FLAGS,
    u32,
) {
    match (button, down) {
        (MouseButton::Left, true) => (MOUSEEVENTF_LEFTDOWN, 0),
        (MouseButton::Left, false) => (MOUSEEVENTF_LEFTUP, 0),
        (MouseButton::Right, true) => (MOUSEEVENTF_RIGHTDOWN, 0),
        (MouseButton::Right, false) => (MOUSEEVENTF_RIGHTUP, 0),
        (MouseButton::Middle, true) => (MOUSEEVENTF_MIDDLEDOWN, 0),
        (MouseButton::Middle, false) => (MOUSEEVENTF_MIDDLEUP, 0),
        (MouseButton::X1, true) => (MOUSEEVENTF_XDOWN, 1),
        (MouseButton::X1, false) => (MOUSEEVENTF_XUP, 1),
        (MouseButton::X2, true) => (MOUSEEVENTF_XDOWN, 2),
        (MouseButton::X2, false) => (MOUSEEVENTF_XUP, 2),
    }
}

#[cfg(windows)]
fn dispatch_event(event: &MouseEvent) -> Result<(), String> {
    match event {
        MouseEvent::Move { x, y, .. } => move_abs(*x, *y),
        MouseEvent::Down { button, x, y, .. } => {
            move_abs(*x, *y)?;
            let (flags, data) = button_flags(button, true);
            send_mouse(flags, 0, 0, data)
        }
        MouseEvent::Up { button, x, y, .. } => {
            move_abs(*x, *y)?;
            let (flags, data) = button_flags(button, false);
            send_mouse(flags, 0, 0, data)
        }
        MouseEvent::Wheel { delta, x, y, .. } => {
            move_abs(*x, *y)?;
            send_mouse(MOUSEEVENTF_WHEEL, 0, 0, *delta as u32)
        }
        MouseEvent::Delay { .. } => Ok(()),
    }
}

#[cfg(not(windows))]
pub fn _unused_playback_options(_: &PlaybackOptions) {}
