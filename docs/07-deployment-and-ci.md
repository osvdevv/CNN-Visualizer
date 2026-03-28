# CNN Visualizer - Deployment and CI Specification

## 1. Objective

This document defines how CNN Visualizer V1 is built, validated, and deployed as a static web application using Vite, GitHub Actions, and GitHub Pages.

## 2. Deployment Strategy

Deployment model:

1. Build static assets from source with Vite.
2. Publish generated artifacts to GitHub Pages.
3. Automate with CI on the default branch.

This aligns with the project requirement of zero backend runtime.

## 3. Environment Assumptions

- Source repository hosted on GitHub.
- Default branch: `main` (or project equivalent).
- Node.js LTS available in CI.
- `npm ci` used for deterministic dependency installs.

## 4. Build Specification

Build command contract:

```bash
npm ci
npm run build
```

Expected output:

- Vite build artifacts in `dist/`.

Static asset requirements:

- Model files under `public/model/` must be copied to `dist/model/`.
- Paths must resolve correctly under GitHub Pages base URL.

## 5. Vite Configuration Requirements

For repository pages deployment (e.g., `/repo-name/`), configure:

- `base: '/<repo-name>/'` in production mode.

For user/org root pages, base may remain `/`.

Validation rule:

1. App routes and model asset URLs must resolve correctly after deployment.

## 6. CI Pipeline Stages

Recommended workflow stages:

1. Checkout source.
2. Setup Node.js and cache npm dependencies.
3. Install dependencies (`npm ci`).
4. Run lint/tests (if configured).
5. Build production bundle (`npm run build`).
6. Upload artifact and deploy to GitHub Pages.

## 7. Reference GitHub Actions Workflow

```yaml
name: Deploy CNN Visualizer

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## 8. Branch and Release Policy

Recommended flow:

1. Feature branches for implementation.
2. Pull request into default branch with checks passing.
3. Merge triggers production deployment.

Optional hardening:

- require status checks before merge,
- protect default branch,
- require one reviewer approval.

## 9. Deployment Validation Checklist

After each production deploy:

1. App loads without blank-screen/runtime crash.
2. Model file fetch from `/model/model.json` succeeds.
3. Drawing -> inference -> output loop works.
4. Layer visualization and controls function.
5. Mobile viewport remains usable.

## 10. Rollback Strategy

If production deployment fails:

1. Revert offending commit on default branch.
2. Trigger redeploy from last known good commit.
3. Confirm model asset integrity and base-path correctness.

## 11. Common Failure Modes

- Wrong Vite `base` path causing broken assets.
- Missing model files in `public/model/`.
- CI using incompatible Node.js version.
- Build passes locally but fails in CI due to lockfile drift.

Mitigation:

1. Keep lockfile committed and current.
2. Validate production-like build locally before merge.
3. Add CI smoke test for model asset fetch and app bootstrap.

## 12. Operational KPIs

Track basic delivery health:

1. Build success rate.
2. Deployment duration.
3. Mean time to recover from failed deploy.
4. Number of rollback events per release window.

## 13. Why This Deployment Design

This deployment design is selected because it is:

1. infrastructure-light (static hosting only),
2. cost-efficient for educational applications,
3. reproducible through CI automation,
4. fully aligned with a browser-only inference architecture.

