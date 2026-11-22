import React from 'react';
import { CheckCircle2, Play, RotateCcw, Terminal } from 'lucide-react';
import { STARTUP_PRESETS } from '../data/presets';
import { InfraConfig, SimulatedInstance, StartupPresetId } from '../types/infra';

interface StartupDeployPanelProps {
  config: InfraConfig;
  instances: SimulatedInstance[];
  isRollingOut: boolean;
  onChange: (patch: Partial<InfraConfig>) => void;
  onTriggerRollout: () => void;
}

export const StartupDeployPanel: React.FC<StartupDeployPanelProps> = ({
  config,
  instances,
  isRollingOut,
  onChange,
  onTriggerRollout,
}) => {
  const handleSelectPreset = (presetId: StartupPresetId) => {
    const preset = STARTUP_PRESETS[presetId];
    onChange({
      startupPreset: presetId,
      startupScript: preset.buildScript(config.appVersion, config.healthCheckPath, config.healthCheckPort),
    });
  };

  const handleResetScript = () => {
    const preset = STARTUP_PRESETS[config.startupPreset];
    onChange({
      startupScript: preset.buildScript(config.appVersion, config.healthCheckPath, config.healthCheckPort),
    });
  };

  return (
    <div className="space-y-6">
      {/* Startup Preset & Rolling Deployment Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Startup Script & Automated Deployment Pipeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Injected via Compute Engine <span className="font-mono">metadata.startup-script</span> on every scale-out
              and proactive rolling replacement
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <span>Release Tag</span>
              <input
                type="text"
                value={config.appVersion}
                onChange={(e) => onChange({ appVersion: e.target.value })}
                className="w-28 px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg text-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={onTriggerRollout}
              disabled={isRollingOut}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              {isRollingOut ? 'Rolling Replacement In Progress' : 'Deploy Rolling Update'}
            </button>
          </div>
        </div>

        {/* Preset Selector Buttons */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(STARTUP_PRESETS) as StartupPresetId[]).map((key) => {
            const preset = STARTUP_PRESETS[key];
            const active = config.startupPreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectPreset(key)}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900">{preset.label}</div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{preset.summary}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Script Editor + Live Fleet Rollout Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-800">
              <Terminal className="w-4 h-4 text-slate-600" />
              <span>startup-script.sh</span>
            </div>
            <button
              type="button"
              onClick={handleResetScript}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Sync with Config
            </button>
          </div>
          <textarea
            value={config.startupScript}
            onChange={(e) => onChange({ startupScript: e.target.value })}
            spellCheck={false}
            aria-label="Startup script bash editor"
            className="w-full h-[460px] p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-6 focus:outline-none resize-none"
          />
        </div>

        {/* Live Instance Provisioning & Version Rollout Matrix */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="pb-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">MIG Provisioning & Boot Lifecycle</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Policy: PROACTIVE · Max Surge +{config.maxSurge} · Max Unavailable {config.maxUnavailable}
            </p>
          </div>

          <div className="mt-4 space-y-3 overflow-y-auto max-h-[420px] pr-1">
            {instances.map((vm) => {
              const upToDate = vm.appVersion === config.appVersion && vm.status === 'RUNNING';
              return (
                <div key={vm.id} className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-900">{vm.name}</span>
                    <span className="text-xs font-mono text-slate-600">{vm.zone}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-600">{vm.startupStage}</span>
                    <span className="font-mono font-medium text-slate-900 tabular-nums">
                      {vm.appVersion}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          upToDate ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${vm.startupProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                    <span>Probe: {vm.healthState}</span>
                    <span className="inline-flex items-center gap-1">
                      {upToDate && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {vm.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
