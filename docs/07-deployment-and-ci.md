# CNN Visualizer - Deployment and CI Specification

## 1. Objective

This document describes:

1. the current static build behavior of the repo,
2. the deployment target we are actually moving toward next,
3. the CI/CD contract expected for Cloudflare Pages.

## 2. Current State

Today, the repository supports local production builds through Vite:

```bash
npm ci
npm run build
```

Current facts:

- the build outputs static assets to `dist/`,
- Vite copies `public/model/*` into `dist/model/*`,
- the runtime loads the model from `/model/model.json`,
- there is not yet a committed GitHub Actions deploy workflow for production.

## 3. Deployment Target

The intended deployment target is:

- Cloudflare Pages
- deployed through GitHub Actions
- using Wrangler direct upload from CI

This replaces the older GitHub Pages plan and matches the current task plan for Phase 3.

## 4. Why Cloudflare Pages Fits The Current App

The current app expects a root-served model path:

```ts
/model/model.json
```

That makes Cloudflare Pages a better fit for the current setup than a repository-subpath deployment model, because it avoids introducing extra base-path complexity into the browser model URL.

## 5. Build Contract

The CI build step must run:

```bash
npm ci
npm run build
```

Expected output:

- `dist/index.html`
- compiled frontend assets under `dist/assets/`
- copied model assets under `dist/model/`

Required validation:

1. `dist/` exists after build,
2. `dist/model/model.json` exists,
3. `dist/model/group1-shard1of1.bin` exists.

## 6. Planned GitHub Actions Workflow

The planned workflow should:

1. trigger on push to `main`,
2. optionally support `workflow_dispatch`,
3. check out the repository,
4. set up Node.js,
5. run `npm ci`,
6. run `npm run build`,
7. deploy `dist/` to Cloudflare Pages with Wrangler.

## 7. Required GitHub Configuration

### Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Repository Variable

- `CLOUDFLARE_PROJECT_NAME`

## 8. Planned Cloudflare Deployment Command

The intended deploy command is:

```text
pages deploy dist --project-name=${{ vars.CLOUDFLARE_PROJECT_NAME }}
```

Expected GitHub Action integration:

- `cloudflare/wrangler-action@v3`

## 9. Reference Workflow Shape

```yaml
name: Deploy CNN Visualizer

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  deployments: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=${{ vars.CLOUDFLARE_PROJECT_NAME }}
```

## 10. Production Validation Checklist

After deploy:

1. the site opens without a blank screen,
2. `/model/model.json` resolves,
3. the model shard resolves,
4. draw -> preprocess -> predict works,
5. the deployed app behaves like the local `npm run build` result.

## 11. Rollback / Recovery

If deployment fails:

1. inspect the GitHub Actions run,
2. verify Cloudflare credentials and project name,
3. confirm the `dist/model` files were generated,
4. rerun the workflow or redeploy the last known good commit.

## 12. Common Failure Modes

- Missing or invalid Cloudflare secrets.
- Wrong Pages project name.
- `dist/model` missing the committed TF.js artifacts.
- Hosting path drift that breaks `/model/model.json`.
- Build passing locally but failing in CI because of lockfile drift.

## 13. Acceptance Criteria For Phase 3

Phase 3 deployment work is complete when:

1. the workflow exists in `.github/workflows/`,
2. a push to `main` deploys successfully,
3. Cloudflare serves the app and model assets correctly,
4. the workflow can be rerun safely without manual local deploys.
