import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { isDisconnectedMode } from "@/lib/env";

const STORAGE_KEY = "dev-theme-override";
type ThemeOverride = "light" | "dark";

function applyTheme(theme: ThemeOverride) {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", theme === "dark");
    root.style.colorScheme = theme;
}

/**
 * Dev-only bottom banner: local light/dark override (separate from the
 * app-wide ThemeProvider, which stays forced-dark in production) and a
 * read-only Connected/Disconnected badge reflecting the choice made at
 * `pnpm dev` startup. Solid grey and full-width on purpose — it should never
 * be mistaken for app UI, and its edge marks where the real page ends.
 * Mounted only when import.meta.env.DEV is true, so it's dead-code-eliminated
 * from every built bundle (staging preview and prod).
 *
 * Rendered as a sibling AFTER <ThemeProvider> in main.tsx (not nested inside
 * it) so this effect runs after ThemeProvider's own mount effect, which
 * unconditionally forces dark-mode on mount and would otherwise stomp a
 * saved "light" preference.
 */
export function DevToolbar() {
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

    return (
        <div className="fixed inset-x-0 bottom-0 z-[9999] flex items-center justify-between gap-3 border-t border-black/20 bg-gray-500 px-4 py-2 text-white shadow-[0_-2px_8px_rgba(0,0,0,0.2)]">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Dev</span>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-full bg-black/15 p-1">
                    <button
                        type="button"
                        onClick={() => setTheme("light")}
                        aria-pressed={theme === "light"}
                        title="Light mode (dev only)"
                        className={`rounded-full p-1.5 ${theme === "light" ? "bg-white text-yellow-600" : "text-white/60"}`}
                    >
                        <Sun size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        aria-pressed={theme === "dark"}
                        title="Dark mode (dev only)"
                        className={`rounded-full p-1.5 ${theme === "dark" ? "bg-white text-indigo-600" : "text-white/60"}`}
                    >
                        <Moon size={16} />
                    </button>
                </div>
                <span
                    title="Set at dev server startup — edit VITE_DEV_MODE in apps/app/.env.local and restart to change"
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        disconnected ? "bg-amber-400/25 text-amber-100" : "bg-green-400/25 text-green-100"
                    }`}
                >
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${disconnected ? "bg-amber-300" : "bg-green-300"}`}
                    />
                    {disconnected ? "Disconnected" : "Connected"}
                </span>
            </div>
        </div>
    );
}
