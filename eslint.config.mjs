import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  // Flag console.log in application source (use devLog from @/utils/debug instead)
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // Allow console.log in the debug utility itself
  {
    files: ["src/utils/debug.js"],
    rules: {
      "no-console": "off",
    },
  },
];

export default eslintConfig;
