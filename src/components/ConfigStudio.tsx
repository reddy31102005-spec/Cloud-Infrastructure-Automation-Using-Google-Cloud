import React from 'react';
import { GCP_REGIONS, MACHINE_SPECS } from '../data/presets';
import { InfraConfig, MachineTypeId } from '../types/infra';

interface ConfigStudioProps {
  config: InfraConfig;
  activeInstanceCount: number;
  onChange: (patch: Partial<InfraConfig>) => void;
}

export const ConfigStudio: React.FC<ConfigStudioProps> = ({
  config,
  activeInstanceCount,
  onChange,
}) => {
  const machineSpec = MACHINE_SPECS[config.machineType];
  const minMonthlyUsd = machineSpec.hourlyUsd * 730 * config.minReplicas;
  const currentMonthlyUsd = machineSpec.hourlyUsd * 730 * activeInstanceCount;
  const maxMonthlyUsd = machineSpec.hourlyUsd * 730 * config.maxReplicas;

  const handleRegionChange = (region: string) => {
    const zones = GCP_REGIONS[region] || GCP_REGIONS['us-central1'];
    onChange({ region, zones });
  };

  return (
    <div className="space-y-6">
      {/* Monthly Cost & Capacity Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <div className="text-xs text-slate-500">Machine Capacity / Node</div>
          <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-1">
            {machineSpec.vcpu} vCPU · {machineSpec.memoryGb} GB
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Up to {machineSpec.maxRpsPerInstance.toLocaleString()} req/s per VM
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Total Fleet Max Capacity</div>
          <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-1">
            {(machineSpec.maxRpsPerInstance * config.maxReplicas).toLocaleString()} req/s
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Across {config.maxReplicas} max replicas in 3 zones
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Current Run-Rate (Compute)</div>
          <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-1">
            ${currentMonthlyUsd.toFixed(2)} / mo
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {activeInstanceCount} active VMs @ ${machineSpec.hourlyUsd.toFixed(4)}/hr
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Autoscaling Spend Envelope</div>
          <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-1">
            ${minMonthlyUsd.toFixed(0)} – ${maxMonthlyUsd.toFixed(0)} / mo
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Min {config.minReplicas} to Max {config.maxReplicas} nodes
          </div>
        </div>
      </div>

      {/* 2-Column Configuration Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compute Engine Instance Template */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="pb-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Compute Engine Instance Template</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable VM specification used by the Regional Managed Instance Group
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="block">
              <span className="font-medium text-slate-700">Project ID</span>
              <input
                type="text"
                value={config.projectId}
                onChange={(e) => onChange({ projectId: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Template Name</span>
              <input
                type="text"
                value={config.templateName}
                onChange={(e) => onChange({ templateName: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">GCP Region (3-Zone Spread)</span>
              <select
                value={config.region}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {Object.keys(GCP_REGIONS).map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Machine Type</span>
              <select
                value={config.machineType}
                onChange={(e) => onChange({ machineType: e.target.value as MachineTypeId })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {Object.values(MACHINE_SPECS).map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.id} ({spec.vcpu} vCPU, {spec.memoryGb} GB)
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">OS Image Family</span>
              <select
                value={`${config.sourceImageProject}/${config.sourceImageFamily}`}
                onChange={(e) => {
                  const [proj, fam] = e.target.value.split('/');
                  onChange({ sourceImageProject: proj, sourceImageFamily: fam });
                }}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="debian-cloud/debian-12">debian-cloud / debian-12</option>
                <option value="ubuntu-os-cloud/ubuntu-2404-lts-amd64">ubuntu-os-cloud / ubuntu-2404-lts</option>
                <option value="rocky-linux-cloud/rocky-linux-9">rocky-linux-cloud / rocky-linux-9</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="font-medium text-slate-700">Boot Disk (GB)</span>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={config.bootDiskSizeGb}
                  onChange={(e) => onChange({ bootDiskSizeGb: Math.max(10, Number(e.target.value) || 20) })}
                  className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
                />
              </label>
              <label className="block">
                <span className="font-medium text-slate-700">Disk Type</span>
                <select
                  value={config.bootDiskType}
                  onChange={(e) =>
                    onChange({ bootDiskType: e.target.value as InfraConfig['bootDiskType'] })
                  }
                  className="mt-1.5 w-full px-2.5 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 bg-white"
                >
                  <option value="pd-balanced">pd-balanced</option>
                  <option value="pd-ssd">pd-ssd</option>
                  <option value="pd-standard">pd-standard</option>
                </select>
              </label>
            </div>
          </div>

          <label className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs cursor-pointer">
            <div>
              <div className="font-medium text-slate-800">Shielded VM (Secure Boot + vTPM + Integrity)</div>
              <div className="text-slate-500">Protects Compute Engine nodes against rootkits and boot tampering</div>
            </div>
            <input
              type="checkbox"
              checked={config.enableShieldedVm}
              onChange={(e) => onChange({ enableShieldedVm: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
          </label>
        </div>

        {/* Regional MIG & Autoscaling Policy */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="pb-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Managed Instance Group & Autoscaler</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-zone elasticity, cooldown window, and scale-in stabilization controls
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="block">
              <span className="font-medium text-slate-700">MIG Resource Name</span>
              <input
                type="text"
                value={config.migName}
                onChange={(e) => onChange({ migName: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Autoscaling Signal</span>
              <select
                value={config.autoscalingMetric}
                onChange={(e) =>
                  onChange({ autoscalingMetric: e.target.value as InfraConfig['autoscalingMetric'] })
                }
                className="mt-1.5 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                <option value="cpu">CPU Utilization Target</option>
                <option value="http-lb">HTTP Load Balancing Capacity</option>
              </select>
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Minimum Replicas</span>
              <input
                type="number"
                min={1}
                max={config.maxReplicas}
                value={config.minReplicas}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(config.maxReplicas, Number(e.target.value) || 1));
                  onChange({ minReplicas: val });
                }}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Maximum Replicas</span>
              <input
                type="number"
                min={config.minReplicas}
                max={32}
                value={config.maxReplicas}
                onChange={(e) => {
                  const val = Math.max(config.minReplicas, Math.min(32, Number(e.target.value) || 6));
                  onChange({ maxReplicas: val });
                }}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">
                {config.autoscalingMetric === 'cpu'
                  ? `Target CPU (${Math.round(config.targetCpuUtilization * 100)}%)`
                  : `Target LB Capacity (${Math.round(config.targetLbUtilization * 100)}%)`}
              </span>
              <input
                type="range"
                min={30}
                max={90}
                step={5}
                value={
                  config.autoscalingMetric === 'cpu'
                    ? Math.round(config.targetCpuUtilization * 100)
                    : Math.round(config.targetLbUtilization * 100)
                }
                onChange={(e) => {
                  const ratio = Number(e.target.value) / 100;
                  if (config.autoscalingMetric === 'cpu') {
                    onChange({ targetCpuUtilization: ratio });
                  } else {
                    onChange({ targetLbUtilization: ratio });
                  }
                }}
                className="mt-3 w-full accent-blue-600"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Initialization Cooldown (sec)</span>
              <input
                type="number"
                min={30}
                max={300}
                step={15}
                value={config.cooldownPeriodSec}
                onChange={(e) => onChange({ cooldownPeriodSec: Math.max(30, Number(e.target.value) || 60) })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Scale-In Max Reduced (10m window)</span>
              <input
                type="number"
                min={1}
                max={8}
                value={config.scaleInControlMaxReduced}
                onChange={(e) => onChange({ scaleInControlMaxReduced: Math.max(1, Number(e.target.value) || 1) })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="font-medium text-slate-700">Max Surge</span>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={config.maxSurge}
                  onChange={(e) => onChange({ maxSurge: Math.max(0, Number(e.target.value) || 0) })}
                  className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
                />
              </label>
              <label className="block">
                <span className="font-medium text-slate-700">Max Unavailable</span>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={config.maxUnavailable}
                  onChange={(e) => onChange({ maxUnavailable: Math.max(0, Number(e.target.value) || 0) })}
                  className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Global HTTP(S) Load Balancer & Health Check */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 lg:col-span-2">
          <div className="pb-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Global HTTP(S) Load Balancer & Health Checks</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Anycast frontend forwarding rule, Cloud Armor edge policy, and MIG auto-healing probe parameters
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <label className="block">
              <span className="font-medium text-slate-700">Load Balancer Name</span>
              <input
                type="text"
                value={config.lbName}
                onChange={(e) => onChange({ lbName: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Frontend Protocol</span>
              <select
                value={config.lbProtocol}
                onChange={(e) => onChange({ lbProtocol: e.target.value as 'HTTP' | 'HTTPS' })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                <option value="HTTPS">HTTPS (Managed TLS :443)</option>
                <option value="HTTP">HTTP (:80)</option>
              </select>
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Health Check Path</span>
              <input
                type="text"
                value={config.healthCheckPath}
                onChange={(e) => onChange({ healthCheckPath: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Backend Port</span>
              <input
                type="number"
                min={80}
                max={65535}
                value={config.healthCheckPort}
                onChange={(e) => onChange({ healthCheckPort: Number(e.target.value) || 80 })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Check Interval (sec)</span>
              <input
                type="number"
                min={2}
                max={60}
                value={config.checkIntervalSec}
                onChange={(e) => onChange({ checkIntervalSec: Number(e.target.value) || 10 })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
              />
            </label>

            <label className="block">
              <span className="font-medium text-slate-700">Timeout (sec)</span>
              <input
                type="number"
                min={1}
                max={config.checkIntervalSec}
                value={config.timeoutSec}
                onChange={(e) => onChange({ timeoutSec: Number(e.target.value) || 5 })}
                className="mt-1.5 w-full px-3 py-2 font-mono border border-slate-300 rounded-lg text-slate-900 tabular-nums"
              />
            </label>

            <label className="flex items-center gap-2.5 pt-6 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableCloudArmor}
                onChange={(e) => onChange({ enableCloudArmor: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span className="font-medium text-slate-800">Enable Cloud Armor WAF</span>
            </label>

            <label className="flex items-center gap-2.5 pt-6 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableCloudCdn}
                onChange={(e) => onChange({ enableCloudCdn: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span className="font-medium text-slate-800">Enable Cloud CDN Caching</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
