import { useEffect, useRef } from 'react';
import { cx } from '@/utils/cx';

/** Vanyshr input: h-[52px], rounded-xl, split opacity bg, optional icon left. */
export function EditInput({
    id,
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    icon: Icon,
    error,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    icon?: React.ElementType;
    error?: string;
}) {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        // Place cursor at end — not supported on type="email", number, etc.
        if (el.type === 'text' || el.type === 'search' || el.type === 'url' || el.type === 'tel' || el.type === 'password') {
            const len = el.value.length;
            el.setSelectionRange(len, len);
        }
    }, []);

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="block text-sm font-medium text-[#022136] dark:text-white"
            >
                {label}
            </label>
            <div className="relative">
                {Icon && (
                    <Icon
                        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)] dark:text-[#7A92A8] pointer-events-none"
                        aria-hidden
                    />
                )}
                <input
                    ref={ref}
                    id={id}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={cx(
                        "h-[52px] w-full rounded-xl border py-3 text-sm outline-none transition",
                        "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                        error
                            ? "border-red-500 dark:border-red-400"
                            : "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        "text-[#022136] dark:text-white placeholder:text-[var(--text-muted)] dark:placeholder:text-[#7A92A8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        Icon ? "pl-12 pr-4" : "px-4",
                    )}
                />
            </div>
            {error && (
                <p id={`${id}-error`} className="text-xs text-red-500 dark:text-red-400 mt-1">
                    {error}
                </p>
            )}
        </div>
    );
}
