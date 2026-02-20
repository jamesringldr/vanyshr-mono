import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);

    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }

    return context;
};

interface ThemeProviderProps {
    children: ReactNode;
    /**
     * The class to add to the root element when the theme is dark
     * @default "dark-mode"
     */
    darkModeClass?: string;
    /**
     * The default theme to use if no theme is stored in localStorage
     * @default "system"
     */
    defaultTheme?: Theme;
    /**
     * The key to use to store the theme in localStorage
     * @default "ui-theme"
     */
    storageKey?: string;
}

export const ThemeProvider = ({ children, darkModeClass = "dark-mode" }: ThemeProviderProps) => {
    const [theme] = useState<Theme>("dark");

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light-forced");
        root.classList.add(darkModeClass);
        root.style.colorScheme = "dark";
    }, [darkModeClass]);

    return <ThemeContext.Provider value={{ theme, setTheme: () => {} }}>{children}</ThemeContext.Provider>;
};
