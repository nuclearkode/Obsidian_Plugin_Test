import {
  App,
  ItemView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
} from 'obsidian';

const VIEW_TYPE = 'plugin-health-monitor-view';

interface PluginHealthRecord {
  id: string;
  name: string;
  version: string;
  lastUpdated: number | null;
  healthScore: number;
  healthStatus: HealthStatus;
  updateScore: number;
  supportScore: number;
  activityScore: number;
  compatibilityScore: number;
  summary: string;
}

type HealthStatus = 'green' | 'yellow' | 'red' | 'black';

interface PluginHealthSnapshot {
  checkedAt: number;
  results: PluginHealthRecord[];
  summary: HealthSummary;
}

interface HealthSummary {
  green: number;
  yellow: number;
  red: number;
  black: number;
}

interface PluginHealthSettings {
  enableAutoScan: boolean;
  autoScanIntervalHours: number;
  githubToken: string;
  communityApiUrl: string;
  cachedSnapshot: PluginHealthSnapshot | null;
}

const DEFAULT_SETTINGS: PluginHealthSettings = {
  enableAutoScan: true,
  autoScanIntervalHours: 24,
  githubToken: '',
  communityApiUrl: '',
  cachedSnapshot: null,
};

export default class PluginHealthMonitor extends Plugin {
  settings: PluginHealthSettings = { ...DEFAULT_SETTINGS };
  private statusBarItem: HTMLElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon('activity', 'Open Plugin Health Monitor', () => {
      void this.openDashboard();
    });

    this.addCommand({
      id: 'plugin-health-monitor-open-dashboard',
      name: 'Open health dashboard',
      callback: () => {
        void this.openDashboard();
      },
    });

    this.addCommand({
      id: 'plugin-health-monitor-run-scan',
      name: 'Scan plugins now',
      callback: () => {
        void this.runScan(true);
      },
    });

    this.registerView(VIEW_TYPE, (leaf) => new PluginHealthView(leaf, this));

    this.addSettingTab(new PluginHealthSettingTab(this.app, this));

    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar();

    if (this.settings.enableAutoScan) {
      const intervalMs = this.settings.autoScanIntervalHours * 60 * 60 * 1000;
      this.registerInterval(
        window.setInterval(() => {
          void this.runScan(false);
        }, intervalMs),
      );
    }

    await this.runScan(false);
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    if (loaded) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async openDashboard(): Promise<void> {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice('Unable to open health dashboard');
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async runScan(showNotice: boolean): Promise<void> {
    const snapshot = await this.scanPlugins();
    this.settings.cachedSnapshot = snapshot;
    await this.saveSettings();
    this.updateStatusBar();
    this.refreshView();
    if (showNotice) {
      new Notice('Plugin health scan completed');
    }
  }

  private refreshView(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof PluginHealthView) {
        view.render();
      }
    }
  }

  private updateStatusBar(): void {
    if (!this.statusBarItem) {
      return;
    }
    const summary = this.settings.cachedSnapshot?.summary;
    if (!summary) {
      this.statusBarItem.setText('Health monitor: no scan');
      return;
    }
    const parts = [
      `✅ ${summary.green}`,
      `⚠️ ${summary.yellow}`,
      `🚨 ${summary.red + summary.black}`,
    ];
    this.statusBarItem.setText(`Health: ${parts.join(' | ')}`);
  }

  private async scanPlugins(): Promise<PluginHealthSnapshot> {
    const manifests = this.app.plugins.manifests;
    const results: PluginHealthRecord[] = [];

    for (const [id, manifest] of Object.entries(manifests)) {
      const lastUpdated = await this.getLastModifiedTime(id);
      const scoring = this.calculateScores(lastUpdated);
      results.push({
        id,
        name: manifest.name,
        version: manifest.version,
        lastUpdated,
        healthScore: scoring.healthScore,
        healthStatus: scoring.healthStatus,
        updateScore: scoring.updateScore,
        supportScore: scoring.supportScore,
        activityScore: scoring.activityScore,
        compatibilityScore: scoring.compatibilityScore,
        summary: scoring.summary,
      });
    }

    results.sort((a, b) => this.statusPriority(b.healthStatus) - this.statusPriority(a.healthStatus));

    const summary = results.reduce<HealthSummary>(
      (acc, record) => {
        acc[record.healthStatus] += 1;
        return acc;
      },
      { green: 0, yellow: 0, red: 0, black: 0 },
    );

    return {
      checkedAt: Date.now(),
      results,
      summary,
    };
  }

  private statusPriority(status: HealthStatus): number {
    switch (status) {
      case 'black':
        return 4;
      case 'red':
        return 3;
      case 'yellow':
        return 2;
      case 'green':
        return 1;
      default:
        return 0;
    }
  }

  private calculateScores(lastUpdated: number | null): {
    updateScore: number;
    supportScore: number;
    activityScore: number;
    compatibilityScore: number;
    healthScore: number;
    healthStatus: HealthStatus;
    summary: string;
  } {
    const now = Date.now();
    const monthsSinceUpdate = lastUpdated ? (now - lastUpdated) / (1000 * 60 * 60 * 24 * 30) : Infinity;

    const updateScore = this.scoreUpdate(monthsSinceUpdate);
    const supportScore = 40;
    const activityScore = 50;
    const compatibilityScore = 70;

    let healthScore = updateScore * 0.4 + supportScore * 0.25 + activityScore * 0.2 + compatibilityScore * 0.15;

    if (monthsSinceUpdate >= 24) {
      healthScore = Math.max(healthScore, 15);
    }

    const healthStatus = this.scoreToStatus(healthScore, monthsSinceUpdate);

    const statusLabel = this.statusLabel(healthStatus);
    const summary = `Last update ${this.describeRecency(monthsSinceUpdate)} · ${statusLabel}`;

    return {
      updateScore,
      supportScore,
      activityScore,
      compatibilityScore,
      healthScore: Math.round(healthScore),
      healthStatus,
      summary,
    };
  }

  private scoreUpdate(monthsSinceUpdate: number): number {
    if (monthsSinceUpdate < 3) return 100;
    if (monthsSinceUpdate < 6) return 85;
    if (monthsSinceUpdate < 12) return 60;
    if (monthsSinceUpdate < 24) return 30;
    if (monthsSinceUpdate === Infinity) return 0;
    return 0;
  }

  private scoreToStatus(healthScore: number, monthsSinceUpdate: number): HealthStatus {
    if (monthsSinceUpdate >= 24) {
      return 'black';
    }
    if (healthScore >= 80) return 'green';
    if (healthScore >= 55) return 'yellow';
    if (healthScore >= 30) return 'red';
    return 'black';
  }

  private statusLabel(status: HealthStatus): string {
    switch (status) {
      case 'green':
        return 'Healthy';
      case 'yellow':
        return 'Monitor';
      case 'red':
        return 'Concerning';
      case 'black':
        return 'Abandoned';
      default:
        return 'Unknown';
    }
  }

  private describeRecency(monthsSinceUpdate: number): string {
    if (monthsSinceUpdate === Infinity) {
      return 'date unavailable';
    }
    if (monthsSinceUpdate < 1) return 'this month';
    if (monthsSinceUpdate < 3) return 'recently';
    if (monthsSinceUpdate < 6) return 'within 6 months';
    if (monthsSinceUpdate < 12) return 'within a year';
    if (monthsSinceUpdate < 24) return 'over a year ago';
    return '2+ years ago';
  }

  private async getLastModifiedTime(pluginId: string): Promise<number | null> {
    const manifestPath = `.obsidian/plugins/${pluginId}/manifest.json`;
    try {
      const stat = await this.app.vault.adapter.stat(manifestPath);
      if (stat?.mtime) {
        return stat.mtime;
      }
    } catch (error) {
      console.error(`Failed to read manifest for ${pluginId}`, error);
    }
    return null;
  }
}

class PluginHealthView extends ItemView {
  private pluginInstance: PluginHealthMonitor;

  constructor(leaf: WorkspaceLeaf, pluginInstance: PluginHealthMonitor) {
    super(leaf);
    this.pluginInstance = pluginInstance;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Plugin Health Monitor';
  }

  getIcon(): string {
    return 'activity';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const { containerEl } = this;
    containerEl.empty();

    const header = containerEl.createDiv({ cls: 'plugin-health-monitor__summary' });
    header.createEl('h2', { text: 'Plugin Health Monitor' });

    const snapshot = this.pluginInstance.settings.cachedSnapshot;
    if (!snapshot) {
      header.createSpan({ text: 'No scan data available yet.' });
      const actions = containerEl.createDiv({ cls: 'plugin-health-monitor__row-actions' });
      const scanButton = actions.createEl('button', { text: 'Scan now' });
      scanButton.addEventListener('click', () => {
        void this.pluginInstance.runScan(true);
      });
      return;
    }

    const meta = containerEl.createDiv({ cls: 'plugin-health-monitor__meta' });
    meta.setText(`Last checked: ${new Date(snapshot.checkedAt).toLocaleString()}`);

    const summaryRow = containerEl.createDiv({ cls: 'plugin-health-monitor__summary' });
    this.addBadge(summaryRow, `Healthy ${snapshot.summary.green}`, 'green');
    this.addBadge(summaryRow, `Monitor ${snapshot.summary.yellow}`, 'yellow');
    this.addBadge(summaryRow, `Risk ${snapshot.summary.red}`, 'red');
    this.addBadge(summaryRow, `Abandoned ${snapshot.summary.black}`, 'black');

    const actions = containerEl.createDiv({ cls: 'plugin-health-monitor__row-actions' });
    const scanButton = actions.createEl('button', { text: 'Refresh now' });
    scanButton.addEventListener('click', () => {
      void this.pluginInstance.runScan(true);
    });

    const table = containerEl.createEl('table', { cls: 'plugin-health-monitor__table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    headerRow.createEl('th', { text: 'Plugin' });
    headerRow.createEl('th', { text: 'Status' });
    headerRow.createEl('th', { text: 'Last update' });
    headerRow.createEl('th', { text: 'Score' });
    headerRow.createEl('th', { text: 'Actions' });

    const tbody = table.createEl('tbody');
    for (const record of snapshot.results) {
      const row = tbody.createEl('tr');
      const pluginCell = row.createEl('td');
      pluginCell.createEl('div', { text: record.name });
      pluginCell.createEl('div', { text: `v${record.version} · ${record.id}`, cls: 'plugin-health-monitor__meta' });

      const statusCell = row.createEl('td');
      this.addBadge(statusCell, this.pluginInstance.statusLabel(record.healthStatus), record.healthStatus);

      const lastUpdateCell = row.createEl('td');
      lastUpdateCell.setText(record.lastUpdated ? new Date(record.lastUpdated).toLocaleDateString() : 'Unknown');

      const scoreCell = row.createEl('td');
      scoreCell.setText(`${record.healthScore}`);

      const actionsCell = row.createEl('td');
      const rescanButton = actionsCell.createEl('button', { text: 'Rescan' });
      rescanButton.addEventListener('click', () => {
        void this.pluginInstance.runScan(true);
      });
    }
  }

  private addBadge(parent: HTMLElement, text: string, status: HealthStatus): void {
    const badge = parent.createSpan({ text, cls: 'plugin-health-monitor__badge' });
    badge.addClass(`plugin-health-monitor__badge--${status}`);
  }
}

class PluginHealthSettingTab extends PluginSettingTab {
  plugin: PluginHealthMonitor;

  constructor(app: App, plugin: PluginHealthMonitor) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Plugin Health Monitor' });

    new Setting(containerEl)
      .setName('Enable automatic scans')
      .setDesc('Run health checks on a schedule to keep results fresh.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableAutoScan)
          .onChange(async (value) => {
            this.plugin.settings.enableAutoScan = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Auto-scan interval (hours)')
      .setDesc('How often to refresh plugin health data.')
      .addText((text) =>
        text
          .setPlaceholder('24')
          .setValue(String(this.plugin.settings.autoScanIntervalHours))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed > 0) {
              this.plugin.settings.autoScanIntervalHours = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName('GitHub token (optional)')
      .setDesc('Used to raise API rate limits when GitHub integration is added. Stored locally.')
      .addText((text) =>
        text
          .setPlaceholder('ghp_xxxxx')
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Community API endpoint (optional)')
      .setDesc('Base URL for community directory checks when available.')
      .addText((text) =>
        text
          .setPlaceholder('https://example.com/api/plugins')
          .setValue(this.plugin.settings.communityApiUrl)
          .onChange(async (value) => {
            this.plugin.settings.communityApiUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
