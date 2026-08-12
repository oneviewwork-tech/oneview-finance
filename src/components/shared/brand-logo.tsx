import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-4xl",
};

// "Haris&Co." wordmark — rounded geometric bold type (Fredoka), matching the
// real harisand.co brand mark: single line, tight kerning, no space around
// the ampersand or before the trailing period. Pure typography, no container
// — color is inherited via `currentColor` so callers control placement on
// light or dark surfaces (e.g. className="text-white" on a dark panel).
//
// Kept byte-identical to ONEVIEW People's BrandLogo so the two apps present
// the same lockup; if the brand mark changes, change it in both.
export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <span className={cn("font-brand font-semibold tracking-tight", SIZES[size], className)}>
      Haris&amp;Co.
    </span>
  );
}
