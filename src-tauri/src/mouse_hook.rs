use crate::models::{MouseButton, MouseEvent};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
#[cfg(windows)]
use windows::Win32::System::Threading::GetCurrentThreadId;
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, PeekMessageW, PostThreadMessageW, SetWindowsHookExW, TranslateMessage,
    UnhookWindowsHookEx, DispatchMessageW, MSG, MSLLHOOKSTRUCT, PM_REMOVE, WH_MOUSE_LL,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MOUSEHWHEEL, WM_MOUSEMOVE,
    WM_MOUSEWHEEL, WM_NULL, WM_QUIT, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_XBUTTONDOWN, WM_XBUTTONUP,
    XBUTTON1, XBUTTON2,
};

const MOVE_MIN_INTERVAL_MS: u64 = 12;
const MOVE_MIN_DISTANCE: i32 = 3;
const LLMHF_INJECTED: u32 = 0x0000_0001;
const LLMHF_LOWER_IL_INJECTED: u32 = 0x0000_0002;

pub struct Recorder {
    recording: AtomicBool,
    paused: AtomicBool,
    events: Mutex<Vec<MouseEvent>>,
    started_at: Mutex<Option<Instant>>,
    paused_at: Mutex<Option<Instant>>,
    total_paused: Mutex<Duration>,
    time_offset: Mutex<u64>,
    last_move: Mutex<Option<(Instant, i32, i32)>>,
    hook_thread: Mutex<Option<JoinHandle<()>>>,
    hook_thread_id: AtomicU32,
    event_tx: Mutex<Option<Sender<MouseEvent>>>,
    app: OnceCell<AppHandle>,
}

impl Recorder {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            recording: AtomicBool::new(false),
            paused: AtomicBool::new(false),
            events: Mutex::new(Vec::new()),
            started_at: Mutex::new(None),
            paused_at: Mutex::new(None),
            total_paused: Mutex::new(Duration::ZERO),
            time_offset: Mutex::new(0),
            last_move: Mutex::new(None),
            hook_thread: Mutex::new(None),
            hook_thread_id: AtomicU32::new(0),
            event_tx: Mutex::new(None),
            app: OnceCell::new(),
        })
    }

    pub fn set_app(&self, app: AppHandle) {
        let _ = self.app.set(app);
    }

    pub fn is_recording(&self) -> bool {
        self.recording.load(Ordering::SeqCst)
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    pub fn pause(&self) -> Result<(), String> {
        if !self.is_recording() {
            return Err("Not recording".into());
        }
        if self.paused.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        *self.paused_at.lock() = Some(Instant::now());
        Ok(())
    }

    pub fn resume(&self) -> Result<(), String> {
        if !self.is_recording() {
            return Err("Not recording".into());
        }
        if !self.paused.swap(false, Ordering::SeqCst) {
            return Ok(());
        }
        if let Some(at) = self.paused_at.lock().take() {
            *self.total_paused.lock() += at.elapsed();
        }
        Ok(())
    }

    pub fn event_count(&self) -> usize {
        self.events.lock().len()
    }

    pub fn clear_events(&self) {
        self.events.lock().clear();
        *self.last_move.lock() = None;
    }

    pub fn snapshot_events(&self) -> Vec<MouseEvent> {
        self.events.lock().clone()
    }

    fn elapsed_ms(&self) -> u64 {
        let started = match *self.started_at.lock() {
            Some(t) => t,
            None => return 0,
        };
        let mut elapsed = started.elapsed();
        elapsed = elapsed.saturating_sub(*self.total_paused.lock());
        if self.paused.load(Ordering::SeqCst) {
            if let Some(at) = *self.paused_at.lock() {
                elapsed = elapsed.saturating_sub(at.elapsed());
            }
        }
        elapsed.as_millis() as u64 + *self.time_offset.lock()
    }

    /// Safe to call from the low-level hook: only memory ops, never emit/IPC.
    fn push_event_from_hook(&self, event: MouseEvent) {
        self.events.lock().push(event.clone());
        if let Some(tx) = self.event_tx.lock().as_ref() {
            let _ = tx.send(event);
        }
    }

    pub fn start(self: &Arc<Self>, clear_existing: bool, time_offset_ms: u64) -> Result<(), String> {
        if self.recording.swap(true, Ordering::SeqCst) {
            return Err("Already recording".into());
        }

        if clear_existing {
            self.clear_events();
        }
        self.paused.store(false, Ordering::SeqCst);
        *self.paused_at.lock() = None;
        *self.total_paused.lock() = Duration::ZERO;
        *self.time_offset.lock() = time_offset_ms;
        *self.started_at.lock() = Some(Instant::now());

        #[cfg(windows)]
        {
            let (tx, rx) = mpsc::channel::<MouseEvent>();
            *self.event_tx.lock() = Some(tx);

            let this = Arc::clone(self);
            let handle = thread::spawn(move || {
                if let Err(err) = run_hook_loop(this, rx) {
                    eprintln!("mouse hook error: {err}");
                }
            });
            *self.hook_thread.lock() = Some(handle);
            Ok(())
        }

        #[cfg(not(windows))]
        {
            self.recording.store(false, Ordering::SeqCst);
            Err("Mouse recording is only supported on Windows".into())
        }
    }

    pub fn stop(&self) -> Vec<MouseEvent> {
        if !self.recording.swap(false, Ordering::SeqCst) {
            return self.snapshot_events();
        }

        self.paused.store(false, Ordering::SeqCst);
        *self.paused_at.lock() = None;
        *self.total_paused.lock() = Duration::ZERO;

        // Drop sender so the hook loop's recv side can finish draining.
        *self.event_tx.lock() = None;

        #[cfg(windows)]
        {
            let tid = self.hook_thread_id.load(Ordering::SeqCst);
            if tid != 0 {
                unsafe {
                    let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
                    let _ = PostThreadMessageW(tid, WM_NULL, WPARAM(0), LPARAM(0));
                }
            }
        }

        if let Some(handle) = self.hook_thread.lock().take() {
            // Avoid forever-block if something goes wrong.
            let done = Arc::new(AtomicBool::new(false));
            let done_flag = Arc::clone(&done);
            thread::spawn(move || {
                let _ = handle.join();
                done_flag.store(true, Ordering::SeqCst);
            });
            let deadline = Instant::now() + Duration::from_secs(2);
            while !done.load(Ordering::SeqCst) && Instant::now() < deadline {
                thread::sleep(Duration::from_millis(10));
            }
        }

        self.hook_thread_id.store(0, Ordering::SeqCst);
        self.snapshot_events()
    }

    fn should_record_move(&self, x: i32, y: i32) -> bool {
        let now = Instant::now();
        let mut last = self.last_move.lock();
        if let Some((t, lx, ly)) = *last {
            let dt = now.duration_since(t).as_millis() as u64;
            let dist = (x - lx).abs().max((y - ly).abs());
            if dt < MOVE_MIN_INTERVAL_MS && dist < MOVE_MIN_DISTANCE {
                return false;
            }
        }
        *last = Some((now, x, y));
        true
    }

    fn on_raw_event(&self, kind: RawKind, x: i32, y: i32, data: i32) {
        if !self.recording.load(Ordering::SeqCst) || self.paused.load(Ordering::SeqCst) {
            return;
        }
        let t = self.elapsed_ms();
        match kind {
            RawKind::Move => {
                if self.should_record_move(x, y) {
                    self.push_event_from_hook(MouseEvent::Move { t, x, y });
                }
            }
            RawKind::Down(button) => {
                self.push_event_from_hook(MouseEvent::Down { t, button, x, y });
            }
            RawKind::Up(button) => {
                self.push_event_from_hook(MouseEvent::Up { t, button, x, y });
            }
            RawKind::Wheel => {
                self.push_event_from_hook(MouseEvent::Wheel {
                    t,
                    delta: data,
                    x,
                    y,
                });
            }
        }
    }
}

enum RawKind {
    Move,
    Down(MouseButton),
    Up(MouseButton),
    Wheel,
}

static RECORDER_PTR: OnceCell<Arc<Recorder>> = OnceCell::new();

pub fn install_global_recorder(recorder: Arc<Recorder>) {
    let _ = RECORDER_PTR.set(recorder);
}

#[cfg(windows)]
fn run_hook_loop(recorder: Arc<Recorder>, rx: Receiver<MouseEvent>) -> Result<(), String> {
    unsafe {
        let tid = GetCurrentThreadId();
        recorder.hook_thread_id.store(tid, Ordering::SeqCst);

        let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(low_level_mouse_proc), None, 0)
            .map_err(|e| format!("SetWindowsHookExW failed: {e}"))?;

        let app = recorder.app.get().cloned();
        let mut msg = MSG::default();

        while recorder.recording.load(Ordering::SeqCst) {
            // Emit outside the hook callback to avoid deadlocking the UI / mouse input.
            if let Some(app) = &app {
                while let Ok(event) = rx.try_recv() {
                    let _ = app.emit("mouse-record-event", &event);
                }
            } else {
                while rx.try_recv().is_ok() {}
            }

            let ok = PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE);
            if ok.as_bool() {
                if msg.message == WM_QUIT {
                    break;
                }
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            } else {
                thread::sleep(Duration::from_millis(8));
            }
        }

        let _ = UnhookWindowsHookEx(hook);

        // Drain any remaining preview events without blocking.
        if let Some(app) = &app {
            while let Ok(event) = rx.try_recv() {
                let _ = app.emit("mouse-record-event", &event);
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
unsafe extern "system" fn low_level_mouse_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code >= 0 {
        let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
        let flags = info.flags;
        let injected = (flags & LLMHF_INJECTED) != 0 || (flags & LLMHF_LOWER_IL_INJECTED) != 0;
        if !injected {
            if let Some(recorder) = RECORDER_PTR.get() {
                let x = info.pt.x;
                let y = info.pt.y;
                let msg = wparam.0 as u32;
                match msg {
                    WM_MOUSEMOVE => recorder.on_raw_event(RawKind::Move, x, y, 0),
                    WM_LBUTTONDOWN => {
                        recorder.on_raw_event(RawKind::Down(MouseButton::Left), x, y, 0)
                    }
                    WM_LBUTTONUP => recorder.on_raw_event(RawKind::Up(MouseButton::Left), x, y, 0),
                    WM_RBUTTONDOWN => {
                        recorder.on_raw_event(RawKind::Down(MouseButton::Right), x, y, 0)
                    }
                    WM_RBUTTONUP => recorder.on_raw_event(RawKind::Up(MouseButton::Right), x, y, 0),
                    WM_MBUTTONDOWN => {
                        recorder.on_raw_event(RawKind::Down(MouseButton::Middle), x, y, 0)
                    }
                    WM_MBUTTONUP => {
                        recorder.on_raw_event(RawKind::Up(MouseButton::Middle), x, y, 0)
                    }
                    WM_XBUTTONDOWN | WM_XBUTTONUP => {
                        let hi = ((info.mouseData >> 16) & 0xffff) as u16;
                        let button = if hi == XBUTTON1 {
                            MouseButton::X1
                        } else if hi == XBUTTON2 {
                            MouseButton::X2
                        } else {
                            MouseButton::X1
                        };
                        if msg == WM_XBUTTONDOWN {
                            recorder.on_raw_event(RawKind::Down(button), x, y, 0);
                        } else {
                            recorder.on_raw_event(RawKind::Up(button), x, y, 0);
                        }
                    }
                    WM_MOUSEWHEEL | WM_MOUSEHWHEEL => {
                        let delta = ((info.mouseData >> 16) as i16) as i32;
                        recorder.on_raw_event(RawKind::Wheel, x, y, delta);
                    }
                    _ => {}
                }
            }
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}
