import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import { useState } from "react";
import type { Macro } from "../types/macro";

interface Props {
  macros: Macro[];
  selectedId: string | null;
  recentFiles: string[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenRecent: (path: string) => void;
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

export default function MacroList({
  macros,
  selectedId,
  recentFiles,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onOpenRecent,
}: Props) {
  const [recentAnchor, setRecentAnchor] = useState<null | HTMLElement>(null);

  return (
    <Stack sx={{ height: "100%" }} spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle1" fontWeight={700}>
          宏列表
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="最近打开">
            <span>
              <IconButton
                size="small"
                disabled={recentFiles.length === 0}
                onClick={(e) => setRecentAnchor(e.currentTarget)}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button size="small" startIcon={<AddIcon />} onClick={onCreate}>
            新建
          </Button>
        </Stack>
      </Stack>

      <Menu
        anchorEl={recentAnchor}
        open={Boolean(recentAnchor)}
        onClose={() => setRecentAnchor(null)}
      >
        {recentFiles.map((path) => (
          <MenuItem
            key={path}
            onClick={() => {
              setRecentAnchor(null);
              onOpenRecent(path);
            }}
          >
            {basename(path)}
          </MenuItem>
        ))}
      </Menu>

      <List dense sx={{ flex: 1, overflow: "auto", py: 0 }}>
        {macros.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
            还没有宏。点击「新建」开始。
          </Typography>
        )}
        {macros.map((macro) => (
          <ListItemButton
            key={macro.id}
            selected={selectedId === macro.id}
            onClick={() => onSelect(macro.id)}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemText
              primary={macro.name}
              secondary={`${macro.events.length} 个事件${macro.filePath ? " · 已关联文件" : ""}`}
              primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
            />
            <Tooltip title="复制">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(macro.id);
                }}
              >
                <ContentCopyOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="重命名">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(macro.id);
                }}
              >
                <DriveFileRenameOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(macro.id);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItemButton>
        ))}
      </List>
    </Stack>
  );
}
