import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import { cx } from "@/utils/cx";

interface GeoapifyResult {
    formatted: string;
}

export function AddressAutocomplete({
    id,
    value,
    onChange,
}: {
    id: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const [suggestions, setSuggestions] = useState<GeoapifyResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (value.length < 3) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(value)}&limit=6&filter=countrycode:us&format=json&apiKey=${import.meta.env.VITE_GEOAPIFY_API_KEY}`,
                );
                const data = await res.json();
                const addresses = (data.results ?? []) as GeoapifyResult[];
                setSuggestions(addresses);
                if (addresses.length > 0 && inputRef.current) {
                    const rect = inputRef.current.getBoundingClientRect();
                    setDropdownStyle({
                        position: "fixed",
                        top: rect.bottom + 4,
                        left: rect.left,
                        width: rect.width,
                    });
                    setIsOpen(true);
                }
            } catch {
                setSuggestions([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [value]);

    const handleSelect = (address: string) => {
        onChange(address);
        setSuggestions([]);
        setIsOpen(false);
    };

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="block text-sm font-medium text-[#022136] dark:text-white"
            >
                Address
            </label>
            <div className="relative">
                <MapPin
                    className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7A92A8] pointer-events-none"
                    aria-hidden
                />
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 150)}
                    placeholder="Start typing an address..."
                    autoComplete="off"
                    className={cx(
                        "h-[52px] w-full rounded-xl border py-3 pl-12 pr-4 text-sm outline-none transition",
                        "bg-[#022136]/50 dark:bg-[#022136]/50",
                        "border-[#2A4A68]",
                        "text-white placeholder:text-[#7A92A8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#022136]",
                    )}
                />
            </div>

            {isOpen && suggestions.length > 0 && createPortal(
                <div
                    style={dropdownStyle}
                    className="z-[9999] overflow-hidden rounded-xl border border-[#2A4A68] bg-[#2D3847] shadow-xl"
                >
                    {suggestions.map((s, i) => (
                        <button
                            key={`${s.formatted}-${i}`}
                            type="button"
                            onMouseDown={() => handleSelect(s.formatted)}
                            className={cx(
                                "flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition",
                                "border-b border-[#2A4A68] last:border-0",
                                "hover:bg-[#00BFFF]/10 active:bg-[#00BFFF]/20",
                            )}
                        >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#7A92A8]" aria-hidden />
                            <span className="text-white">{s.formatted}</span>
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </div>
    );
}
