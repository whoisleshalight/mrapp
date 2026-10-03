import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.scss";
import App from "./app/App";

createRoot(document.getElementById("app")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
