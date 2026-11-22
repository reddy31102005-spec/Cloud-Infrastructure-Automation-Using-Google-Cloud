import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Globe,
  HardDrive,
  RefreshCw,
  Server,
  Shield,
  Sliders,
  Trash2,
} from 'lucide-react';
import { InfraConfig, SimulatedInstance } from '../types/infra';
import { MACHINE_SPECS } from '../data/presets';

interface TopologyCanvasProps {
  config: InfraConfig;
  instances: SimulatedInstance[];
  incomingRps: number;
  failedZone: string | null;
  selectedInstanceId: string | null;
  onSelectInstance: (id: string | null) => void;
  onTerminateInstance: (id: string) => void;
  onToggleZoneFailure: (zone: string) => void;
  onTriggerRollout: () => void;
  isRollingOut: boolean;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  config,
  instances,
  incomingRps,
  failedZone,
  selectedInstanceId,
  onSelectInstance,
  onTerminateInstance,
  onToggleZoneFailure,
  onTriggerRollout,
  isRollingOut,
}) => {
  const machineSpec = MACHINE_SPECS[config.machineType];
  const healthyInstances = instances.filter((i) => i.status === 'RUNNING' && i.healthState === 'HEALTHY');
  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) || null;

  const avgCpu =
    healthyInstances.length > 0
      ? healthyInstances.reduce((acc, item) => acc + item.cpuPercent, 0) / healthyInstances.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Architecture Flow Diagram */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Live Google Cloud Topology</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {config.projectId} · {config.region} · {config.networkName} ({config.subnetCidr})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTriggerRollout}
              disabled={isRollingOut}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRollingOut ? 'animate-spin text-blue-600' : ''}`} />
              {isRollingOut ? 'Rolling Update Active' : 'Run Rolling Update'}
            </button>
          </div>
        </div>

        {/* Tier 1: Global Anycast & HTTP(S) Load Balancer */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-4 border border-slate-200 rounded-lg p-4 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Global External {config.lbProtocol} LB</span>
                </div>
                <span className="text-xs font-mono text-slate-600 tabular-nums">34.117.84.210</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {config.lbName} · Forwarding Port {config.lbProtocol === 'HTTPS' ? '443' : '80'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Incoming Traffic</div>
                <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {incomingRps.toLocaleString()} req/s
                </div>
              </div>
              <div>
                <div className="text-slate-500">Edge Protection</div>
                <div className="font-medium text-slate-800 mt-0.5">
                  {config.enableCloudArmor ? 'Cloud Armor WAF' : 'Standard Proxy'}
                  {config.enableCloudCdn ? ' + CDN' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="w-full flex items-center">
              <div className="h-px flex-1 bg-slate-300" />
              <div className="text-xs font-mono text-slate-500 px-1.5">URL</div>
              <div className="h-px flex-1 bg-slate-300" />
            </div>
          </div>

          {/* Tier 2: Backend Service & Health Checks */}
          <div className="lg:col-span-3 border border-slate-200 rounded-lg p-4 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Backend Service & Probe</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {config.healthCheckName} · {config.healthCheckProtocol} {config.healthCheckPath}:
                {config.healthCheckPort}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Check Interval</div>
                <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {config.checkIntervalSec}s / {config.timeoutSec}s
                </div>
              </div>
              <div>
                <div className="text-slate-500">Healthy Pool</div>
                <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {healthyInstances.length} / {instances.length} VMs
                </div>
              </div>
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="w-full flex items-center">
              <div className="h-px flex-1 bg-slate-300" />
              <div className="text-xs font-mono text-slate-500 px-1.5">MIG</div>
              <div className="h-px flex-1 bg-slate-300" />
            </div>
          </div>

          {/* Tier 3: Autoscaler Policy Summary */}
          <div className="lg:col-span-3 border border-slate-200 rounded-lg p-4 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Sliders className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Regional Autoscaler</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {config.migName} · Range {config.minReplicas}–{config.maxReplicas} VMs
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Target Policy</div>
                <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {config.autoscalingMetric === 'cpu'
                    ? `CPU ${Math.round(config.targetCpuUtilization * 100)}%`
                    : `LB ${Math.round(config.targetLbUtilization * 100)}%`}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Fleet Avg CPU</div>
                <div
                  className={`font-mono font-semibold tabular-nums mt-0.5 ${
                    avgCpu > config.alertCpuThresholdPct
                      ? 'text-red-600'
                      : avgCpu > config.targetCpuUtilization * 100
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {avgCpu.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Regional Multi-Zone Compute Engine Fleet Grid */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Regional Managed Instance Group — {config.zones.length} Availability Zones
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Template: {config.templateName} · {config.machineType} ({machineSpec.vcpu} vCPU,{' '}
                {machineSpec.memoryGb} GB RAM) · Click any instance to inspect boot telemetry
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Toggle zone failure to test regional MIG failover:
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {config.zones.map((zone) => {
              const zoneInstances = instances.filter((i) => i.zone === zone);
              const isFailed = failedZone === zone;

              return (
                <div
                  key={zone}
                  className={`border rounded-lg p-4 transition-colors ${
                    isFailed ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-semibold text-slate-900 truncate">{zone}</div>
                      <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                        {isFailed ? 'Zone Outage Simulated' : `${zoneInstances.length} active nodes`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleZoneFailure(zone)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                        isFailed
                          ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {isFailed ? 'Restore Zone' : 'Simulate Outage'}
                    </button>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {zoneInstances.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-md bg-white">
                        {isFailed
                          ? 'Traffic drained · Instances redistributed to healthy zones'
                          : 'No instances scheduled in this zone'}
                      </div>
                    ) : (
                      zoneInstances.map((vm) => {
                        const isSelected = vm.id === selectedInstanceId;
                        const statusColor =
                          vm.status === 'RUNNING' && vm.healthState === 'HEALTHY'
                            ? 'text-emerald-700'
                            : vm.status === 'STAGING' || vm.status === 'UPDATING'
                            ? 'text-blue-700'
                            : vm.status === 'UNHEALTHY'
                            ? 'text-red-700'
                            : 'text-amber-700';

                        return (
                          <button
                            key={vm.id}
                            type="button"
                            onClick={() => onSelectInstance(isSelected ? null : vm.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors bg-white ${
                              isSelected
                                ? 'border-blue-600 ring-1 ring-blue-600'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Server className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="text-xs font-mono font-semibold text-slate-900 truncate">
                                  {vm.name}
                                </span>
                              </div>
                              <span className={`text-xs font-medium whitespace-nowrap shrink-0 ${statusColor}`}>
                                {vm.status === 'RUNNING' ? vm.healthState : vm.status}
                              </span>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                              <span className="font-mono">{vm.internalIp}</span>
                              <span>{vm.appVersion}</span>
                            </div>

                            {vm.status === 'STAGING' || vm.status === 'UPDATING' ? (
                              <div className="mt-2.5">
                                <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
                                  <span className="truncate">{vm.startupStage}</span>
                                  <span className="font-mono tabular-nums">{vm.startupProgress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600 transition-all duration-200"
                                    style={{ width: `${vm.startupProgress}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2.5 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs tabular-nums">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">CPU</span>
                                  <span
                                    className={`font-mono font-medium ${
                                      vm.cpuPercent > config.alertCpuThresholdPct
                                        ? 'text-red-600'
                                        : 'text-slate-900'
                                    }`}
                                  >
                                    {vm.cpuPercent.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Traffic</span>
                                  <span className="font-mono font-medium text-slate-900">{vm.rps} rps</span>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Compute Engine VM Inspector */}
      {selectedInstance && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-semibold text-slate-900 font-mono">
                {selectedInstance.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Zone {selectedInstance.zone} · Internal IP {selectedInstance.internalIp} · External IP{' '}
                {selectedInstance.externalIp}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onTerminateInstance(selectedInstance.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Simulate Instance Crash (Auto-Heal)
              </button>
              <button
                type="button"
                onClick={() => onSelectInstance(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Cpu className="w-3.5 h-3.5" />
                <span>CPU Utilization</span>
              </div>
              <div className="mt-1 text-base font-mono font-semibold text-slate-900 tabular-nums">
                {selectedInstance.cpuPercent.toFixed(1)}%
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Activity className="w-3.5 h-3.5" />
                <span>Health Probe</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-base font-semibold text-slate-900">
                {selectedInstance.healthState === 'HEALTHY' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>{selectedInstance.healthState}</span>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-1.5 text-slate-500">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Boot Disk & Image</span>
              </div>
              <div className="mt-1 text-sm font-mono font-semibold text-slate-900 tabular-nums">
                {config.bootDiskSizeGb} GB {config.bootDiskType}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-slate-500">Startup Script Stage</div>
              <div className="mt-1 text-sm font-medium text-slate-900 truncate">
                {selectedInstance.startupStage}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
