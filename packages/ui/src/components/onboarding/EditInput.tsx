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
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    icon?: React.ElementType;
}) {
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
                    id={id}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cx(
                        "h-[52px] w-full rounded-xl border py-3 text-sm outline-none transition",
                        "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        "text-[#022136] dark:text-white placeholder:text-[var(--text-muted)] dark:placeholder:text-[#7A92A8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        Icon ? "pl-12 pr-4" : "px-4",
                    )}
                />
            </div>
        </div>
    );
}
