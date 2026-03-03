import type { Context } from "hono";

export type AppContext = Context<{ Bindings: Env }>;

// Extend the auto-generated Env with Datadog OTEL configuration.
// DD_API_KEY    — wrangler secret; empty = all OTEL signals disabled (local dev no-op)
// DD_OTLP_SITE — wrangler var; defaults to "datadoghq.com" (use "datadoghq.eu" for EU)
declare global {
	interface Env {
		DD_API_KEY: string;
		DD_OTLP_SITE: string;
	}
}
