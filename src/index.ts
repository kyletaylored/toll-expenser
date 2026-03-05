import { Hono } from "hono";
import { cors } from "hono/cors";

const NTTA_API_BASE = "https://sptrips.ntta.org/CustomerPortal/api";

const app = new Hono<{ Bindings: Env }>();

// CORS for API routes
app.use(
	"/api/*",
	cors({
		origin: (origin) => {
			if (!origin) return "*";
			// Allow localhost in development
			if (origin.includes("localhost") || origin.includes("127.0.0.1"))
				return origin;
			// Allow same-origin requests (empty origin or matching host)
			return origin;
		},
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"appcurrdate",
			"allowanonymous",
			"channelid",
			"icn",
			"api-origin",
		],
		allowMethods: ["GET", "POST", "OPTIONS"],
		credentials: true,
		maxAge: 86400,
	})
);

// API proxy — adds Origin/Referer headers that browsers cannot set
app.all("/api/*", async (c) => {
	const url = new URL(c.req.url);
	const apiPath = url.pathname.replace("/api", "");
	const nttaUrl = `${NTTA_API_BASE}${apiPath}${url.search}`;

	const headers = new Headers(c.req.raw.headers);

	// Required by NTTA — cannot be set from browser JavaScript
	headers.set("Origin", "https://ssptrips.ntta.org");
	headers.set("Referer", "https://ssptrips.ntta.org/");
	headers.set("Host", "sptrips.ntta.org");

	// Strip Cloudflare-specific headers before forwarding
	headers.delete("cf-connecting-ip");
	headers.delete("cf-ipcountry");
	headers.delete("cf-ray");
	headers.delete("cf-visitor");

	const body =
		c.req.method !== "GET" && c.req.method !== "HEAD"
			? await c.req.raw.blob()
			: null;

	try {
		const response = await fetch(nttaUrl, {
			method: c.req.method,
			headers,
			body,
		});

		const responseHeaders = new Headers(response.headers);
		const origin = c.req.header("Origin") || "*";
		responseHeaders.set("Access-Control-Allow-Origin", origin);
		responseHeaders.set("Access-Control-Allow-Credentials", "true");

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});
	} catch (error) {
		return c.json(
			{ error: "Proxy request failed", message: (error as Error).message },
			500
		);
	}
});

// Serve the React SPA for all other routes
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
