import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // native projects: Gradle / Xcode output and the shell's own dependencies
    "mobile/**/build/**",
    "mobile/node_modules/**",
    "mobile/ios/App/App/public/**",
    "mobile/android/app/src/main/assets/**",
  ]),
]);

export default eslintConfig;
