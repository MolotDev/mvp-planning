import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
      <Toaster position="bottom-right" toastOptions={{ duration: 5000 }} />
    </HashRouter>
  </StrictMode>,
);
