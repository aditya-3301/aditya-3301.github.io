# Verifying a GitHub Pages Site on Discord (Domain Connection)

Use this when linking `username.github.io` (or any GitHub Pages site) as a verified
website on a Discord profile. DNS TXT verification won't work here since GitHub
controls DNS for `github.io` — use the HTTPS file method instead.

## Prerequisites
- GitHub Pages must already be published and live for the repo (Settings → Pages →
  confirm a live URL is shown, not just "Source" configured).
- You have push/edit access to that repo.

## Steps

1. **Open Discord → User Settings → Connections.**
2. Click the **">"** arrow at the end of the connection icons row to expand all
   connection types.
3. Select **Domain**.
4. Enter your site URL, e.g. `https://yourusername.github.io`.
5. Discord will show two verification options — choose **HTTPS file**.
   It gives you a token that looks like: `dh=abc123...`
6. In the GitHub repo backing your Pages site, create a new file via the GitHub
   web UI:
   - Click **Add file → Create new file**.
   - In the filename box, type the full path (GitHub auto-creates folders):
     ```
     .well-known/discord
     ```
7. Paste **only** the token Discord gave you as the file's content:
   ```
   dh=abc123...
   ```
8. Commit the file (commit directly to the branch Pages deploys from, usually
   `main` or `gh-pages`).
9. Wait ~1 minute for GitHub Pages to redeploy. Confirm the file is live by
   visiting:
   ```
   https://yourusername.github.io/.well-known/discord
   ```
   You should see the raw token text in the browser.
10. Back in Discord, click **Verify**.
11. Once verified, toggle **"Display on profile"** so the link shows publicly.

## Troubleshooting
- **"Unable to validate domain"** → the file isn't live yet. Re-check the exact
  URL from step 9 loads and shows just the token, no extra formatting/HTML.
- Some static site generators (Jekyll, etc.) ignore dotfolders by default —
  if using Jekyll, add `include: [".well-known"]` to `_config.yml` so it isn't
  excluded from the build.
- Propagation can occasionally take longer — retry Verify after a few minutes.