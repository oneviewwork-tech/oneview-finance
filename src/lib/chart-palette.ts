// Categorical palette for identity charts — fixed hue order (blue, aqua,
// yellow, green, violet, red, magenta, orange), the dataviz skill's
// validated reference instance (light-mode worst-adjacent CVD ΔE 24.2).
// Reused verbatim from the sibling ONEVIEW People app for visual
// consistency across the ecosystem — never cycled/reordered.
export const CATEGORICAL_PALETTE = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#e87ba4",
  "#eb6834",
];

// Reserved status colors — matches this app's success/warning/destructive
// tokens (globals.css). Never reused for categorical identity.
export const STATUS_CHART_COLORS = {
  PAID: "#22c55e",
  PARTIAL: "#f59e0b",
  PENDING: "#ef4444",
};
