import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider } from "./components/ui";
import { initSync } from "./lib/sync";
import { initUpdates } from "./lib/updates";
import "./styles.css";
import { applyAccent, applyTheme } from "./lib/theme";
import { initMigrations } from "./lib/migrate";
import { initAppIcon } from "./lib/appicon";

applyAccent();
applyTheme();
initSync();
initMigrations();
initAppIcon();
initUpdates();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>,
);
