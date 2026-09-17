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
        {import.meta.env.DEV ? (
            <div className="flex h-screen flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto">{appTree}</div>
                <DevToolbar />
            </div>
        ) : (
            appTree
        )}
    </StrictMode>,
);
