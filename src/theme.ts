import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1B6B4A",
      light: "#3D8F6A",
      dark: "#0F4A32",
    },
    secondary: {
      main: "#2C3E50",
    },
    background: {
      default: "#F3F5F4",
      paper: "#FFFFFF",
    },
    divider: "rgba(15, 40, 30, 0.08)",
    text: {
      primary: "#15231C",
      secondary: "#5A6B62",
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Segoe UI Variable", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    h5: { fontWeight: 650, letterSpacing: "-0.02em" },
    h6: { fontWeight: 600, letterSpacing: "-0.01em" },
    button: { textTransform: "none", fontWeight: 600, lineHeight: 1.5 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          height: "100vh",
          overflow: "hidden",
          background:
            "radial-gradient(1200px 600px at 10% -10%, #D9EFE4 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #E7EDF5 0%, transparent 50%), #F3F5F4",
        },
        "#root": {
          height: "100vh",
          overflow: "hidden",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(15, 40, 30, 0.08)",
          boxShadow: "0 8px 28px rgba(21, 35, 28, 0.06)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "none",
          minHeight: 36,
          lineHeight: 1.5,
          whiteSpace: "nowrap",
          "&:hover": { boxShadow: "none" },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        InputLabelProps: { shrink: true },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

export default theme;
