module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:storybook/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["react-refresh", "@typescript-eslint"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
  },
  overrides: [
    {
      // Scripts directory - treat as ES modules
      files: ["scripts/**/*.js"],
      env: {
        node: true,
        es2022: true,
      },
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
      rules: {
        // Allow console.log in scripts
        "no-console": "off",
        // Allow require in scripts if needed
        "@typescript-eslint/no-var-requires": "off",
      },
    },
    {
      // TypeScript files
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  ],
  ignorePatterns: [
    "dist",
    "node_modules",
    "storybook-static",
    "build",
    "*.config.js",
    "*.config.ts",
  ],
};
