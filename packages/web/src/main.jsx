import React from "react";
import { createRoot } from "react-dom/client";
import { initializeCrypto } from "./crypto";
import App from "./App.jsx";
import "./styles.css";

const root = createRoot(document.getElementById("root"));
root.render(<div className="minimal-empty">Loading cryptography...</div>);
initializeCrypto()
  .then(() =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  )
  .catch((error) => {
    root.render(
      <div className="minimal-empty">
        Cryptography could not load. Refresh to retry.
        <code>{error.message}</code>
      </div>,
    );
  });
