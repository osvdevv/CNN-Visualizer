# Task Plan - `feature/cloudflare-pages-deploy`

## Assigned to: @osvdevv

## Branch Goal

Deploy CNN Visualizer to Cloudflare Pages through GitHub Actions:

1. Build the app automatically from GitHub.
2. Publish `dist/` to Cloudflare Pages using Wrangler.
3. Keep production deploys tied to `main`.
4. Document the required secrets, variables, and verification steps.

## Expected Outcome (Definition of Done)

- A GitHub Actions workflow builds the project on every push to `main`.
- The workflow deploys the generated `dist/` folder to Cloudflare Pages.
- Required GitHub secrets and repository variables are documented.
- The production site serves the app and model assets correctly from Cloudflare.
- The workflow can be rerun safely without manual local deploy steps.

## Minimum File Structure

```text
.github/
  workflows/
    deploy-cloudflare-pages.yml
README.md
docs/
  07-deployment-and-ci.md
public/
  model/
    model.json
    group1-shard1of1.bin
src/
  nn/
    model.ts
```

## Step-by-Step Plan (Recommended Order)

## 1) Choose the Cloudflare Deployment Mode

Implement:

1. Use Cloudflare Pages Direct Upload through GitHub Actions, not dashboard-managed Git integration.
2. Create the Pages project ahead of time in Cloudflare or allow the first Wrangler deploy to create it.
3. Confirm the production branch is `main`.

Acceptance criterion:

- The project has a Cloudflare Pages target ready for CI deployments.

## 2) Configure Required Credentials

Implement:

1. Add GitHub repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
2. Add a GitHub repository variable:
   - `CLOUDFLARE_PROJECT_NAME`
3. Ensure the API token has Cloudflare Pages edit permissions for the target account.

Acceptance criterion:

- CI has everything required to authenticate and deploy without local credentials.

## 3) Add the GitHub Actions Workflow

Implement:

1. Create `.github/workflows/deploy-cloudflare-pages.yml`.
2. Trigger on:
   - `push` to `main`
   - optional `workflow_dispatch`
3. Set workflow permissions for:
   - `contents: read`
   - `deployments: write`

Acceptance criterion:

- The repository contains a deploy workflow wired to the production branch.

## 4) Build the App in CI

Implement:

1. Check out the repository.
2. Set up Node in the workflow.
3. Run:
   - `npm ci`
   - `npm run build`
4. Fail the job immediately if the build does not produce a valid `dist/`.

Acceptance criterion:

- The workflow produces a deployable static bundle before attempting upload.

## 5) Deploy `dist/` to Cloudflare Pages

Implement:

1. Use `cloudflare/wrangler-action@v3`.
2. Deploy with a command equivalent to:

```text
pages deploy dist --project-name=${{ vars.CLOUDFLARE_PROJECT_NAME }}
```

3. Let `main` publish to production.
4. Keep the workflow structure ready for future preview deployments if needed.

Acceptance criterion:

- A successful GitHub Actions run publishes the site to Cloudflare Pages.

## 6) Verify Runtime Asset Behavior

Implement:

1. Confirm the built app can still load:
   - `/model/model.json`
   - `/model/group1-shard1of1.bin`
2. Confirm `src/nn/model.ts` works correctly under the Cloudflare Pages root path.
3. Open the deployed site and test handwritten predictions for `0`, `1`, `7`, `8`, and `9`.

Acceptance criterion:

- The deployed app behaves like the local production build and serves model assets correctly.

## 7) Update Documentation

Implement:

1. Update `docs/07-deployment-and-ci.md` from GitHub Pages assumptions to Cloudflare Pages.
2. Add Cloudflare setup notes to `README.md`:
   - required secrets
   - project variable
   - deploy trigger
   - rollback/redeploy flow

Acceptance criterion:

- Another developer can set up and rerun the deploy pipeline from repo docs.

## 8) Post-Deploy Checklist

Checklist:

1. Confirm the workflow finishes green on GitHub Actions.
2. Confirm the Pages production URL is updated after the `main` push.
3. Confirm the site loads without 404s for model files.
4. Confirm a rerun of the workflow produces a safe redeploy.

## Recommended Commit Sequence

Suggested commits:

```text
ci(deploy): add github actions workflow for cloudflare pages
docs(deploy): document cloudflare pages setup and redeploy flow
```

## Common Risks and Quick Fixes

- Workflow authenticates but deploy fails:
  - recheck `CLOUDFLARE_ACCOUNT_ID`, token scope, and project name spelling.
- Build passes but model fails in production:
  - verify `public/model` is present in `dist/model` after `npm run build`.
- Deploy works but publishes to preview unexpectedly:
  - confirm the workflow runs from `main` and the deploy branch metadata is correct.
- Team later wants Cloudflare Git integration instead:
  - pause first, because Direct Upload and Git integration are different Pages project modes and should be chosen intentionally.
