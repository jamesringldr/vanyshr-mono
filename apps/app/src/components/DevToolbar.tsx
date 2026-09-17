import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { isDisconnectedMode } from "@/lib/env";

const STORAGE_KEY = "dev-theme-override";
type ThemeOverride = "light" | "dark";

function applyTheme(theme: ThemeOverride) {
    const root = document.documentElement;
    // This worktree: :root default is dark, .light is the override class (not .dark-mode).
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
}

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
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-700 bg-gray-600 px-4 py-2 text-white">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">Dev</span>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-full bg-gray-700 p-1">
                    <button
                        type="button"
                        onClick={() => setTheme("light")}
                        aria-pressed={theme === "light"}
                        title="Light mode (dev only)"
                        className={`rounded-full p-1.5 transition-colors ${
                            theme === "light" ? "bg-white text-amber-500" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        <Sun size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        aria-pressed={theme === "dark"}
                        title="Dark mode (dev only)"
                        className={`rounded-full p-1.5 transition-colors ${
                            theme === "dark" ? "bg-white text-indigo-600" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        <Moon size={16} />
                    </button>
                </div>
                <span
                    title="Set at dev server startup — edit VITE_DEV_MODE in apps/app/.env.local and restart to change"
                    className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                        disconnected
                            ? "bg-amber-500/25 text-amber-100"
                            : "bg-green-500/25 text-green-100"
                    }`}
                >
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${
                            disconnected ? "bg-amber-400" : "bg-green-400"
                        }`}
                    />
                    {disconnected ? "Disconnected" : "Connected"}
                </span>
            </div>
        </div>
    );
}
