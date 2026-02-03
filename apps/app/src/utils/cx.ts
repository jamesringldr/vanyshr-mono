// Re-export cx utility from UI package
import { twMerge, type ClassNameValue } from "tailwind-merge";

export const cx = (...args: ClassNameValue[]) => twMerge(args);
