// ESLint flat config. Run from frontend/:
//   PATH="/usr/local/opt/node@22/bin:$PATH" npm run lint
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/"] },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  {
    settings: { react: { version: "detect" } },
    languageOptions: { globals: globals.browser },
  },
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // No TypeScript and no PropTypes in this codebase.
      "react/prop-types": "off",
    },
  },
];
