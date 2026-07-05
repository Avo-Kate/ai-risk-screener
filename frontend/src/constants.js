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

// Visual mapping for risk / severity / likelihood badges.
export const LEVEL_CLASS = {
  low: "level-low",
  medium: "level-medium",
  high: "level-high",
  unacceptable: "level-unacceptable",
};

export const APPLICABILITY_CLASS = {
  applies: "apply-yes",
  "partially applies": "apply-partial",
  "does not apply": "apply-no",
};
