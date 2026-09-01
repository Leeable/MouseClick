import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import type { AppStatus, LoopConfig } from "../types/macro";
import type { PlaybackSettings } from "../types/settings";

interface Props {
  status: AppStatus;
  loop: LoopConfig;
  loopIndex: number;
  eventIndex: number;
  eventCount: number;
  playback: PlaybackSettings;
  disabled?: boolean;
  onLoopChange: (loop: LoopConfig) => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onPauseRecord: () => void;
  onResumeRecord: () => void;
  onTogglePlay: () => void;
}

export default function ControlBar({
  status,
  loop,
  loopIndex,
  eventIndex,
  eventCount,
  playback,
  disabled,
  onLoopChange,
  onStartRecord,
  onStopRecord,
  onPauseRecord,
  onResumeRecord,
  onTogglePlay,
}: Props) {
  const recording = status === "recording";
  const paused = status === "paused";
  const playing = status === "playing";
  const busy = recording || paused;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            color="error"
            startIcon={<FiberManualRecordIcon />}
            disabled={disabled || playing || busy}
            onClick={onStartRecord}
          >
            开始录制
          </Button>
          {recording && (
            <Button variant="outlined" startIcon={<PauseIcon />} onClick={onPauseRecord}>
              暂停
            </Button>
          )}
          {paused && (
            <Button variant="outlined" startIcon={<PlayArrowIcon />} onClick={onResumeRecord}>
              继续
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<StopIcon />}
            disabled={disabled || !busy}
            onClick={onStopRecord}
          >
            停止录制
          </Button>
          <Button
            variant="contained"
            color={playing ? "warning" : "primary"}
            startIcon={playing ? <StopIcon /> : <PlayArrowIcon />}
            disabled={disabled || busy || eventCount === 0}
            onClick={onTogglePlay}
          >
            {playing ? "停止播放" : "播放"}
          </Button>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <FormControlLabel
            control={
              <Switch
                checked={loop.mode === "infinite"}
                disabled={disabled || playing}
                onChange={(_, checked) =>
                  onLoopChange({
                    mode: checked ? "infinite" : "count",
                    count: loop.count || 1,
                  })
                }
              />
            }
            label="无限循环"
          />
          <TextField
            size="small"
            type="number"
            label="循环次数"
            value={loop.count}
            disabled={disabled || playing || loop.mode === "infinite"}
            onChange={(e) => {
              const count = Math.max(1, Number(e.target.value) || 1);
              onLoopChange({ mode: "count", count });
            }}
            sx={{ width: 120 }}
            inputProps={{ min: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {playing
              ? `循环 ${loopIndex}${loop.mode === "infinite" ? " · ∞" : ""} · 事件 ${eventIndex}/${eventCount}`
              : `共 ${eventCount} 个事件`}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={`速度 ×${playback.speed}`} />
        {playback.startDelayMs > 0 && (
          <Chip size="small" variant="outlined" label={`播放前 ${playback.startDelayMs}ms`} />
        )}
        {playback.loopIntervalMs > 0 && (
          <Chip size="small" variant="outlined" label={`循环间隔 ${playback.loopIntervalMs}ms`} />
        )}
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
          Esc 紧急停止 · 可在设置中修改
        </Typography>
      </Stack>
    </Stack>
  );
}
