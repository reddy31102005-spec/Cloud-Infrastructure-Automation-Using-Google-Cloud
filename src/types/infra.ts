export type NavTab = 'topology' | 'compute' | 'monitoring' | 'startup' | 'iac';

export type MachineTypeId = 'e2-medium' | 'e2-standard-2' | 'e2-standard-4' | 'n2-standard-4' | 'c2-standard-8';

export type TrafficProfile = 'steady' | 'spike' | 'ramp' | 'manual';

export type InstanceStatus = 'RUNNING' | 'STAGING' | 'UPDATING' | 'STOPPING' | 'UNHEALTHY';

export type StartupPresetId = 'nginx-node' | 'docker-container' | 'ops-hardened';

export interface MachineSpec {
  id: MachineTypeId;
  family: string;
  vcpu: number;
  memoryGb: number;
  maxRpsPerInstance: number;
  hourlyUsd: number;
}

export interface InfraConfig {
  projectId: string;
  environmentName: string;
  region: string;
  zones: string[];
  networkName: string;
  subnetName: string;
  subnetCidr: string;

  // Compute Engine Instance Template
  templateName: string;
  machineType: MachineTypeId;
  sourceImageFamily: string;
  sourceImageProject: string;
  bootDiskSizeGb: number;
  bootDiskType: 'pd-balanced' | 'pd-ssd' | 'pd-standard';
  networkTag: string;
  enableShieldedVm: boolean;
  serviceAccountScopes: string;

  // Managed Instance Group & Auto-scaling
  migName: string;
  baseInstanceName: string;
  minReplicas: number;
  maxReplicas: number;
  autoscalingMetric: 'cpu' | 'http-lb';
  targetCpuUtilization: number; // 0.30 - 0.90
  targetLbUtilization: number; // 0.50 - 0.95
  cooldownPeriodSec: number;
  scaleInControlMaxReduced: number;
  maxSurge: number;
  maxUnavailable: number;

  // Health Check & Load Balancer
  healthCheckName: string;
  healthCheckProtocol: 'HTTP' | 'HTTPS';
  healthCheckPort: number;
  healthCheckPath: string;
  checkIntervalSec: number;
  timeoutSec: number;
  healthyThreshold: number;
  unhealthyThreshold: number;

  lbName: string;
  lbProtocol: 'HTTP' | 'HTTPS';
  enableCloudCdn: boolean;
  enableCloudArmor: boolean;
  sessionAffinity: 'NONE' | 'CLIENT_IP' | 'GENERATED_COOKIE';

  // Cloud Monitoring & Startup Script
  alertCpuThresholdPct: number;
  alertLatencyMs: number;
  alertErrorRatePct: number;
  notificationChannel: string;
  startupPreset: StartupPresetId;
  appVersion: string;
  startupScript: string;
}

export interface SimulatedInstance {
  id: string;
  name: string;
  zone: string;
  internalIp: string;
  externalIp: string;
  status: InstanceStatus;
  healthState: 'HEALTHY' | 'UNHEALTHY' | 'PROBING';
  cpuPercent: number;
  memoryPercent: number;
  rps: number;
  latencyMs: number;
  uptimeSec: number;
  appVersion: string;
  startupStage: string;
  startupProgress: number; // 0 to 100
}

export interface TelemetryPoint {
  tick: number;
  timestamp: string;
  incomingRps: number;
  avgCpuPct: number;
  targetCpuPct: number;
  activeInstances: number;
  desiredInstances: number;
  p95LatencyMs: number;
  errorRatePct: number;
}

export interface DeploymentEvent {
  id: string;
  timestamp: string;
  category: 'AUTOSCALER' | 'HEALTH_CHECK' | 'STARTUP_SCRIPT' | 'MONITORING' | 'ROLLOUT';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  target: string;
  message: string;
}

export interface AlertPolicyState {
  id: string;
  name: string;
  metric: string;
  condition: string;
  duration: string;
  status: 'OK' | 'FIRING';
  currentValue: string;
}
