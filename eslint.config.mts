import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
	// --------------------------------------------------
	// Global ignores
	// --------------------------------------------------
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.next/**",
			"**/coverage/**",
			"**/.turbo/**",
			"**/build/**",
			"**/*.tsbuildinfo",

			// Generated Prisma client
			"packages/database/generated/**",

			// Environment files
			"**/.env",
			"**/.env.*",
			"!**/.env.example",
			"!**/.env.*.example",

			// AI/editor generated files
			"**/.agents/**",
			"**/.claude/**",
			"**/.windsurf/**",
		],
	},

	// --------------------------------------------------
	// JavaScript
	// --------------------------------------------------
	{
		files: ["**/*.{js,mjs,cjs}"],

		extends: [js.configs.recommended],

		languageOptions: {
			globals: globals.node,
		},

		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},

	// --------------------------------------------------
	// TypeScript
	// --------------------------------------------------
	{
		files: ["**/*.{ts,mts,cts}"],

		extends: [js.configs.recommended, ...tseslint.configs.recommended],

		languageOptions: {
			globals: globals.node,
		},
	},

	{
		files: ["**/*.{ts,mts,cts}"],

		extends: [js.configs.recommended, ...tseslint.configs.recommended],

		languageOptions: {
			globals: globals.node,
		},

		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
]);
