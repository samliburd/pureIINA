// import "../shared.scss";
import React from "react";
import { createRoot } from "react-dom/client"; // Import from client
import App from "./app.jsx";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(<App />);
