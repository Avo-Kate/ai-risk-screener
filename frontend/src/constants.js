// Form option vocabularies. These must stay in sync with the Literal types in
// backend/app/schemas.py.

export const INDUSTRIES = [
  "healthcare",
  "finance",
  "HR/recruitment",
  "law enforcement",
  "education",
  "marketing",
  "other",
];

export const DEPLOYMENT_CONTEXTS = [
  "internal tool",
  "customer-facing",
  "public sector",
  "safety-critical",
];

export const DATA_TYPES = [
  "personal data",
  "sensitive personal data",
  "biometric data",
  "financial data",
  "health data",
  "none",
];

export const GEOGRAPHIC_SCOPES = ["EU", "US", "UK", "global"];

// -----------------------------------------------------------------------------
// Risk level presentation
// -----------------------------------------------------------------------------
// One place decides what each risk level looks like, so results, list rows, the
// dashboard and (Phase 4) the PDF can never disagree. The colours themselves are
// tokens in theme.css — see the "risk colours are a contract" note there.
//
// These are written as complete literal class strings on purpose: Tailwind scans
// source text for class names, so a constructed string like
// `bg-risk-${level}-bg` would produce no CSS at all.

/** Pill badge: soft tinted ground + readable foreground. */
export const RISK_BADGE = {
  low: "bg-risk-low-bg text-risk-low-fg",
  medium: "bg-risk-medium-bg text-risk-medium-fg",
  high: "bg-risk-high-bg text-risk-high-fg",
  unacceptable: "bg-risk-unacceptable-bg text-risk-unacceptable-fg",
};

/** Saturated fill, for meters, bars and charts. */
export const RISK_SOLID = {
  low: "bg-risk-low-solid",
  medium: "bg-risk-medium-solid",
  high: "bg-risk-high-solid",
  unacceptable: "bg-risk-unacceptable-solid",
};

/** Text colour on a plain surface. */
export const RISK_TEXT = {
  low: "text-risk-low-fg",
  medium: "text-risk-medium-fg",
  high: "text-risk-high-fg",
  unacceptable: "text-risk-unacceptable-solid",
};

/**
 * Raw hex values, mirroring the tokens in theme.css.
 *
 * Needed because @react-pdf/renderer (Phase 4) renders outside the browser and
 * cannot resolve CSS custom properties. Keep in step with theme.css whenever a
 * risk colour changes — same mirroring rule as schemas.py ↔ this file.
 */
export const RISK_HEX = {
  low: { bg: "#e6f4ea", fg: "#1e7d4f", solid: "#34a76b" },
  medium: { bg: "#fbf1dd", fg: "#95650b", solid: "#d99826" },
  high: { bg: "#fdeceb", fg: "#b42318", solid: "#e0533d" },
  unacceptable: { bg: "#5b1a14", fg: "#ffffff", solid: "#7a241c" },
};

/** Fallback used when the model returns an unexpected level string. */
export const RISK_FALLBACK = "medium";

/** How a framework's applicability verdict is shown. */
export const APPLICABILITY_BADGE = {
  applies: "bg-accent-soft text-accent",
  "partially applies": "bg-risk-medium-bg text-risk-medium-fg",
  "does not apply": "bg-sunken text-muted",
};
