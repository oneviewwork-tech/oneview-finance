// Categorical palette for identity charts — fixed hue order, never cycled or
// reordered. The order IS the colourblind-safety mechanism, not cosmetic:
// slots are sequenced so that adjacent pairs stay separable.
//
// Verified with the dataviz validator (light mode, surface #fcfcfb):
//   Lightness band PASS · Chroma floor PASS
//   CVD separation PASS  — worst adjacent ΔE 9.1 (protan)
//   Normal-vision   PASS — worst adjacent ΔE 19.6
//
// A previous ordering here (blue, aqua, yellow, green, violet, red, magenta,
// orange) carried a comment claiming ΔE 24.2; it actually FAILED the
// normal-vision floor, putting magenta next to orange at ΔE 12.9. Re-run
// `scripts/validate_palette.js` before changing this array.
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
];

// Reserved status colors — matches this app's success/warning/destructive
// tokens (globals.css). Never reused for categorical identity.
export const STATUS_CHART_COLORS = {
  PAID: "#22c55e",
  PARTIAL: "#f59e0b",
  PENDING: "#ef4444",
};
