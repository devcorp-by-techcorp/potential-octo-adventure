import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@is/tokens";
import "@is/tokens/dist/css/index.css";
import "@/index.css";
import App from "@/App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
