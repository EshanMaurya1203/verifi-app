// Flat ESLint configuration for Next.js 15+
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Relax low-priority rules to 'warn' for MVP friction reduction
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-require-imports": "warn",
      
      // Preserve production-critical safety rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "@next/next/no-img-element": "warn"
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "scratch/**",
      "scripts/**",
      ".gemini/**",
      "replace.js",
      "next-env.d.ts",
    ],
  }
];

export default eslintConfig;
