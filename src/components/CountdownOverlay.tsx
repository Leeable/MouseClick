import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Fade from "@mui/material/Fade";

interface Props {
  open: boolean;
  seconds: number;
}

export default function CountdownOverlay({ open, seconds }: Props) {
  return (
    <Fade in={open}>
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1400,
          display: "grid",
          placeItems: "center",
          bgcolor: "rgba(15, 35, 28, 0.45)",
          backdropFilter: "blur(4px)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <Box sx={{ textAlign: "center", color: "#fff" }}>
          <Typography variant="h2" fontWeight={800} sx={{ fontSize: "6rem", lineHeight: 1 }}>
            {seconds}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.85, mt: 1 }}>
            录制即将开始…
          </Typography>
        </Box>
      </Box>
    </Fade>
  );
}
