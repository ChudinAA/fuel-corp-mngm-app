import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

window.addEventListener("error", (event) => {
  console.error("[GlobalError]", event.message, event.filename, event.lineno, event.colno, event.error?.stack);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[UnhandledRejection]", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
