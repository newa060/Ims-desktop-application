# Auto-Update Setup Guide

## How it works

```
You push a git tag (v1.2.0)
        ↓
GitHub Actions builds the Windows installer
        ↓
Installer + latest.yml are uploaded to a GitHub Release
        ↓
Every running client checks GitHub every time the app starts
        ↓
If a new version is found → banner appears → user clicks Download → installs on restart
```

---

## One-time setup (do this once)

### 1. Create a GitHub repository

Push this project to GitHub if you haven't already:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Edit `package.json` — fill in your repo details

Find the `publish` block and replace the placeholders:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",   ← your GitHub username
  "repo": "YOUR_GITHUB_REPO_NAME",   ← your repo name
  "private": false
}
```

### 3. Add GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these three secrets:

| Secret name              | Value                                      |
|--------------------------|--------------------------------------------|
| `SUPABASE_URL`           | Your Supabase project URL                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key          |
| `SESSION_SECRET`         | Any long random string (e.g. 64 hex chars) |

> `GITHUB_TOKEN` is automatically provided by GitHub Actions — you don't need to add it.

### 4. Create an `assets/` folder with your app icon

```
assets/
  icon.ico    ← Windows icon (256×256 recommended)
  icon.png    ← Used in the window title bar
```

If you don't have an icon yet, any `.ico` file works as a placeholder.

---

## Releasing a new version

Every release is just two commands:

```bash
# 1. Bump the version in package.json
npm version patch   # 1.0.0 → 1.0.1
# or
npm version minor   # 1.0.0 → 1.1.0
# or
npm version major   # 1.0.0 → 2.0.0

# 2. Push the tag — this triggers the GitHub Actions build
git push origin main --tags
```

GitHub Actions will:
1. Build the Windows installer (`Inventory Management System Setup 1.x.x.exe`)
2. Create a GitHub Release tagged `v1.x.x`
3. Upload the installer + `latest.yml` (the version manifest clients poll)

The build takes ~5–10 minutes. You can watch it in the **Actions** tab of your repo.

---

## What the user sees

- **5 seconds after launch** the app silently checks GitHub for a newer version
- If a new version exists → a small banner appears in the bottom-right corner:

  > **Update available — v1.2.0**  `[Download]`  ✕

- They click **Download** → a progress bar shows the download
- When complete → banner changes to:

  > **v1.2.0 ready to install**  `[Restart]`  ✕

- They click **Restart** → app closes, installer runs silently, app reopens on the new version
- They can also dismiss the banner and it won't reappear until the next launch
- Manual check is available at **Settings → Updates → Check Now**

---

## Testing locally before releasing

To verify the build works before pushing a tag:

```bash
npm run build:win
```

The installer will be in `release/`. Install it and confirm the app runs correctly.
To test the update flow end-to-end you need to publish at least one release to GitHub first,
then build a slightly older version locally and install it — the live build will detect the newer GitHub release.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails with "GH_TOKEN not found" | Make sure `GITHUB_TOKEN` is available — it's auto-injected, check Actions permissions under repo Settings → Actions → General |
| "No published releases found" on client | The first release must exist on GitHub before clients can find updates |
| Update check fails silently | Check `logs/combined.log` on the client machine for `Auto-updater error` lines |
| `icon.ico` not found | Create the `assets/` folder and add an icon, or remove the `icon` line from `package.json` build config |
| Private repo | Change `"private": true` in the publish config and add a `GH_TOKEN` secret with a Personal Access Token that has `repo` scope |
