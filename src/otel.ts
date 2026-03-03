import {
	MeterProvider,
	PeriodicExportingMetricReader,
	AggregationTemporality,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import {
	LoggerProvider,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import type { Logger } from "@opentelemetry/api-logs";

const DEFAULT_SITE = "datadoghq.com";

// Module-level singletons — reused across requests within the same Worker isolate
let _meterProvider: MeterProvider | null = null;
let _loggerProvider: LoggerProvider | null = null;

function otlpBase(env: Env): string {
	return `https://otlp.${env.DD_OTLP_SITE || DEFAULT_SITE}`;
}

export function getMeterProvider(env: Env): MeterProvider | null {
	if (!env.DD_API_KEY) return null;
	if (_meterProvider) return _meterProvider;

	const exporter = new OTLPMetricExporter({
		url: `${otlpBase(env)}/v1/metrics`,
		headers: { "dd-api-key": env.DD_API_KEY },
		// Datadog requires delta temporality
		temporalityPreference: AggregationTemporality.DELTA,
	});

	_meterProvider = new MeterProvider({
		readers: [
			new PeriodicExportingMetricReader({
				exporter,
				// Disable automatic periodic export — we use forceFlush() via waitUntil()
				exportIntervalMillis: Number.MAX_SAFE_INTEGER,
			}),
		],
	});

	return _meterProvider;
}

export function getLoggerProvider(env: Env): LoggerProvider | null {
	if (!env.DD_API_KEY) return null;
	if (_loggerProvider) return _loggerProvider;

	const exporter = new OTLPLogExporter({
		url: `${otlpBase(env)}/v1/logs`,
		headers: { "dd-api-key": env.DD_API_KEY },
	});

	_loggerProvider = new LoggerProvider({
		processors: [new SimpleLogRecordProcessor(exporter)],
	});

	return _loggerProvider;
}

export function getLogger(env: Env): Logger | null {
	return getLoggerProvider(env)?.getLogger("toll-expenser") ?? null;
}
