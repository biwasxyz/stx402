import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";
import { ENDPOINT_TIERS } from "../utils/pricing";
import { getAllMetrics, getDailyStats, type EndpointMetrics } from "../middleware/metrics";

export class Dashboard extends OpenAPIRoute {
  schema = {
    tags: ["System"],
    summary: "View API metrics dashboard (free)",
    responses: {
      "200": {
        description: "HTML dashboard",
        content: {
          "text/html": {
            schema: { type: "string" as const },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    // Get all endpoint paths from ENDPOINT_TIERS
    const paths = Object.keys(ENDPOINT_TIERS);

    let metrics: EndpointMetrics[] = [];
    let dailyStats: { date: string; calls: number }[] = [];

    // Only fetch metrics if METRICS KV is configured
    if (c.env.METRICS) {
      [metrics, dailyStats] = await Promise.all([
        getAllMetrics(c.env.METRICS, paths),
        getDailyStats(c.env.METRICS, 7),
      ]);
    } else {
      // Generate placeholder data when KV is not configured
      metrics = paths.map((path) => ({
        path,
        tier: ENDPOINT_TIERS[path] || "simple",
        totalCalls: 0,
        successfulCalls: 0,
        avgLatencyMs: 0,
        successRate: "N/A",
        earnings: { STX: "0", sBTC: "0", USDCx: "0" },
        lastCall: "Never",
      }));
    }

    // Calculate totals
    const totalEndpoints = metrics.length;
    const totalCalls = metrics.reduce((sum, m) => sum + m.totalCalls, 0);
    const totalSTX = metrics.reduce(
      (sum, m) => sum + parseFloat(m.earnings.STX),
      0
    );
    const totalsBTC = metrics.reduce(
      (sum, m) => sum + parseFloat(m.earnings.sBTC),
      0
    );
    const totalUSDCx = metrics.reduce(
      (sum, m) => sum + parseFloat(m.earnings.USDCx),
      0
    );
    const activeEndpoints = metrics.filter((m) => m.totalCalls > 0);
    const avgSuccessRate =
      activeEndpoints.length > 0
        ? (
            activeEndpoints.reduce(
              (sum, m) =>
                sum + (m.successRate !== "N/A" ? parseFloat(m.successRate) : 0),
              0
            ) / activeEndpoints.length
          ).toFixed(1)
        : "N/A";

    // Count by tier
    const tierCounts = {
      simple: metrics.filter((m) => m.tier === "simple").length,
      ai: metrics.filter((m) => m.tier === "ai").length,
      heavy_ai: metrics.filter((m) => m.tier === "heavy_ai").length,
    };

    const html = generateDashboardHTML({
      metrics,
      dailyStats,
      totals: {
        endpoints: totalEndpoints,
        calls: totalCalls,
        stx: totalSTX,
        sbtc: totalsBTC,
        usdcx: totalUSDCx,
        avgSuccessRate,
      },
      tierCounts,
      kvConfigured: !!c.env.METRICS,
    });

    return c.html(html);
  }
}

function generateDashboardHTML(data: {
  metrics: EndpointMetrics[];
  dailyStats: { date: string; calls: number }[];
  totals: {
    endpoints: number;
    calls: number;
    stx: number;
    sbtc: number;
    usdcx: number;
    avgSuccessRate: string;
  };
  tierCounts: { simple: number; ai: number; heavy_ai: number };
  kvConfigured: boolean;
}): string {
  const { metrics, dailyStats, totals, tierCounts, kvConfigured } = data;

  // Sort by total calls descending
  const sortedMetrics = [...metrics].sort((a, b) => b.totalCalls - a.totalCalls);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STX402 API Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      min-height: 100vh;
      padding: 24px;
    }
    .container { max-width: 1600px; margin: 0 auto; }
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #f7931a;
      margin-bottom: 8px;
    }
    .subtitle { color: #71717a; margin-bottom: 32px; }
    .warning {
      background: #422006;
      border: 1px solid #f59e0b;
      color: #fbbf24;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 20px;
    }
    .card h3 {
      color: #71717a;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .card .value {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
    }
    .card .value.stx { color: #5865f2; }
    .card .value.sbtc { color: #f7931a; }
    .card .value.usdcx { color: #2563eb; }
    .card .value.success { color: #22c55e; }
    .tier-badges {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .tier-badge {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
    }
    .tier-badge.simple { background: #166534; color: #86efac; }
    .tier-badge.ai { background: #1e40af; color: #93c5fd; }
    .tier-badge.heavy_ai { background: #831843; color: #f9a8d4; }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #fff;
    }
    .chart-container {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 32px;
    }
    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 120px;
      padding-top: 20px;
    }
    .bar-day {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .bar {
      width: 100%;
      background: linear-gradient(180deg, #5865f2 0%, #3b4fd1 100%);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: height 0.3s;
    }
    .bar-label {
      font-size: 11px;
      color: #71717a;
    }
    .bar-value {
      font-size: 10px;
      color: #a1a1aa;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      text-align: left;
      padding: 12px 16px;
      background: #18181b;
      color: #71717a;
      font-weight: 500;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #27272a;
      position: sticky;
      top: 0;
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #27272a;
      vertical-align: middle;
    }
    tr:hover { background: #1f1f23; }
    code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      background: #27272a;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .tier-simple { color: #4ade80; }
    .tier-ai { color: #60a5fa; }
    .tier-heavy_ai { color: #f472b6; }
    .success-high { color: #4ade80; }
    .success-med { color: #facc15; }
    .success-low { color: #f87171; }
    .table-container {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      overflow: hidden;
    }
    .table-scroll {
      max-height: 600px;
      overflow-y: auto;
    }
    .footer {
      margin-top: 32px;
      text-align: center;
      color: #52525b;
      font-size: 12px;
    }
    .footer a { color: #f7931a; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>STX402 API Dashboard</h1>
    <p class="subtitle">Real-time metrics for X402 payment-gated endpoints</p>

    ${!kvConfigured ? `
    <div class="warning">
      KV namespace not configured. Metrics will not persist.
      Run <code>wrangler kv namespace create METRICS</code> and update wrangler.jsonc.
    </div>
    ` : ""}

    <div class="summary">
      <div class="card">
        <h3>Total Endpoints</h3>
        <div class="value">${totals.endpoints}</div>
        <div class="tier-badges">
          <span class="tier-badge simple">${tierCounts.simple} simple</span>
          <span class="tier-badge ai">${tierCounts.ai} ai</span>
          <span class="tier-badge heavy_ai">${tierCounts.heavy_ai} heavy</span>
        </div>
      </div>
      <div class="card">
        <h3>Total Calls</h3>
        <div class="value">${totals.calls.toLocaleString()}</div>
      </div>
      <div class="card">
        <h3>STX Earned</h3>
        <div class="value stx">${totals.stx.toFixed(4)}</div>
      </div>
      <div class="card">
        <h3>sBTC Earned</h3>
        <div class="value sbtc">${totals.sbtc.toFixed(8)}</div>
      </div>
      <div class="card">
        <h3>USDCx Earned</h3>
        <div class="value usdcx">${totals.usdcx.toFixed(4)}</div>
      </div>
      <div class="card">
        <h3>Avg Success Rate</h3>
        <div class="value success">${totals.avgSuccessRate}%</div>
      </div>
    </div>

    <div class="chart-container">
      <h2 class="section-title">Last 7 Days</h2>
      <div class="bar-chart">
        ${dailyStats.map((day) => {
          const maxCalls = Math.max(...dailyStats.map((d) => d.calls), 1);
          const height = (day.calls / maxCalls) * 100;
          return `
            <div class="bar-day">
              <div class="bar-value">${day.calls}</div>
              <div class="bar" style="height: ${Math.max(height, 4)}%"></div>
              <div class="bar-label">${day.date.slice(5)}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <h2 class="section-title">Endpoint Metrics</h2>
    <div class="table-container">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Tier</th>
              <th>Calls</th>
              <th>Success Rate</th>
              <th>Avg Latency</th>
              <th>STX</th>
              <th>sBTC</th>
              <th>USDCx</th>
              <th>Last Call</th>
            </tr>
          </thead>
          <tbody>
            ${sortedMetrics.map((m) => {
              const successClass =
                m.successRate === "N/A"
                  ? ""
                  : parseFloat(m.successRate) >= 95
                  ? "success-high"
                  : parseFloat(m.successRate) >= 80
                  ? "success-med"
                  : "success-low";
              const lastCallDisplay =
                m.lastCall === "Never"
                  ? "-"
                  : new Date(m.lastCall).toLocaleString();
              return `
                <tr>
                  <td><code>${m.path}</code></td>
                  <td class="tier-${m.tier}">${m.tier}</td>
                  <td>${m.totalCalls.toLocaleString()}</td>
                  <td class="${successClass}">${m.successRate}%</td>
                  <td>${m.avgLatencyMs}ms</td>
                  <td>${m.earnings.STX}</td>
                  <td>${m.earnings.sBTC}</td>
                  <td>${m.earnings.USDCx}</td>
                  <td>${lastCallDisplay}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      <p>Powered by <a href="https://x402.org" target="_blank">X402</a> |
      <a href="/" target="_blank">API Docs</a> |
      Built on <a href="https://stacks.co" target="_blank">Stacks</a></p>
    </div>
  </div>
</body>
</html>`;
}
