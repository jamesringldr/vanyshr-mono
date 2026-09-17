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
            <>
                {/* h-screen + a transform: Konsta's <Page> is `position: absolute;
                    height: 100%` and pages routinely add their own `position: fixed`
                    footers/sheets — both resolve against the nearest transformed
                    ancestor's box instead of the true viewport (CSS containing-block
                    rule), so this div, not the browser window, becomes their "100vh".
                    That keeps the app pixel-identical to production and confines its
                    fixed elements above the bar instead of bleeding behind it. The
                    page then grows taller than one viewport and the browser's own
                    scroll (not an inner overflow) reveals the bar below. */}
                <div className="h-screen [transform:translateZ(0)]">{appTree}</div>
                <DevToolbar />
            </>
        ) : (
            appTree
        )}
    </StrictMode>,
);
