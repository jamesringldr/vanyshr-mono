// Re-export cx utility from UI package
import { extendTailwindMerge, type ClassNameValue } from "tailwind-merge";

// "data" is the text-data type-role size (theme.css); without this, twMerge
// reads text-data as a text color and drops it next to text-text-* classes.
const twMerge = extendTailwindMerge({ extend: { theme: { text: ["data"] } } });

export const cx = (...args: ClassNameValue[]) => twMerge(args);
