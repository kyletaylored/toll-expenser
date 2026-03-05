/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
	plugins: [react()],

	root: "frontend",

	build: {
		outDir: "../dist",
		emptyOutDir: true,
		sourcemap: true,
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
			},
		},
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-react": ["react", "react-dom"],
					"vendor-ui": ["@chakra-ui/react", "framer-motion"],
					"vendor-pdf": ["jspdf", "jspdf-autotable"],
					"vendor-utils": ["axios", "date-fns"],
				},
			},
		},
	},

	server: {
		port: 5174,
		proxy: {
			// In development, proxy /api to the local wrangler dev server
			"/api": {
				target: "http://localhost:8787",
				changeOrigin: true,
			},
		},
	},

	test: {
		environment: "node",
		include: ["src/**/*.test.{js,ts}"],
	},
}));
