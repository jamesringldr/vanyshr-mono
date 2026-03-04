import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { Menu } from "lucide-react";

/**
 * Top navigation bar for unauthenticated pages.
 * Hamburger is a visual placeholder — no drawer or dropdown attached.
 */
export function UnauthNav() {
    return (
        <header className="w-full flex items-center justify-between px-6 h-14 shrink-0">
            <img
                src={PrimaryLogoDark}
                alt="Vanyshr"
                className="h-10 w-auto"
            />
            <button
                type="button"
                aria-label="Open menu"
                className="p-2 cursor-pointer"
            >
                <Menu className="w-6 h-6" aria-hidden />
            </button>
        </header>
    );
}
