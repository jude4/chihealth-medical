import React from "react";
import ReactDOM from "react-dom/client";
// Fix: Add .tsx extension for explicit module resolution.
import App from "./App.tsx";
import "./index.css";
import { ToastProvider } from "./contexts/ToastContext.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
