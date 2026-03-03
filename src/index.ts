import { Hono } from "hono";
import { cors } from "hono/cors";
import { instrument, type ResolveConfigFn } from "@microlabs/otel-cf-workers";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { getMeterProvider, getLogger, getLoggerProvider } from "./otel";

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

// Metrics + flush middleware — records request count/duration, flushes all OTEL providers
app.use("/api/*", async (c, next) => {
	const start = Date.now();
	await next();
	const duration = Date.now() - start;

	const meterProvider = getMeterProvider(c.env);
	const loggerProvider = getLoggerProvider(c.env);

	if (meterProvider) {
		const meter = meterProvider.getMeter("toll-expenser");
		const endpoint = new URL(c.req.url).pathname.replace("/api", "");
		const attrs = {
			"http.request.method": c.req.method,
			"http.response.status_code": String(c.res.status),
			"ntta.endpoint": endpoint,
		};
		meter
			.createCounter("http.server.requests.total", {
				description: "Total API proxy requests",
			})
			.add(1, attrs);
		meter
			.createHistogram("http.server.request_duration_ms", {
				description: "API proxy request duration in milliseconds",
			})
			.record(duration, attrs);
	}

	// Flush metrics + logs via waitUntil so the response isn't delayed
	const flushes = [
		meterProvider?.forceFlush(),
		loggerProvider?.forceFlush(),
	].filter((p): p is Promise<void> => p != null);

	if (flushes.length > 0) {
		c.executionCtx.waitUntil(Promise.all(flushes));
	}
});

// API proxy — adds Origin/Referer headers that browsers cannot set
app.all("/api/*", async (c) => {
	const url = new URL(c.req.url);
	const apiPath = url.pathname.replace("/api", "");
	const nttaUrl = `${NTTA_API_BASE}${apiPath}${url.search}`;

	// Annotate the active span with NTTA-specific attributes
	const span = trace.getActiveSpan();
	span?.setAttribute("ntta.endpoint", apiPath);
	span?.setAttribute("ntta.method", c.req.method);

	const logger = getLogger(c.env);
	logger?.emit({
		severityNumber: SeverityNumber.INFO,
		severityText: "INFO",
		body: "ntta.proxy.request",
		attributes: {
			"ntta.endpoint": apiPath,
			"http.request.method": c.req.method,
		},
	});

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

		span?.setAttribute("ntta.upstream.status", response.status);

		if (!response.ok) {
			span?.addEvent("ntta.upstream.error", {
				"http.status_code": response.status,
				"http.status_text": response.statusText,
			});
			logger?.emit({
				severityNumber: SeverityNumber.WARN,
				severityText: "WARN",
				body: "ntta.upstream.error",
				attributes: {
					"ntta.endpoint": apiPath,
					"http.response.status_code": response.status,
				},
			});
		}

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
		span?.recordException(error as Error);
		span?.setStatus({
			code: SpanStatusCode.ERROR,
			message: (error as Error).message,
		});
		span?.addEvent("proxy.failed", {
			"error.message": (error as Error).message,
		});
		logger?.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: "ERROR",
			body: "proxy.failed",
			attributes: {
				"ntta.endpoint": apiPath,
				"error.message": (error as Error).message,
			},
		});

		return c.json(
			{ error: "Proxy request failed", message: (error as Error).message },
			500
		);
	}
});

// Serve the React SPA for all other routes
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// Traces config — Datadog OTLP traces endpoint; no-op when DD_API_KEY is not set
const otelConfig: ResolveConfigFn = (env: Env) => {
	if (!env.DD_API_KEY) {
		return { service: { name: "toll-expenser" }, spanProcessors: [] };
	}
	const site = env.DD_OTLP_SITE || "datadoghq.com";
	return {
		exporter: {
			url: `https://otlp.${site}/v1/traces`,
			headers: {
				"dd-api-key": env.DD_API_KEY,
				"dd-otlp-source": "datadog",
			},
		},
		service: { name: "toll-expenser" },
	};
};

export default instrument(app, otelConfig);
