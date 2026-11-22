import React, { useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { InfraConfig } from '../types/infra';
import {
  generateGcloudScript,
  generateMonitoringAlertJson,
  generateTerraformConfig,
} from '../utils/iacGenerators';

interface IacBundleViewProps {
  config: InfraConfig;
}

type BundleFile = 'gcloud' | 'terraform' | 'monitoring' | 'startup';

export const IacBundleView: React.FC<IacBundleViewProps> = ({ config }) => {
  const [activeFile, setActiveFile] = useState<BundleFile>('gcloud');
  const [copied, setCopied] = useState(false);

  const files = useMemo(
    () => ({
      gcloud: {
        filename: 'deploy.sh',
        label: 'gcloud CLI Automation',
        description: 'Idempotent bash script provisioning Firewall, Template, MIG, Autoscaler, Global LB & Monitoring.',
        content: generateGcloudScript(config),
      },
      terraform: {
        filename: 'main.tf',
        label: 'Terraform HCL',
        description: 'Declarative HashiCorp Google provider configuration synchronized with your current architecture.',
        content: generateTerraformConfig(config),
      },
      monitoring: {
        filename: 'monitoring-alert.json',
        label: 'Cloud Monitoring AlertPolicy',
        description: 'JSON policy definition for CPU utilization and Load Balancer P95 backend latency SLO alerts.',
        content: generateMonitoringAlertJson(config),
      },
      startup: {
        filename: 'startup-script.sh',
        label: 'Startup Script Payload',
        description: 'Compute Engine metadata startup script executed automatically on boot across all MIG zones.',
        content: config.startupScript,
      },
    }),
    [config]
  );

  const current = files[activeFile];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(current.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored if blocked by permissions
    }
  };

  const handleDownload = () => {
    const blob = new Blob([current.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = current.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Generated Infrastructure-as-Code & Automation Bundle
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{current.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : `Copy ${current.filename}`}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download {current.filename}
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        {(Object.keys(files) as BundleFile[]).map((key) => {
          const item = files[key];
          const isActive = activeFile === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFile(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white text-slate-900 border border-slate-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label} <span className="font-mono text-slate-400 ml-1">({item.filename})</span>
            </button>
          );
        })}
      </div>

      {/* Monospace Code Viewport */}
      <div className="bg-slate-950 text-slate-100 p-5 overflow-x-auto max-h-[620px] overflow-y-auto">
        <pre className="font-mono text-xs leading-6">
          <code>{current.content}</code>
        </pre>
      </div>
    </div>
  );
};
