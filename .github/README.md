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

---

## CI workflow

Runs on every push and pull request against `main`. Tests two active Node.js LTS versions.

Steps:
1. TypeScript type check (`npx tsc --noEmit`)
2. Vite production build (`npm run build`)

CI does **not** trigger a deploy. Deploys only happen via a published release.
