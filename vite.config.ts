/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { datadogVitePlugin } from '@datadog/vite-plugin';

export default defineConfig(({ mode }) => ({
	plugins: [
		datadogVitePlugin({
			auth: {
				apiKey: process.env.DD_API_KEY || '',
				appKey: process.env.DD_APP_KEY || '',
				site: process.env.VITE_DD_SITE || 'datadoghq.com',
			},
			errorTracking: {
				enable: true,
				sourcemaps: {
					// Only upload sourcemaps during a real deploy — set DD_SOURCEMAPS_DRY_RUN=false
					// in the deploy workflow. All other builds (preview, local) stay dry.
					dryRun: process.env.DD_SOURCEMAPS_DRY_RUN !== 'false',
					minifiedPathPrefix: "/assets/",
					releaseVersion: process.env.VITE_DD_VERSION || 'local',
					service: process.env.VITE_DD_SERVICE || 'toll-expenser',
				}
			},
			output: {
				path: './dist/',
			}
		}),
		react()
	],

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
