import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { RouteProvider, ThemeProvider } from "@vanyshr/ui";
import App from "./App";
import { BetaModalProvider } from "./components/BetaModalContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <RouteProvider>
                    <BetaModalProvider>
                        <Routes>
                            <Route path="/*" element={<App />} />
                        </Routes>
                    </BetaModalProvider>
                </RouteProvider>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
