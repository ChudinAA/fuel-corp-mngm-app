import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ResizeObserver loop notifications are harmless browser warnings,
// but Vite dev overlay incorrectly treats them as runtime errors.
// We intercept and suppress them before Vite's plugin can show the overlay.
const suppressResizeObserverError = (e: ErrorEvent) => {
  if (
    e.message === "ResizeObserver loop completed with undelivered notifications." ||
    e.message === "ResizeObserver loop limit exceeded"
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
};
window.addEventListener("error", suppressResizeObserverError, true);

createRoot(document.getElementById("root")!).render(<App />);
