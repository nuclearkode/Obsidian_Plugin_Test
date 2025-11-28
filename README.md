# Plugin Health Monitor

An Obsidian plugin that scans installed plugins and surfaces a health score based on update recency and maintenance signals. It provides a dashboard, commands, and a status bar summary so you can quickly spot abandoned or at-risk plugins.

## Features
- **Automated scanning:** Iterates through installed plugin manifests and checks file modification times to estimate last update dates.
- **Health scoring:** Applies weighted scores for update freshness, support, activity, and compatibility with risk floors for plugins older than two years.
- **Dashboard view:** Dedicated pane that summarizes health states and lists every plugin with scores and last update dates.
- **Status bar summary:** Quick glance at healthy, warning, and risky counts.
- **Commands:** Open the dashboard or trigger an immediate scan from the command palette.
- **Settings:** Configure auto-scan cadence, GitHub token placeholder for future API calls, and an optional community API endpoint.

## How it works (step by step)
1. **Startup and scheduling**
   - On load, the plugin immediately triggers a scan so the dashboard has data.
   - If automatic scans are enabled (default), it sets a repeating timer using the configured interval (24 hours by default).
   - The interval is clamped between **1 hour (minimum)** and **168 hours (maximum)** to avoid excessive or runaway scans.
   - Only one scan runs at a time; manual scans will be ignored with a notice if another scan is already in progress to prevent race conditions.
   - The timer runs a full scan without UI noise; manual scans show a notice when finished.
2. **Iterating installed plugins**
   - The scanner walks through `app.plugins.manifests`, which contains every installed plugin’s manifest.
   - For each plugin, it looks up `.obsidian/plugins/<plugin-id>/manifest.json` and reads the file’s modified time via the adapter to approximate the “last update” timestamp.
3. **Scoring and classification**
   - It converts recency into an update score, blends it with placeholder scores for support, activity, and compatibility, and enforces a risk floor for plugins idle 24+ months.
   - Scores are converted into statuses: **Green** (healthy), **Yellow** (monitor), **Red** (concerning), **Black** (abandoned/very stale).
4. **Caching and persistence**
   - The snapshot (per-plugin results plus summary counts) is cached in plugin settings and written to `data.json`, so reopening Obsidian shows the last scan instantly.
5. **UI refresh**
   - The dashboard view renders badges, scores, and last update dates sorted by risk level. Rescan buttons rerun the full scan pipeline.
   - The status bar item shows aggregated counts (healthy/monitor/risk) and updates after every scan.

## Scan cadence and safety controls
- **Default cadence:** 24 hours.
- **Guardrails:** Input is clamped to 1–168 hours in settings to prevent overly aggressive or accidentally massive intervals.
- **Single-flight scans:** A running scan blocks concurrent requests and surfaces a notice if a manual scan is attempted mid-run.
- **Persistence:** Snapshots are stored in `data.json` so reopening Obsidian does not re-run a scan immediately; you control when to refresh.
- **Non-destructive:** The plugin is read-only; it only reads manifests and timestamps, never modifying plugins.
- **UI safety:** Dashboard updates are driven by cached data to avoid freezes; rescans repopulate the cache after completion.

## Usage
1. Enable the plugin in your development vault.
2. Run **Scan plugins now** from the command palette or click the ribbon icon to perform the initial scan.
3. Open **Open health dashboard** to review plugin statuses, scores, and last update timestamps.
4. Adjust settings under **Plugin Health Monitor** to control scan intervals and integration placeholders.

## Health Scoring
The health score (0–100) is weighted as follows:
- **Update Score (40%)** — 100 (0–3 months), 85 (3–6 months), 60 (6–12 months), 30 (12–24 months), 0 (24+ months).
- **Support Score (25%)** — Default 40 (neutral baseline; pending real support signals).
- **Activity Score (20%)** — Default 50 (neutral baseline; placeholder for repo activity).
- **Compatibility Score (15%)** — Default 70 (assumes recent compatibility unless data suggests otherwise).
- **Risk floor:** Plugins with 24+ months of inactivity are forced to a minimum score of 15 and marked **Abandoned**.

Scores translate into statuses:
- **Green:** 80–100
- **Yellow:** 55–79
- **Red:** 30–54
- **Black:** 2+ years without updates or <30 score

## Files
- `main.ts` — Plugin logic, scanning, scoring, dashboard view, commands, and settings.
- `manifest.json` — Plugin metadata.
- `styles.css` — Dashboard styling tokens.
- `versions.json` — Minimum Obsidian version map.
- `esbuild.config.mjs` — Build configuration.
- `package.json` — Development metadata and scripts.
- `tsconfig.json` — TypeScript configuration.

## Roadmap
- GitHub API integration for commit recency, issues, and archived flags.
- Community directory checks to detect removed or deprecated plugins.
- Alert rules, snooze options, and richer recommendations.

## Development
Install dependencies and build:
```bash
npm install
npm run dev
```
Ensure `manifest.json` and the generated `main.js` are placed in `.obsidian/plugins/plugin-health-monitor/` within your vault when testing.

## End-to-end flow after pushing to GitHub
Follow these steps to turn a GitHub push into a locally running plugin build:
1. **Bump versions locally** — Update `manifest.json` and `versions.json` with the new semantic version, commit, and push.
2. **Tag a release** — Create a Git tag that matches the version (e.g., `v1.2.3`) and push the tag to GitHub.
3. **Build artifacts** — On your machine, run `npm install` then `npm run build` to produce `main.js` alongside `manifest.json` and `styles.css`.
4. **Create a GitHub release** — Draft a release for the tag and attach `main.js`, `manifest.json`, and `styles.css` (case sensitive).
5. **Download for Obsidian** — From the release page, download the three files and place them into `.obsidian/plugins/plugin-health-monitor/` inside your vault.
6. **Restart Obsidian fully** — Quit and relaunch Obsidian so manifest changes are picked up, then enable **Plugin Health Monitor** from the community plugins list.
7. **Verify and rescan** — Open the dashboard, run **Scan plugins now**, and confirm the status bar counts update as expected.

## Local setup (developer)
1. Clone the repository in your workspace and install dependencies:
   ```bash
   npm install
   ```
2. Run a production build to generate `main.js`:
   ```bash
   npm run build
   ```
3. Copy the following files into your development vault under `.obsidian/plugins/plugin-health-monitor/`:
   - `main.js`
   - `manifest.json`
   - `styles.css`
   - `data.json` (created automatically after the first settings save)
4. Reload Obsidian (full restart) and enable **Plugin Health Monitor** from the community plugins list.

## Publishing checklist
- Update `manifest.json` and `versions.json` with the new semantic version.
- Run `npm run build` to produce the distributable `main.js`.
- Verify the plugin loads without console errors in a fresh vault.
- Attach `main.js`, `manifest.json`, and `styles.css` to your release.
- Create a GitHub release with a matching tag and publish according to the Obsidian community plugin guidelines.

## Testing
Run the type-safe production build to ensure the code compiles:
```bash
npm run build
```
