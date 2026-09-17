import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { KonstaProvider } from "konsta/react";
import { RouteProvider, ThemeProvider } from "@vanyshr/ui";
import App from "./App";
import { BetaModalProvider } from "./components/BetaModalContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        {/* Context-only provider (no wrapper element, so no app-wide font or
            layout change). dark={false}: Konsta never emits dark: classes —
            the .light class on the root is the only theme toggle. */}
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
    </StrictMode>,
);
