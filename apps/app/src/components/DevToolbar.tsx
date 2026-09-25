import { useEffect, useState } from "react";
import { Moon, Sun, X } from "lucide-react";
import { isDisconnectedMode } from "@/lib/env";

const STORAGE_KEY = "dev-theme-override";
type ThemeOverride = "light" | "dark";

function applyTheme(theme: ThemeOverride) {
    const root = document.documentElement;
    // This worktree: :root default is dark, .light is the override class (not .dark-mode).
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
}

/**
 * Fixed-position overlay, not real layout — a page-flow strip fought Konsta's
 * <Page> (position: absolute; height: 100%) and per-page fixed footers/sheets,
 * which resolve against the true viewport and need a transformed ancestor to
 * be contained, producing a "scroll the wrapper to scroll the page" double
 * scrollbar. An overlay sidesteps that entirely: it never touches app layout,
 * so nothing here can regress on promotion to staging/prod.
 */
export function DevToolbar() {
    const [open, setOpen] = useState(false);
    const [theme, setThemeState] = useState<ThemeOverride>(() => {
        try {
            return (localStorage.getItem(STORAGE_KEY) as ThemeOverride | null) ?? "dark";
        } catch {
            return "dark";
        }
    });

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const setTheme = (next: ThemeOverride) => {
        setThemeState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // localStorage unavailable (private window); theme still applies for this load.
        }
    };

    const disconnected = isDisconnectedMode();
    const statusColor = disconnected ? "bg-status-warn" : "bg-status-success";

    if (!open) {
        return (
            // Hit area (w-6) is deliberately bigger than the visible sliver inside
            // it (w-1.5) -- a 6px-wide button is nearly impossible to hover/click
            // precisely; group-hover on this wrapper still grows the visible bar.
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Dev tools"
                aria-label="Open dev tools"
                className="group fixed left-0 top-1/2 z-50 flex h-24 w-6 -translate-y-1/2 items-center"
            >
                <span className={`h-16 w-1.5 rounded-r-full transition-all group-hover:w-3 ${statusColor}`} />
            </button>
        );
    }

    return (
        <div className="fixed left-0 top-1/2 z-50 -translate-y-1/2">
            <div className="flex w-44 flex-col gap-3 rounded-r-xl border border-border bg-elevated p-3 text-text-primary shadow-xl">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Dev</span>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Close dev tools"
                        className="text-text-tertiary hover:text-text-primary"
                    >
                        <X size={14} />
                    </button>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-app p-1">
                    <button
                        type="button"
                        onClick={() => setTheme("light")}
                        aria-pressed={theme === "light"}
                        title="Light mode (dev only)"
                        className={`flex-1 rounded-full p-1.5 transition-colors ${
                            theme === "light" ? "bg-white text-status-warn" : "text-text-tertiary hover:text-text-primary"
                        }`}
                    >
                        <Sun size={16} className="mx-auto" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        aria-pressed={theme === "dark"}
                        title="Dark mode (dev only)"
                        className={`flex-1 rounded-full p-1.5 transition-colors ${
                            theme === "dark" ? "bg-white text-primary" : "text-text-tertiary hover:text-text-primary"
                        }`}
                    >
                        <Moon size={16} className="mx-auto" />
                    </button>
                </div>
                <span
                    title="Set at dev server startup — edit VITE_DEV_MODE in apps/app/.env.local and restart to change"
                    className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                        disconnected
                            ? "bg-status-warn-muted text-status-warn"
                            : "bg-status-success-muted text-status-success"
                    }`}
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                    {disconnected ? "Disconnected" : "Connected"}
                </span>
            </div>
        </div>
    );
}
