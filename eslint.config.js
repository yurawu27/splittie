import globals from "globals";
import pluginJs from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      prettier: prettierPlugin, // add the Prettier plugin for code formatting
    },
    rules: {
      ...prettierConfig.rules, // disable rules that conflict with Prettier
      "prettier/prettier": "error", // prettier errors are now linting errors
      semi: ["error", "always"],
      "no-var": ["error"],
      "prefer-const": [
        "error",
        { destructuring: "any", ignoreReadBeforeAssign: false },
      ],
      curly: ["error"],
      eqeqeq: ["error"],
      "no-lone-blocks": ["error"],
      "no-self-compare": ["error"],
      "no-unused-expressions": ["error"],
      "no-useless-call": ["error"],
      "no-use-before-define": ["error"],
      camelcase: ["error", { properties: "never" }],
      "no-lonely-if": ["error"],
      "no-console": ["off"],
    },
  },
  pluginJs.configs.recommended,
];
