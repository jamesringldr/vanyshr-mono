import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

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

// No DOM side effects: the .light class on the root is the only theme toggle
// (DESIGN.md §12.4), and color-scheme follows it in globals.css.
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
    const [theme] = useState<Theme>("dark");

    return <ThemeContext.Provider value={{ theme, setTheme: () => {} }}>{children}</ThemeContext.Provider>;
};
