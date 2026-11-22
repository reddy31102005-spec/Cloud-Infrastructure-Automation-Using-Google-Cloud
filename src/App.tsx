import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Code2,
  Cpu,
  Download,
  Menu,
  Network,
  Pause,
  Play,
  RotateCcw,
  ServerCog,
  Terminal,
  X,
} from 'lucide-react';
import { ConfigStudio } from './components/ConfigStudio';
import { IacBundleView } from './components/IacBundleView';
import { MonitoringCharts } from './components/MonitoringCharts';
import { StartupDeployPanel } from './components/StartupDeployPanel';
import { TopologyCanvas } from './components/TopologyCanvas';
import { ENVIRONMENT_PRESETS, MACHINE_SPECS } from './data/presets';
import {
  AlertPolicyState,
  DeploymentEvent,
  InfraConfig,
  NavTab,
  SimulatedInstance,
  TelemetryPoint,
  TrafficProfile,
} from './types/infra';

function formatClock(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

function randomOctet(): number {
  return Math.floor(Math.random() * 200) + 20;
}

function createInstance(
  config: InfraConfig,
  zone: string,
  index: number,
  staging: boolean,
  appVersionOverride?: string
): SimulatedInstance {
  const suffix = Math.random().toString(36).substring(2, 6);
  const name = `${config.baseInstanceName}-${zone.slice(-1)}${index}-${suffix}`;
  return {
    id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    zone,
    internalIp: `10.128.${index % 15}.${randomOctet()}`,
    externalIp: `35.${190 + (index % 30)}.${randomOctet()}.${randomOctet()}`,
    status: staging ? 'STAGING' : 'RUNNING',
    healthState: staging ? 'PROBING' : 'HEALTHY',
    cpuPercent: staging ? 42 : 28,
    memoryPercent: staging ? 38 : 44,
    rps: 0,
    latencyMs: 24,
    uptimeSec: staging ? 0 : 1420,
    appVersion: appVersionOverride ?? config.appVersion,
    startupStage: staging ? 'Fetching metadata.startup-script' : 'Startup script completed (exit 0)',
    startupProgress: staging ? 20 : 100,
  };
}

function buildInitialInstances(config: InfraConfig): SimulatedInstance[] {
  return Array.from({ length: config.minReplicas }, (_, idx) => {
    const zone = config.zones[idx % config.zones.length];
    return createInstance(config, zone, idx + 1, false);
  });
}

function buildInitialHistory(config: InfraConfig): TelemetryPoint[] {
  const spec = MACHINE_SPECS[config.machineType];
  const baseRps = Math.round(config.minReplicas * spec.maxRpsPerInstance * 0.38);
  const now = Date.now();
  return Array.from({ length: 18 }, (_, i) => {
    const t = new Date(now - (17 - i) * 10000);
    const wave = Math.sin(i * 0.5) * 0.06;
    const rps = Math.max(120, Math.round(baseRps * (1 + wave)));
    const cap = config.minReplicas * spec.maxRpsPerInstance;
    const cpu = Math.min(95, Math.max(14, (rps / cap) * 100 * 0.85));
    return {
      tick: i,
      timestamp: formatClock(t),
      incomingRps: rps,
      avgCpuPct: Number(cpu.toFixed(1)),
      targetCpuPct: Math.round(config.targetCpuUtilization * 100),
      activeInstances: config.minReplicas,
      desiredInstances: config.minReplicas,
      p95LatencyMs: Math.round(22 + cpu * 0.45),
      errorRatePct: 0.04,
    };
  });
}

const STARTUP_STAGES = [
  { progress: 25, label: 'Fetching metadata.startup-script' },
  { progress: 50, label: 'Installing runtime & Cloud Ops Agent' },
  { progress: 75, label: 'Configuring service & /healthz endpoint' },
  { progress: 100, label: 'Startup script completed (exit 0)' },
];

export default function App() {
  const [presetKey, setPresetKey] = useState<string>('prod-web');
  const [config, setConfig] = useState<InfraConfig>(ENVIRONMENT_PRESETS['prod-web']);
  const [activeTab, setActiveTab] = useState<NavTab>('topology');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [instances, setInstances] = useState<SimulatedInstance[]>(() =>
    buildInitialInstances(ENVIRONMENT_PRESETS['prod-web'])
  );
  const [history, setHistory] = useState<TelemetryPoint[]>(() =>
    buildInitialHistory(ENVIRONMENT_PRESETS['prod-web'])
  );
  const [events, setEvents] = useState<DeploymentEvent[]>(() => [
    {
      id: 'init-1',
      timestamp: formatClock(new Date()),
      category: 'STARTUP_SCRIPT',
      severity: 'INFO',
      target: ENVIRONMENT_PRESETS['prod-web'].migName,
      message: `Initialized ${ENVIRONMENT_PRESETS['prod-web'].minReplicas} Compute Engine instances across 3 zones.`,
    },
  ]);

  const [isSimRunning, setIsSimRunning] = useState(true);
  const [trafficProfile, setTrafficProfile] = useState<TrafficProfile>('steady');
  const [manualRps, setManualRps] = useState<number>(1100);
  const [failedZone, setFailedZone] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [isRollingOut, setIsRollingOut] = useState(false);

  const tickRef = useRef<number>(18);
  const cooldownTicksRef = useRef<number>(0);
  const rolloutQueueRef = useRef<string[]>([]);

  const pushEvent = useCallback(
    (
      category: DeploymentEvent['category'],
      severity: DeploymentEvent['severity'],
      target: string,
      message: string
    ) => {
      setEvents((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: formatClock(new Date()),
          category,
          severity,
          target,
          message,
        },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  const handleSelectPreset = (key: string) => {
    const next = ENVIRONMENT_PRESETS[key];
    if (!next) return;
    setPresetKey(key);
    setConfig(next);
    setInstances(buildInitialInstances(next));
    setHistory(buildInitialHistory(next));
    setFailedZone(null);
    setSelectedInstanceId(null);
    setIsRollingOut(false);
    rolloutQueueRef.current = [];
    cooldownTicksRef.current = 0;
    setManualRps(Math.round(next.minReplicas * MACHINE_SPECS[next.machineType].maxRpsPerInstance * 0.42));
    pushEvent(
      'MONITORING',
      'INFO',
      next.projectId,
      `Switched workspace to ${next.environmentName} (${next.region}).`
    );
  };

  const handleUpdateConfig = (patch: Partial<InfraConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleTerminateInstance = (id: string) => {
    const target = instances.find((i) => i.id === id);
    if (!target) return;
    setInstances((prev) => prev.filter((i) => i.id !== id));
    setSelectedInstanceId(null);
    pushEvent(
      'HEALTH_CHECK',
      'CRITICAL',
      target.name,
      `Instance stopped responding to ${config.healthCheckPath}; MIG auto-healing triggered replacement.`
    );
  };

  const handleToggleZoneFailure = (zone: string) => {
    if (failedZone === zone) {
      setFailedZone(null);
      pushEvent('AUTOSCALER', 'INFO', zone, `Zone ${zone} restored. Regional MIG rebalancing enabled.`);
    } else {
      setFailedZone(zone);
      setInstances((prev) => prev.filter((i) => i.zone !== zone));
      pushEvent(
        'HEALTH_CHECK',
        'CRITICAL',
        zone,
        `Simulated outage in ${zone}. Traffic drained and MIG redistributing capacity to healthy zones.`
      );
    }
  };

  const handleTriggerRollout = () => {
    if (isRollingOut) return;
    const ids = instances.map((i) => i.id);
    if (ids.length === 0) return;
    rolloutQueueRef.current = ids;
    setIsRollingOut(true);
    pushEvent(
      'ROLLOUT',
      'INFO',
      config.migName,
      `Started PROACTIVE rolling replacement to ${config.appVersion} (maxSurge=${config.maxSurge}, maxUnavailable=${config.maxUnavailable}).`
    );
  };

  const handleResetSimulation = () => {
    setInstances(buildInitialInstances(config));
    setHistory(buildInitialHistory(config));
    setFailedZone(null);
    setTrafficProfile('steady');
    setIsRollingOut(false);
    rolloutQueueRef.current = [];
    cooldownTicksRef.current = 0;
    pushEvent('MONITORING', 'INFO', config.migName, 'Simulation state reset to baseline configuration.');
  };

  // Core Autoscaler, Health-Check, Startup Script & Monitoring Telemetry Loop
  useEffect(() => {
    if (!isSimRunning) return;

    const timer = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;
      const spec = MACHINE_SPECS[config.machineType];

      // 1. Compute incoming RPS for this tick
      const baseRps = config.minReplicas * spec.maxRpsPerInstance * 0.42;
      let targetRps = manualRps;
      if (trafficProfile === 'steady') {
        targetRps = Math.round(baseRps * (1 + Math.sin(tick * 0.4) * 0.08));
      } else if (trafficProfile === 'spike') {
        targetRps = Math.round(
          Math.min(config.maxReplicas * spec.maxRpsPerInstance * 0.88, config.minReplicas * spec.maxRpsPerInstance * 1.95) *
            (0.94 + Math.random() * 0.12)
        );
      } else if (trafficProfile === 'ramp') {
        const factor = 0.35 + ((Math.sin(tick * 0.22) + 1) / 2) * 1.45;
        targetRps = Math.round(config.minReplicas * spec.maxRpsPerInstance * factor);
      }
      targetRps = Math.max(80, targetRps);

      // 2. Advance instances (Startup script execution, rolling update, CPU & latency)
      setInstances((prevInstances) => {
        let next = prevInstances.map((vm) => {
          if (vm.status === 'STAGING' || vm.status === 'UPDATING') {
            const nextProgress = Math.min(100, vm.startupProgress + 25);
            const stageObj =
              STARTUP_STAGES.find((s) => nextProgress <= s.progress) || STARTUP_STAGES[STARTUP_STAGES.length - 1];
            const finished = nextProgress >= 100;
            return {
              ...vm,
              startupProgress: nextProgress,
              startupStage: stageObj.label,
              status: finished ? ('RUNNING' as const) : vm.status,
              healthState: finished ? ('HEALTHY' as const) : ('PROBING' as const),
              uptimeSec: vm.uptimeSec + 2,
            };
          }
          return { ...vm, uptimeSec: vm.uptimeSec + 2 };
        });

        // Handle rolling update batching
        if (rolloutQueueRef.current.length > 0) {
          const updatingCount = next.filter((v) => v.status === 'UPDATING').length;
          const batchLimit = Math.max(1, config.maxSurge || 1);
          if (updatingCount < batchLimit) {
            const nextId = rolloutQueueRef.current.shift();
            next = next.map((vm) =>
              vm.id === nextId
                ? {
                    ...vm,
                    status: 'UPDATING',
                    healthState: 'PROBING',
                    appVersion: config.appVersion,
                    startupProgress: 25,
                    startupStage: 'Replacing VM with new template & startup script',
                  }
                : vm
            );
          }
          if (rolloutQueueRef.current.length === 0) {
            setIsRollingOut(false);
            pushEvent(
              'ROLLOUT',
              'INFO',
              config.migName,
              `Rolling update to ${config.appVersion} dispatched across all MIG instances.`
            );
          }
        }

        const healthyZones = config.zones.filter((z) => z !== failedZone);
        const targetZones = healthyZones.length > 0 ? healthyZones : config.zones;

        // Calculate load across healthy running VMs
        const healthyVms = next.filter((v) => v.status === 'RUNNING' && v.healthState === 'HEALTHY');
        const effectiveCount = Math.max(1, healthyVms.length);
        const rpsPerVm = targetRps / effectiveCount;
        const cpuLoadRatio = rpsPerVm / spec.maxRpsPerInstance;

        next = next.map((vm) => {
          if (vm.status !== 'RUNNING') {
            return { ...vm, rps: 0, cpuPercent: 35 };
          }
          const jitter = 0.94 + Math.random() * 0.12;
          const cpu = Math.min(99, Math.max(8, cpuLoadRatio * 100 * 0.88 * jitter));
          const latency = Math.round(18 + Math.pow(cpu / 25, 2.1) * 8);
          return {
            ...vm,
            rps: Math.round(rpsPerVm * jitter),
            cpuPercent: Number(cpu.toFixed(1)),
            latencyMs: latency,
            memoryPercent: Number(Math.min(92, 34 + cpu * 0.35).toFixed(1)),
          };
        });

        // Autoscaler & Auto-healing evaluation
        const avgCpu =
          healthyVms.length > 0
            ? next
                .filter((v) => v.status === 'RUNNING')
                .reduce((sum, v) => sum + v.cpuPercent, 0) / Math.max(1, healthyVms.length)
            : 100;

        let desiredReplicas = next.length;
        if (config.autoscalingMetric === 'cpu') {
          const totalCpuDemand = (avgCpu / 100) * Math.max(1, healthyVms.length);
          desiredReplicas = Math.ceil(totalCpuDemand / config.targetCpuUtilization);
        } else {
          desiredReplicas = Math.ceil(targetRps / (spec.maxRpsPerInstance * config.targetLbUtilization));
        }

        desiredReplicas = Math.max(config.minReplicas, Math.min(config.maxReplicas, desiredReplicas));

        if (cooldownTicksRef.current > 0) {
          cooldownTicksRef.current -= 1;
        }

        // Auto-heal or Scale-Out
        if (next.length < config.minReplicas || desiredReplicas > next.length) {
          const toAdd = Math.min(
            Math.max(config.minReplicas - next.length, desiredReplicas - next.length),
            2
          );
          for (let k = 0; k < toAdd; k++) {
            const zone = targetZones[(next.length + k) % targetZones.length];
            const created = createInstance(config, zone, next.length + 1, true);
            next.push(created);
          }
          cooldownTicksRef.current = Math.max(3, Math.round(config.cooldownPeriodSec / 15));
          pushEvent(
            'AUTOSCALER',
            'INFO',
            config.migName,
            `Scaled out +${toAdd} VM(s) in ${targetZones[0]} (Target ${desiredReplicas} replicas, Load ${targetRps} rps).`
          );
        } else if (desiredReplicas < next.length && cooldownTicksRef.current === 0 && !isRollingOut) {
          const removable = next.filter((v) => v.status === 'RUNNING');
          const removeCount = Math.min(
            next.length - desiredReplicas,
            config.scaleInControlMaxReduced,
            removable.length
          );
          if (removeCount > 0) {
            const removedIds = new Set(removable.slice(-removeCount).map((v) => v.id));
            next = next.filter((v) => !removedIds.has(v.id));
            cooldownTicksRef.current = Math.max(4, Math.round(config.cooldownPeriodSec / 15));
            pushEvent(
              'AUTOSCALER',
              'INFO',
              config.migName,
              `Scaled in -${removeCount} VM(s) after cooldown window (${next.length} active replicas).`
            );
          }
        }

        // Append telemetry history point
        const finalRunning = next.filter((v) => v.status === 'RUNNING');
        const observedCpu =
          finalRunning.length > 0
            ? finalRunning.reduce((s, v) => s + v.cpuPercent, 0) / finalRunning.length
            : 0;
        const p95Latency =
          finalRunning.length > 0
            ? Math.max(...finalRunning.map((v) => v.latencyMs))
            : 180;
        const overloaded = observedCpu > 90;

        setHistory((prevHist) => [
          ...prevHist.slice(-29),
          {
            tick,
            timestamp: formatClock(new Date()),
            incomingRps: targetRps,
            avgCpuPct: Number(observedCpu.toFixed(1)),
            targetCpuPct: Math.round(config.targetCpuUtilization * 100),
            activeInstances: finalRunning.length,
            desiredInstances: desiredReplicas,
            p95LatencyMs: p95Latency,
            errorRatePct: overloaded ? 2.8 : 0.03,
          },
        ]);

        return next;
      });
    }, 1400);

    return () => clearInterval(timer);
  }, [config, failedZone, isRollingOut, isSimRunning, manualRps, pushEvent, trafficProfile]);

  const latestTelemetry = history[history.length - 1];
  const healthyCount = instances.filter((i) => i.status === 'RUNNING' && i.healthState === 'HEALTHY').length;

  const alertPolicies: AlertPolicyState[] = useMemo(() => {
    const cpuVal = latestTelemetry?.avgCpuPct ?? 0;
    const latVal = latestTelemetry?.p95LatencyMs ?? 0;
    const errVal = latestTelemetry?.errorRatePct ?? 0;
    return [
      {
        id: 'cpu-high',
        name: 'MIG Mean CPU Utilization',
        metric: 'compute.googleapis.com/instance/cpu/utilization',
        condition: `> ${config.alertCpuThresholdPct}%`,
        duration: '180s',
        status: cpuVal > config.alertCpuThresholdPct ? 'FIRING' : 'OK',
        currentValue: `${cpuVal.toFixed(1)}%`,
      },
      {
        id: 'lb-latency',
        name: 'HTTP(S) LB P95 Backend Latency',
        metric: 'loadbalancing.googleapis.com/https/backend_latencies',
        condition: `> ${config.alertLatencyMs} ms`,
        duration: '120s',
        status: latVal > config.alertLatencyMs ? 'FIRING' : 'OK',
        currentValue: `${latVal} ms`,
      },
      {
        id: 'lb-5xx',
        name: 'Backend 5xx Error Ratio',
        metric: 'loadbalancing.googleapis.com/https/request_count',
        condition: `> ${config.alertErrorRatePct.toFixed(1)}%`,
        duration: '60s',
        status: errVal > config.alertErrorRatePct ? 'FIRING' : 'OK',
        currentValue: `${errVal.toFixed(2)}%`,
      },
      {
        id: 'mig-capacity',
        name: 'Healthy Regional Instance Floor',
        metric: 'compute.googleapis.com/instance_group/size',
        condition: `< ${config.minReplicas} VMs`,
        duration: '60s',
        status: healthyCount < config.minReplicas ? 'FIRING' : 'OK',
        currentValue: `${healthyCount} / ${config.minReplicas} min`,
      },
    ];
  }, [config, healthyCount, latestTelemetry]);

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'topology', label: 'Architecture & Sim', icon: <Network className="w-4 h-4" /> },
    { id: 'compute', label: 'Compute & MIG', icon: <ServerCog className="w-4 h-4" /> },
    { id: 'monitoring', label: 'Cloud Monitoring', icon: <Activity className="w-4 h-4" /> },
    { id: 'startup', label: 'Startup & Rollouts', icon: <Terminal className="w-4 h-4" /> },
    { id: 'iac', label: 'Automation Bundle', icon: <Code2 className="w-4 h-4" /> },
  ];

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label ?? 'Architecture';
  const firingCount = alertPolicies.filter((a) => a.status === 'FIRING').length;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-14 px-5 flex items-center border-b border-slate-200">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            CloudScale GCP
          </span>
        </div>

        {/* Project Preset Selector */}
        <div className="p-4 border-b border-slate-200">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Cloud Project Blueprint
          </label>
          <select
            value={presetKey}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="w-full px-2.5 py-2 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="prod-web">prod-scalable-web-01 (us-central1)</option>
            <option value="api-eu">eu-payments-gateway-04 (europe-west1)</option>
            <option value="staging-compute">staging-compute-sandbox (asia-northeast1)</option>
          </select>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quiet Architecture Summary Footer */}
        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
          <div className="flex items-center justify-between">
            <span>Region</span>
            <span className="font-mono text-slate-800">{config.region}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Machine</span>
            <span className="font-mono text-slate-800">{config.machineType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Release</span>
            <span className="font-mono text-slate-800">{config.appVersion}</span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-xs bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="font-display text-base font-bold text-slate-900">CloudScale GCP</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200">
              <select
                value={presetKey}
                onChange={(e) => {
                  handleSelectPreset(e.target.value);
                  setMobileMenuOpen(false);
                }}
                className="w-full px-2.5 py-2 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="prod-web">prod-scalable-web-01</option>
                <option value="api-eu">eu-payments-gateway-04</option>
                <option value="staging-compute">staging-compute-sandbox</option>
              </select>
            </div>
            <nav className="p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, Single Primary Action on Right */}
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">Projects</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-mono text-slate-700 truncate">{config.projectId}</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('iac')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export IaC Bundle
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1360px] w-full mx-auto space-y-6">
          {/* Interactive Simulation & KPI Control Strip */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-slate-900">
                  {config.environmentName}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compute Engine · Global {config.lbProtocol} Load Balancer · Regional MIG ({config.minReplicas}–
                  {config.maxReplicas} VMs) · Cloud Monitoring
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Traffic Profile Segmented Control */}
                <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
                  {(
                    [
                      { id: 'steady', label: 'Steady' },
                      { id: 'spike', label: 'Traffic Spike' },
                      { id: 'ramp', label: 'Auto Wave' },
                      { id: 'manual', label: 'Manual RPS' },
                    ] as { id: TrafficProfile; label: string }[]
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setTrafficProfile(mode.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        trafficProfile === mode.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsSimRunning((s) => !s)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isSimRunning ? 'Pause Sim' : 'Resume Sim'}
                </button>

                <button
                  type="button"
                  onClick={handleResetSimulation}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>

            {/* Manual RPS Slider when Manual mode is active */}
            {trafficProfile === 'manual' && (
              <div className="py-3 border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-medium text-slate-700 whitespace-nowrap">
                  Simulated Load Balancer Ingress:
                </span>
                <input
                  type="range"
                  min={150}
                  max={config.maxReplicas * MACHINE_SPECS[config.machineType].maxRpsPerInstance}
                  step={50}
                  value={manualRps}
                  onChange={(e) => setManualRps(Number(e.target.value))}
                  className="flex-1 min-w-[200px] accent-blue-600"
                />
                <span className="font-mono font-semibold text-slate-900 tabular-nums w-24 text-right">
                  {manualRps.toLocaleString()} req/s
                </span>
              </div>
            )}

            {/* 4-Column Live Telemetry Strip */}
            <div className="pt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-slate-500">Load Balancer Ingress</div>
                <div className="text-xl font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {(latestTelemetry?.incomingRps ?? 0).toLocaleString()} req/s
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  P95 Latency: {latestTelemetry?.p95LatencyMs ?? 0} ms
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">MIG Fleet Capacity</div>
                <div className="text-xl font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {healthyCount} / {instances.length} healthy
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  Autoscaler Bounds: {config.minReplicas}–{config.maxReplicas} VMs
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mean Fleet CPU</span>
                </div>
                <div className="text-xl font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {(latestTelemetry?.avgCpuPct ?? 0).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  Autoscaler Target: {Math.round(config.targetCpuUtilization * 100)}%
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Cloud Monitoring Alerts</div>
                <div
                  className={`text-xl font-mono font-semibold tabular-nums mt-0.5 ${
                    firingCount > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {firingCount > 0 ? `${firingCount} Firing` : 'All Nominal'}
                </div>
                <div className="text-xs text-slate-500">
                  {firingCount > 0 ? 'Threshold breached on active policy' : '4 active alert policies evaluated'}
                </div>
              </div>
            </div>
          </section>

          {/* Active Workspace Tab Viewport */}
          {activeTab === 'topology' && (
            <TopologyCanvas
              config={config}
              instances={instances}
              incomingRps={latestTelemetry?.incomingRps ?? 0}
              failedZone={failedZone}
              selectedInstanceId={selectedInstanceId}
              onSelectInstance={setSelectedInstanceId}
              onTerminateInstance={handleTerminateInstance}
              onToggleZoneFailure={handleToggleZoneFailure}
              onTriggerRollout={handleTriggerRollout}
              isRollingOut={isRollingOut}
            />
          )}

          {activeTab === 'compute' && (
            <ConfigStudio
              config={config}
              activeInstanceCount={instances.length}
              onChange={handleUpdateConfig}
            />
          )}

          {activeTab === 'monitoring' && (
            <MonitoringCharts
              config={config}
              history={history}
              events={events}
              alerts={alertPolicies}
              onUpdateAlertConfig={handleUpdateConfig}
            />
          )}

          {activeTab === 'startup' && (
            <StartupDeployPanel
              config={config}
              instances={instances}
              isRollingOut={isRollingOut}
              onChange={handleUpdateConfig}
              onTriggerRollout={handleTriggerRollout}
            />
          )}

          {activeTab === 'iac' && <IacBundleView config={config} />}
        </main>
      </div>
    </div>
  );
}
