import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config, loaded straight from eslint-config-next's own flat exports.
 *
 * Do not reintroduce FlatCompat here. eslint-config-next 16 ships flat config
 * only, so routing it through @eslint/eslintrc's loader fails schema validation
 * — and the validator then crashes trying to JSON.stringify the self-
 * referential plugins.react object while formatting that failure, so the real
 * error never surfaces and no file is ever linted.
 */
const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "build/**", "public/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Carried over from the old .eslintrc.json, which ESLint 9 had been
      // silently ignoring ever since eslint.config.mjs was added.
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",

      // New in eslint-plugin-react-hooks 7, which arrived with the Next 16
      // upgrade. Flags a synchronous setState inside an effect as a cascading
      // render. Real signal, but it lands on 26 files at once — mostly SSR
      // fallback branches and fetch-then-set — so it is a warning to burn down
      // rather than a wall that blocks every lint run.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
