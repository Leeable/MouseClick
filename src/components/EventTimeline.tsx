import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MouseOutlinedIcon from "@mui/icons-material/MouseOutlined";
import NearMeOutlinedIcon from "@mui/icons-material/NearMeOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import SwapVertOutlinedIcon from "@mui/icons-material/SwapVertOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { useState } from "react";
import type { MouseEvent as MacroMouseEvent } from "../types/macro";
import MacroStatsBar from "./MacroStatsBar";

interface Props {
  events: MacroMouseEvent[];
  highlightIndex?: number;
  editable?: boolean;
  onChange?: (events: MacroMouseEvent[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

function labelOf(event: MacroMouseEvent): string {
  switch (event.type) {
    case "move":
      return `移动 → (${event.x}, ${event.y})`;
    case "down":
      return `按下 ${event.button} @ (${event.x}, ${event.y})`;
    case "up":
      return `抬起 ${event.button} @ (${event.x}, ${event.y})`;
    case "wheel":
      return `滚轮 ${event.delta > 0 ? "+" : ""}${event.delta} @ (${event.x}, ${event.y})`;
    case "delay":
      return `等待 ${event.ms} ms`;
  }
}

function iconOf(event: MacroMouseEvent) {
  switch (event.type) {
    case "move":
      return <NearMeOutlinedIcon fontSize="small" />;
    case "down":
    case "up":
      return <TouchAppOutlinedIcon fontSize="small" />;
    case "wheel":
      return <SwapVertOutlinedIcon fontSize="small" />;
    case "delay":
      return <TimerOutlinedIcon fontSize="small" />;
  }
}

export default function EventTimeline({
  events,
  highlightIndex = -1,
  editable,
  onChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const [hideMoves, setHideMoves] = useState(false);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [delayMs, setDelayMs] = useState(500);

  const visibleEvents = hideMoves
    ? events.map((e, i) => ({ e, i })).filter(({ e }) => e.type !== "move")
    : events.map((e, i) => ({ e, i }));

  const handleDelete = (index: number) => {
    if (!onChange) return;
    onChange(events.filter((_, i) => i !== index));
  };

  const handleInsertDelay = () => {
    if (!onChange) return;
    const lastT = events.length > 0 ? events[events.length - 1].t : 0;
    const ms = Math.max(0, delayMs);
    onChange([...events, { t: lastT + ms, type: "delay", ms }]);
    setDelayDialogOpen(false);
  };

  const handleClear = () => {
    if (!onChange || events.length === 0) return;
    if (window.confirm("确定清空所有事件？")) onChange([]);
  };

  if (events.length === 0) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "text.secondary",
          px: 4,
          textAlign: "center",
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <MouseOutlinedIcon sx={{ fontSize: 42, opacity: 0.45 }} />
          <Typography variant="h6">尚未录制事件</Typography>
          <Typography variant="body2" maxWidth={360}>
            选择一个宏，按快捷键或下方按钮开始录制。可在设置中配置追加模式、倒计时与播放速度。
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack sx={{ height: "100%" }} spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle1" fontWeight={700}>
          事件时间线
        </Typography>
        <Chip size="small" label={`${events.length} 条`} />
        <FormControlLabel
          sx={{ ml: "auto" }}
          control={
            <Switch
              size="small"
              checked={hideMoves}
              onChange={(_, checked) => setHideMoves(checked)}
            />
          }
          label={<Typography variant="caption">隐藏移动</Typography>}
        />
        {editable && (
          <>
            <Tooltip title="撤销">
              <span>
                <IconButton size="small" disabled={!canUndo} onClick={onUndo}>
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="重做">
              <span>
                <IconButton size="small" disabled={!canRedo} onClick={onRedo}>
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Button size="small" onClick={() => setDelayDialogOpen(true)}>
              插入延迟
            </Button>
            <Tooltip title="清空事件">
              <IconButton size="small" onClick={handleClear}>
                <ClearAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>

      <MacroStatsBar events={events} />

      <List dense sx={{ flex: 1, overflow: "auto", py: 0 }}>
        {visibleEvents.map(({ e: event, i: index }) => (
          <ListItem
            key={`${event.t}-${index}`}
            secondaryAction={
              editable ? (
                <IconButton edge="end" size="small" onClick={() => handleDelete(index)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              ) : undefined
            }
            sx={{
              borderRadius: 2,
              mb: 0.25,
              bgcolor: index === highlightIndex ? "action.selected" : "transparent",
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{iconOf(event)}</ListItemIcon>
            <ListItemText
              primary={labelOf(event)}
              secondary={`+${event.t} ms`}
              primaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
            />
          </ListItem>
        ))}
      </List>

      <Dialog open={delayDialogOpen} onClose={() => setDelayDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>插入延迟</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            type="number"
            label="延迟毫秒"
            value={delayMs}
            inputProps={{ min: 0 }}
            onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelayDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleInsertDelay}>
            插入
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
