# CI / CD

## Workflows

| Workflow | File | Trigger |
| --- | --- | --- |
| **CI** | `workflows/ci.yml` | Every push and pull request |
| **Deploy** | `workflows/deploy.yml` | GitHub Release published |
| **Release** | `workflows/release.yml` | Manual (`workflow_dispatch`) |

---

## How to ship a new version

1. Go to **Actions → Release → Run workflow**
2. Choose a bump type: `patch`, `minor`, or `major`

The Release workflow will:
- Bump the version in `package.json`
- Commit and push to `main` with the message `chore: release vX.Y.Z`
- Create and push a git tag (`vX.Y.Z`)
- Create a GitHub Release with auto-generated release notes

Publishing the GitHub Release automatically triggers the Deploy workflow.

---

## Deploy workflow

Triggered by: `on: release: types: [published]`

Steps:
1. Install dependencies (`npm ci`)
2. Build the frontend (`npm run build` → Vite → `dist/`)
3. Deploy to Cloudflare Workers (`wrangler deploy --message <tag>`)
   - The release tag (e.g. `v1.2.0`) is passed as the deployment message
   - Visible under **Workers & Pages → toll-expenser → Deployments** in the Cloudflare dashboard
   - Registers a GitHub **Deployment** on the `production` environment with a link to the live URL

---

## Required secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token with Workers deploy permissions |
| `VITE_APP_URL` | Live URL of the deployed app (used for the GitHub environment deployment link) |
| `DD_API_KEY` | Datadog API key — enables all three OTEL signals (traces, metrics, logs) |

---

## CI workflow

Runs on every push and pull request against `main`. Tests two active Node.js LTS versions.

Steps:
1. TypeScript type check (`npx tsc --noEmit`)
2. Vite production build (`npm run build`)

CI does **not** trigger a deploy. Deploys only happen via a published release.

---

## OpenTelemetry (Datadog)

The worker sends all three OTEL signals to Datadog via OTLP HTTP. All signals are disabled and zero-overhead when `DD_API_KEY` is not set (local dev default).

**To enable**, set the API key secret on the deployed worker:

```bash
wrangler secret put DD_API_KEY
```

`DD_OTLP_SITE` is a wrangler var defaulting to `datadoghq.com`. Override it in `wrangler.jsonc` for the EU region (`datadoghq.eu`).

**Endpoints used** (derived from `DD_OTLP_SITE`):

| Signal | Endpoint |
| --- | --- |
| Traces | `https://otlp.datadoghq.com/v1/traces` |
| Metrics | `https://otlp.datadoghq.com/v1/metrics` |
| Logs | `https://otlp.datadoghq.com/v1/logs` |

**What each `/api/*` request produces:**

- **Traces**: Root span (HTTP method, path, status) + auto-instrumented child span for the NTTA upstream `fetch()`; custom attributes `ntta.endpoint`, `ntta.method`, `ntta.upstream.status`
- **Metrics**: `http.server.requests.total` (counter) and `http.server.request_duration_ms` (histogram), both tagged by method, status code, and NTTA endpoint; delta temporality as required by Datadog
- **Logs**: Structured OTLP log records for request start (INFO), upstream errors (WARN), and proxy failures (ERROR); correlated to traces via trace/span IDs
