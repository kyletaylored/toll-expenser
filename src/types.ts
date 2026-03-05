import type { Context } from "hono";

export type AppContext = Context<{ Bindings: Env }>;

// Extend the auto-generated Env with Cloudflare OTLP configuration.
// DD_OTLP_SITE — wrangler var; defaults to "datadoghq.com" (use "datadoghq.eu" for EU)
declare global {
	interface Env {
		DD_OTLP_SITE: string;
	}
}
