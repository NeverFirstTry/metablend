import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // a variable used but never defined fails lint (Next's preset leaves this
  // out; 2026-11-01 a deleted variable still used on one line reached production)
  { rules: { "no-undef": "error" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // third-party files served as they were published (Leaflet)
    "public/vendor/**",
    // native projects: Gradle / Xcode output and the shell's own dependencies
    "mobile/**/build/**",
    "mobile/node_modules/**",
    "mobile/ios/App/App/public/**",
    "mobile/android/app/src/main/assets/**",
  ]),
]);

export default eslintConfig;
