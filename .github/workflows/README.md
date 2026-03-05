# CI / CD

## Workflows

| Workflow | File | Trigger |
| --- | --- | --- |
| **CI** | `workflows/ci.yml` | Every push and pull request |
| **Preview** | `workflows/preview.yml` | Every push (non-release bot) |
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

## Preview workflow

Triggered by: every push to any branch (except `github-actions[bot]` commits).

Uses `wrangler versions upload --preview-alias dev` — creates an undeployed version and attaches the `dev` alias to it. Production traffic is **not affected**.

Preview URL: `https://dev-toll-expenser.<subdomain>.workers.dev`

- `VITE_DD_ENV` is hardcoded to `dev` so RUM sessions are tagged separately from prod
- `VITE_DD_VERSION` is set to the commit SHA for traceability
- Concurrent pushes cancel in-flight runs — the latest push always wins
- The alias persists; visiting the URL always shows the most recently uploaded version

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

## Required secrets & variables

**Secrets** — Settings → Secrets and variables → Actions → Secrets:

| Secret | Description |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token with Workers deploy permissions |
| `VITE_APP_URL` | Live URL of the deployed app (used for the GitHub environment deployment link) |
| `DD_API_KEY` | Datadog API key — used by the Vite plugin to upload sourcemaps on deploy |
| `DD_APP_KEY` | Datadog Application key — used by the Vite plugin to upload sourcemaps on deploy |

**Variables** — Settings → Secrets and variables → Actions → Variables:

These are public Datadog RUM values that get embedded into the frontend JS bundle at build time. Safe to store as variables (not secrets).

| Variable | Description |
| --- | --- |
| `VITE_DD_RUM_APPLICATION_ID` | Datadog RUM application ID |
| `VITE_DD_RUM_CLIENT_TOKEN` | Datadog RUM client token (`pub...`) |
| `VITE_DD_SITE` | Datadog site (e.g. `datadoghq.com`) |
| `VITE_DD_ENV` | Environment tag (e.g. `prod`) |
| `VITE_DD_SERVICE` | Service name (e.g. `toll-expenser`) |
| `VITE_DD_SESSION_SAMPLE_RATE` | % of sessions to track (e.g. `100`) |
| `VITE_DD_SESSION_REPLAY_SAMPLE_RATE` | % of sessions to record replay (e.g. `20`) |
| `VITE_DD_DEFAULT_PRIVACY_LEVEL` | RUM privacy level (e.g. `mask-user-input`) |

> `VITE_DD_VERSION` is set automatically — from the release tag in Deploy, and from the commit SHA in Preview. No variable needed.

---

## CI workflow

Runs on every push and pull request against `main`. Tests two active Node.js LTS versions. Also runs as a required gate before the Release workflow proceeds.

Steps:
1. TypeScript type check (`npx tsc --noEmit`)
2. Unit tests (`npm test` → Vitest)
3. Vite production build (`npm run build`)

CI does **not** trigger a deploy. Deploys only happen via a published release.

> Commits pushed by the release bot (`github-actions[bot]`) are automatically skipped — CI already ran before the release was created.

---

## OpenTelemetry (Datadog)

Worker-side OTEL signals (traces, metrics, logs) are sent to Datadog via **Cloudflare's built-in OTLP integration** — no `DD_API_KEY` secret or custom instrumentation code required.

Configure the integration in the Cloudflare dashboard under **Workers & Pages → toll-expenser → Settings → Observability**.

`DD_OTLP_SITE` is a wrangler var defaulting to `datadoghq.com`. Override it in `wrangler.jsonc` for the EU region (`datadoghq.eu`).
