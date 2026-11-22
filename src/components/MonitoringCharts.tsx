import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AlertPolicyState, DeploymentEvent, InfraConfig, TelemetryPoint } from '../types/infra';

interface MonitoringChartsProps {
  config: InfraConfig;
  history: TelemetryPoint[];
  events: DeploymentEvent[];
  alerts: AlertPolicyState[];
  onUpdateAlertConfig: (patch: Partial<InfraConfig>) => void;
}

interface SparkChartProps {
  title: string;
  subtitle: string;
  unit: string;
  data: { label: string; value: number; secondary?: number }[];
  threshold?: number;
  thresholdLabel?: string;
  primaryColor: string;
  secondaryColor?: string;
  maxY: number;
  primaryLegend: string;
  secondaryLegend?: string;
}

const TimeSeriesCard: React.FC<SparkChartProps> = ({
  title,
  subtitle,
  unit,
  data,
  threshold,
  thresholdLabel,
  primaryColor,
  secondaryColor,
  maxY,
  primaryLegend,
  secondaryLegend,
}) => {
  const width = 520;
  const height = 160;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 22;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const safeMax = Math.max(maxY, 1);
  const points = data.length > 0 ? data : [{ label: '--:--', value: 0 }];

  const getX = (idx: number) =>
    points.length <= 1 ? padLeft + innerW : padLeft + (idx / (points.length - 1)) * innerW;
  const getY = (val: number) =>
    padTop + innerH - (Math.min(Math.max(val, 0), safeMax) / safeMax) * innerH;

  const primaryPath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(pt.value).toFixed(1)}`)
    .join(' ');

  const areaPath = `${primaryPath} L ${getX(points.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(
    1
  )} L ${getX(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  const secondaryPath =
    secondaryColor && points.some((p) => p.secondary !== undefined)
      ? points
          .map(
            (pt, idx) =>
              `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(pt.secondary ?? 0).toFixed(1)}`
          )
          .join(' ')
      : null;

  const latest = points[points.length - 1];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right tabular-nums">
          <div className="text-lg font-mono font-semibold text-slate-900">
            {latest ? `${latest.value.toFixed(unit === '%' ? 1 : 0)}${unit}` : '--'}
          </div>
          <div className="text-xs text-slate-500">Latest sample</div>
        </div>
      </div>

      <div className="mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible" role="img" aria-label={title}>
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + innerH * (1 - ratio);
            const val = Math.round(safeMax * ratio);
            return (
              <g key={ratio}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Threshold line */}
          {threshold !== undefined && threshold <= safeMax && (
            <g>
              <line
                x1={padLeft}
                y1={getY(threshold)}
                x2={width - padRight}
                y2={getY(threshold)}
                stroke="#d97706"
                strokeWidth="1.25"
                strokeDasharray="4 4"
              />
              {thresholdLabel && (
                <text
                  x={width - padRight}
                  y={getY(threshold) - 4}
                  textAnchor="end"
                  className="fill-amber-700 text-[10px] font-mono"
                >
                  {thresholdLabel}
                </text>
              )}
            </g>
          )}

          {/* Area fill */}
          <path d={areaPath} fill={primaryColor} fillOpacity="0.08" />

          {/* Secondary line */}
          {secondaryPath && (
            <path
              d={secondaryPath}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1.75"
              strokeDasharray="3 3"
            />
          )}

          {/* Primary line */}
          <path d={primaryPath} fill="none" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" />

          {/* X-axis timestamps */}
          {points.length > 1 && (
            <>
              <text x={padLeft} y={height - 4} className="fill-slate-400 text-[10px] font-mono">
                {points[0].label}
              </text>
              <text
                x={width - padRight}
                y={height - 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono"
              >
                {points[points.length - 1].label}
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="mt-2 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: primaryColor }} />
          <span>{primaryLegend}</span>
        </div>
        {secondaryLegend && secondaryColor && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: secondaryColor }} />
            <span>{secondaryLegend}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const MonitoringCharts: React.FC<MonitoringChartsProps> = ({
  config,
  history,
  events,
  alerts,
  onUpdateAlertConfig,
}) => {
  const cpuData = history.map((h) => ({
    label: h.timestamp,
    value: h.avgCpuPct,
    secondary: h.targetCpuPct,
  }));

  const maxRps = Math.max(1000, ...history.map((h) => h.incomingRps * 1.15));
  const rpsData = history.map((h) => ({
    label: h.timestamp,
    value: h.incomingRps,
  }));

  const replicaData = history.map((h) => ({
    label: h.timestamp,
    value: h.activeInstances,
    secondary: h.desiredInstances,
  }));

  const latencyData = history.map((h) => ({
    label: h.timestamp,
    value: h.p95LatencyMs,
  }));

  return (
    <div className="space-y-6">
      {/* 2x2 Cloud Monitoring Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesCard
          title="Compute Engine CPU Utilization"
          subtitle="compute.googleapis.com/instance/cpu/utilization (Mean across MIG)"
          unit="%"
          data={cpuData}
          threshold={config.alertCpuThresholdPct}
          thresholdLabel={`Alert > ${config.alertCpuThresholdPct}%`}
          primaryColor="#1a73e8"
          secondaryColor="#64748b"
          maxY={100}
          primaryLegend="Observed Mean CPU"
          secondaryLegend={`Autoscaler Target (${Math.round(config.targetCpuUtilization * 100)}%)`}
        />

        <TimeSeriesCard
          title="Managed Instance Group Replicas"
          subtitle={`Active healthy VMs vs Autoscaler target (${config.minReplicas}–${config.maxReplicas})`}
          unit=" VMs"
          data={replicaData}
          primaryColor="#0f766e"
          secondaryColor="#94a3b8"
          maxY={Math.max(config.maxReplicas, 6)}
          primaryLegend="Active Healthy VMs"
          secondaryLegend="Desired Replicas"
        />

        <TimeSeriesCard
          title="Global Load Balancer Request Rate"
          subtitle="loadbalancing.googleapis.com/https/request_count (req/s)"
          unit=" rps"
          data={rpsData}
          primaryColor="#2563eb"
          maxY={Math.ceil(maxRps / 500) * 500}
          primaryLegend="Incoming Requests/sec"
        />

        <TimeSeriesCard
          title="Backend P95 Response Latency"
          subtitle="loadbalancing.googleapis.com/https/backend_latencies (ms)"
          unit=" ms"
          data={latencyData}
          threshold={config.alertLatencyMs}
          thresholdLabel={`SLO > ${config.alertLatencyMs}ms`}
          primaryColor="#4f46e5"
          maxY={Math.max(500, config.alertLatencyMs * 1.6, ...history.map((h) => h.p95LatencyMs * 1.2))}
          primaryLegend="P95 Backend Latency (ms)"
        />
      </div>

      {/* Cloud Monitoring Alerting Policies & Threshold Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Cloud Monitoring Alert Policies</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Notification channel: {config.notificationChannel} · Evaluated every 60s alignment window
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2 text-slate-700">
              <span>CPU Alert (%)</span>
              <input
                type="number"
                min={50}
                max={98}
                value={config.alertCpuThresholdPct}
                onChange={(e) => onUpdateAlertConfig({ alertCpuThresholdPct: Number(e.target.value) || 80 })}
                className="w-16 px-2 py-1 font-mono border border-slate-300 rounded-md text-slate-900 tabular-nums"
              />
            </label>
            <label className="flex items-center gap-2 text-slate-700">
              <span>P95 Latency SLO (ms)</span>
              <input
                type="number"
                min={50}
                max={2000}
                step={25}
                value={config.alertLatencyMs}
                onChange={(e) => onUpdateAlertConfig({ alertLatencyMs: Number(e.target.value) || 250 })}
                className="w-20 px-2 py-1 font-mono border border-slate-300 rounded-md text-slate-900 tabular-nums"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-2.5 pr-4">Policy Name</th>
                <th className="py-2.5 pr-4">Metric Filter</th>
                <th className="py-2.5 pr-4">Condition</th>
                <th className="py-2.5 pr-4 text-right">Current</th>
                <th className="py-2.5 text-right">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-slate-50/70">
                  <td className="py-3 pr-4 font-medium text-slate-900">{alert.name}</td>
                  <td className="py-3 pr-4 font-mono text-slate-600">{alert.metric}</td>
                  <td className="py-3 pr-4 font-mono text-slate-700">
                    {alert.condition} ({alert.duration})
                  </td>
                  <td className="py-3 pr-4 text-right font-mono font-medium text-slate-900 tabular-nums">
                    {alert.currentValue}
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        alert.status === 'FIRING' ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {alert.status === 'FIRING' ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {alert.status === 'FIRING' ? 'Incident Firing' : 'Nominal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cloud Logging & Autoscaling Audit Stream */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900">Cloud Logging & Autoscaling Audit Trail</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time stream of MIG scaling decisions, health probe transitions, and startup script completions
        </p>

        <div className="mt-4 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No infrastructure events recorded yet. Adjust traffic or trigger a rolling update to observe activity.
            </div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono text-slate-400 tabular-nums shrink-0">{ev.timestamp}</span>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      ev.severity === 'CRITICAL'
                        ? 'text-red-700'
                        : ev.severity === 'WARNING'
                        ? 'text-amber-700'
                        : 'text-blue-700'
                    }`}
                  >
                    {ev.category}
                  </span>
                  <span className="font-mono text-slate-600 shrink-0">{ev.target}</span>
                  <span className="text-slate-800">{ev.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
