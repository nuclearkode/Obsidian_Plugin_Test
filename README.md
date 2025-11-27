# Plugin Health Monitor

An Obsidian plugin that scans installed plugins and surfaces a health score based on update recency and maintenance signals. It provides a dashboard, commands, and a status bar summary so you can quickly spot abandoned or at-risk plugins.

## Features
- **Automated scanning:** Iterates through installed plugin manifests and checks file modification times to estimate last update dates.
- **Health scoring:** Applies weighted scores for update freshness, support, activity, and compatibility with risk floors for plugins older than two years.
- **Dashboard view:** Dedicated pane that summarizes health states and lists every plugin with scores and last update dates.
- **Status bar summary:** Quick glance at healthy, warning, and risky counts.
- **Commands:** Open the dashboard or trigger an immediate scan from the command palette.
- **Settings:** Configure auto-scan cadence, GitHub token placeholder for future API calls, and an optional community API endpoint.

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
