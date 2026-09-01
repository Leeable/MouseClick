import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { computeMacroStats, formatDuration } from "../lib/macroStats";
import type { MouseEvent } from "../types/macro";

interface Props {
  events: MouseEvent[];
}

export default function MacroStatsBar({ events }: Props) {
  const stats = computeMacroStats(events);

  if (events.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Chip size="small" label={`时长 ${formatDuration(stats.durationMs)}`} />
      <Chip size="small" variant="outlined" label={`${stats.total} 事件`} />
      <Chip size="small" variant="outlined" label={`${stats.moves} 移动`} />
      <Chip size="small" variant="outlined" label={`${stats.clicks} 点击`} />
      <Chip size="small" variant="outlined" label={`${stats.wheels} 滚轮`} />
      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
        双击事件由两次点击间隔自然还原
      </Typography>
    </Stack>
  );
}
