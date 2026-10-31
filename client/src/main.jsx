import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/space-grotesk";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AccountProvider } from "./lib/account";
import { PreferencesProvider } from "./lib/preferences";

ReactDOM.createRoot(document.getElementById("root")).render(
  <PreferencesProvider>
    <AccountProvider>
      <App />
    </AccountProvider>
  </PreferencesProvider>
);
