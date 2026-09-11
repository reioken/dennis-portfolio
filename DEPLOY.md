# Deploy Notes

## Live

- Production Pages project: `dennis-portfolio`
- URL: https://dennis-portfolio-87g.pages.dev

## Redeploy

Standing user preference (2026-09-11): automatically commit, push and publish completed, verified website changes to `www.dennisbf.design`. Do not stop for another deployment confirmation. Verify the live result; never commit secrets or local generated scratch files.

```bash
npm run build
npm run deploy:contact
npx wrangler pages deploy dist --project-name=dennis-portfolio --branch=main
```

## Custom domain

Production: `www.dennisbf.design` (Cloudflare Pages → Custom domains).

## GitHub Actions

Workflow: `.github/workflows/deploy.yml`

Secrets needed:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` (`bd0f3043cb8b0eb6dfab9c1131fe8e87`)

Production uses the Cloudflare `main` branch even when the local Git branch has another name. Run the type check, regression tests and build audit, then commit the intended source before deploying. Keep `.env*`, `.source-assets/` and generated build output out of Git.
