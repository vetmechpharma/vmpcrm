import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for PWA - different SW per app
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (window.location.pathname.startsWith('/mrvet')) {
      // MR app SW is registered by usePWA hook in MRLayout
    } else {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  });
}
