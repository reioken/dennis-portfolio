# Deploy Notes

## Live

- Production Pages project: `dennis-portfolio`
- URL: https://dennis-portfolio-87g.pages.dev

## Redeploy

```bash
npm run build
npx wrangler pages deploy dist --project-name=dennis-portfolio --commit-dirty=true
```

## Custom domain (optional)

In Cloudflare Dashboard → Pages → `dennis-portfolio` → Custom domains:

1. Add `dennis.riftcast.app`
2. Update `astro.config.mjs` `site` and `src/lib/site.ts` `url`
3. Update maker-links in `riftcast/site/nexus` + `berry` footers

## GitHub Actions

Workflow: `.github/workflows/deploy.yml`

Secrets needed:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` (`bd0f3043cb8b0eb6dfab9c1131fe8e87`)
