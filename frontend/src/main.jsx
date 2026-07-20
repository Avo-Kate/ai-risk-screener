import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
// theme.css owns the design tokens, the Tailwind import and the base layer.
// It is the only stylesheet in the app — everything else is a utility class.
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
