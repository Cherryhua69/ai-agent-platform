import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/providers";
import { logoUrl } from "./assets/brand";
import "./styles/globals.css";

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/png";
favicon.href = logoUrl;
if (!favicon.parentNode) {
  document.head.appendChild(favicon);
}

if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === "true") {
  const { worker } = await import("./lib/mock/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);
