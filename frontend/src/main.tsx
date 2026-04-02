import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";


// @ts-expect-error Telegram WebApp
window.Telegram?.WebApp?.ready();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);