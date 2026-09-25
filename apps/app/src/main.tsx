import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { KonstaProvider } from "konsta/react";
import { RouteProvider, ThemeProvider } from "@vanyshr/ui";
import App from "./App";
import { BetaModalProvider } from "./components/BetaModalContext";
import { DevToolbar } from "./components/DevToolbar";
import "./index.css";

const appTree = (
    <KonstaProvider theme="ios" dark={false}>
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
    </KonstaProvider>
);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        {appTree}
        {/* Fixed-position overlay, not a layout wrapper — see DevToolbar.tsx for why. */}
        {import.meta.env.DEV && <DevToolbar />}
    </StrictMode>,
);
