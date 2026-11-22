import { InfraConfig, MachineSpec, MachineTypeId, StartupPresetId } from '../types/infra';

export const MACHINE_SPECS: Record<MachineTypeId, MachineSpec> = {
  'e2-medium': {
    id: 'e2-medium',
    family: 'E2 Shared-Core',
    vcpu: 2,
    memoryGb: 4,
    maxRpsPerInstance: 320,
    hourlyUsd: 0.0335,
  },
  'e2-standard-2': {
    id: 'e2-standard-2',
    family: 'E2 General Purpose',
    vcpu: 2,
    memoryGb: 8,
    maxRpsPerInstance: 480,
    hourlyUsd: 0.067,
  },
  'e2-standard-4': {
    id: 'e2-standard-4',
    family: 'E2 General Purpose',
    vcpu: 4,
    memoryGb: 16,
    maxRpsPerInstance: 950,
    hourlyUsd: 0.134,
  },
  'n2-standard-4': {
    id: 'n2-standard-4',
    family: 'N2 Balanced Compute',
    vcpu: 4,
    memoryGb: 16,
    maxRpsPerInstance: 1200,
    hourlyUsd: 0.1942,
  },
  'c2-standard-8': {
    id: 'c2-standard-8',
    family: 'C2 Compute-Optimized',
    vcpu: 8,
    memoryGb: 32,
    maxRpsPerInstance: 2600,
    hourlyUsd: 0.4176,
  },
};

export const GCP_REGIONS: Record<string, string[]> = {
  'us-central1': ['us-central1-a', 'us-central1-b', 'us-central1-c'],
  'us-east1': ['us-east1-b', 'us-east1-c', 'us-east1-d'],
  'europe-west1': ['europe-west1-b', 'europe-west1-c', 'europe-west1-d'],
  'asia-northeast1': ['asia-northeast1-a', 'asia-northeast1-b', 'asia-northeast1-c'],
};

export const STARTUP_PRESETS: Record<
  StartupPresetId,
  { label: string; summary: string; buildScript: (version: string, healthPath: string, port: number) => string }
> = {
  'nginx-node': {
    label: 'Nginx Reverse Proxy + Node.js App',
    summary: 'Installs Nginx, Node.js 20 LTS, Cloud Ops Agent, configures /healthz, and registers systemd service.',
    buildScript: (version, healthPath, port) => `#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
APP_VERSION="${version}"
APP_PORT="${port}"
HEALTH_PATH="${healthPath}"

# 1. Query Compute Engine Metadata Server
INSTANCE_NAME=$(curl -sf -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/name)
INSTANCE_ZONE=$(curl -sf -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone | awk -F/ '{print $NF}')

# 2. System updates & runtime packages
apt-get update -y
apt-get install -y nginx curl jq ca-certificates gnupg

# 3. Install Google Cloud Ops Agent for Cloud Monitoring & Logging
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
bash add-google-cloud-ops-agent-repo.sh --also-install

# 4. Deploy application payload & health endpoint
mkdir -p /opt/cloudscale-app
cat <<EOF > /opt/cloudscale-app/server.mjs
import http from 'node:http';
const server = http.createServer((req, res) => {
  if (req.url === '\${HEALTH_PATH}') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', version: '\${APP_VERSION}', instance: '\${INSTANCE_NAME}', zone: '\${INSTANCE_ZONE}' }));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ service: 'cloudscale-web', version: '\${APP_VERSION}', zone: '\${INSTANCE_ZONE}' }));
});
server.listen(3000, '127.0.0.1');
EOF

# 5. Configure Nginx upstream & LB health check route
cat <<EOF > /etc/nginx/sites-available/default
server {
  listen \${APP_PORT} default_server;
  location \${HEALTH_PATH} {
    proxy_pass http://127.0.0.1:3000\${HEALTH_PATH};
    access_log off;
  }
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }
}
EOF

systemctl enable nginx && systemctl restart nginx
logger -t startup-script "Deployed \${APP_VERSION} on \${INSTANCE_NAME} (\${INSTANCE_ZONE})"`,
  },
  'docker-container': {
    label: 'Docker Runtime + Containerized Service',
    summary: 'Bootstraps Docker Engine, pulls artifact registry image tag, configures log driver, and starts container.',
    buildScript: (version, healthPath, port) => `#!/bin/bash
set -euo pipefail

APP_VERSION="${version}"
APP_PORT="${port}"
HEALTH_PATH="${healthPath}"
REGISTRY_IMAGE="us-central1-docker.pkg.dev/prod-scalable-web-01/web-repo/api-gateway:\${APP_VERSION}"

# 1. Install Docker Engine & Google Cloud Ops Agent
apt-get update -y
apt-get install -y docker.io jq curl
systemctl enable --now docker

curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
bash add-google-cloud-ops-agent-repo.sh --also-install

# 2. Authenticate Artifact Registry via Instance Service Account
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet

# 3. Run container with gcplogs driver & restart policy
docker rm -f cloudscale-service || true
docker run -d \\
  --name cloudscale-service \\
  --restart always \\
  -p \${APP_PORT}:8080 \\
  --log-driver=gcplogs \\
  -e HEALTH_PATH="\${HEALTH_PATH}" \\
  -e RELEASE_VERSION="\${APP_VERSION}" \\
  "\${REGISTRY_IMAGE}"

# 4. Verify local readiness before passing LB health checks
for i in $(seq 1 12); do
  if curl -sf "http://127.0.0.1:\${APP_PORT}\${HEALTH_PATH}"; then
    exit 0
  fi
  sleep 2
done
exit 1`,
  },
  'ops-hardened': {
    label: 'Hardened Apache + Cloud Monitoring Exporter',
    summary: 'Hardens sysctl network stack, installs Apache2 + mod_status + Ops Agent Prometheus scraper.',
    buildScript: (version, healthPath, port) => `#!/bin/bash
set -euo pipefail

APP_VERSION="${version}"
APP_PORT="${port}"
HEALTH_PATH="${healthPath}"

# 1. Kernel TCP tuning for high-concurrency LB backend traffic
cat <<EOF > /etc/sysctl.d/99-cloudscale-lb.conf
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65535
EOF
sysctl --system

# 2. Install Apache2 & Cloud Ops Agent
apt-get update -y
apt-get install -y apache2 curl
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
bash add-google-cloud-ops-agent-repo.sh --also-install

# 3. Publish static readiness probe and service banner
echo "OK - \${APP_VERSION}" > "/var/www/html\${HEALTH_PATH}"
echo "CloudScale Workload \${APP_VERSION} ($(hostname))" > /var/www/html/index.html

sed -i "s/Listen 80/Listen \${APP_PORT}/g" /etc/apache2/ports.conf
systemctl enable apache2 && systemctl restart apache2`,
  },
};

export const ENVIRONMENT_PRESETS: Record<string, InfraConfig> = {
  'prod-web': {
    projectId: 'prod-scalable-web-01',
    environmentName: 'Production Global Web Tier',
    region: 'us-central1',
    zones: ['us-central1-a', 'us-central1-b', 'us-central1-c'],
    networkName: 'prod-vpc-main',
    subnetName: 'web-tier-us-central1',
    subnetCidr: '10.128.0.0/20',

    templateName: 'web-app-template-v24',
    machineType: 'e2-standard-4',
    sourceImageFamily: 'debian-12',
    sourceImageProject: 'debian-cloud',
    bootDiskSizeGb: 30,
    bootDiskType: 'pd-balanced',
    networkTag: 'allow-health-check',
    enableShieldedVm: true,
    serviceAccountScopes: 'https://www.googleapis.com/auth/cloud-platform',

    migName: 'web-regional-mig',
    baseInstanceName: 'web-node',
    minReplicas: 3,
    maxReplicas: 12,
    autoscalingMetric: 'cpu',
    targetCpuUtilization: 0.6,
    targetLbUtilization: 0.8,
    cooldownPeriodSec: 60,
    scaleInControlMaxReduced: 2,
    maxSurge: 3,
    maxUnavailable: 0,

    healthCheckName: 'http-web-health-check',
    healthCheckProtocol: 'HTTP',
    healthCheckPort: 80,
    healthCheckPath: '/healthz',
    checkIntervalSec: 10,
    timeoutSec: 5,
    healthyThreshold: 2,
    unhealthyThreshold: 3,

    lbName: 'global-web-https-lb',
    lbProtocol: 'HTTPS',
    enableCloudCdn: true,
    enableCloudArmor: true,
    sessionAffinity: 'NONE',

    alertCpuThresholdPct: 80,
    alertLatencyMs: 250,
    alertErrorRatePct: 2.0,
    notificationChannel: 'sre-oncall-pagerduty',
    startupPreset: 'nginx-node',
    appVersion: 'v2.4.1',
    startupScript: STARTUP_PRESETS['nginx-node'].buildScript('v2.4.1', '/healthz', 80),
  },
  'api-eu': {
    projectId: 'eu-payments-gateway-04',
    environmentName: 'Europe High-Throughput API',
    region: 'europe-west1',
    zones: ['europe-west1-b', 'europe-west1-c', 'europe-west1-d'],
    networkName: 'eu-core-vpc',
    subnetName: 'api-subnet-ew1',
    subnetCidr: '10.132.0.0/20',

    templateName: 'api-gateway-template-v18',
    machineType: 'n2-standard-4',
    sourceImageFamily: 'ubuntu-2404-lts-amd64',
    sourceImageProject: 'ubuntu-os-cloud',
    bootDiskSizeGb: 50,
    bootDiskType: 'pd-ssd',
    networkTag: 'allow-health-check',
    enableShieldedVm: true,
    serviceAccountScopes: 'https://www.googleapis.com/auth/monitoring.write,https://www.googleapis.com/auth/logging.write',

    migName: 'api-regional-mig',
    baseInstanceName: 'api-ew1',
    minReplicas: 4,
    maxReplicas: 16,
    autoscalingMetric: 'http-lb',
    targetCpuUtilization: 0.65,
    targetLbUtilization: 0.75,
    cooldownPeriodSec: 90,
    scaleInControlMaxReduced: 2,
    maxSurge: 4,
    maxUnavailable: 0,

    healthCheckName: 'https-api-readiness',
    healthCheckProtocol: 'HTTP',
    healthCheckPort: 8080,
    healthCheckPath: '/ready',
    checkIntervalSec: 5,
    timeoutSec: 3,
    healthyThreshold: 2,
    unhealthyThreshold: 2,

    lbName: 'eu-api-global-lb',
    lbProtocol: 'HTTPS',
    enableCloudCdn: false,
    enableCloudArmor: true,
    sessionAffinity: 'NONE',

    alertCpuThresholdPct: 75,
    alertLatencyMs: 180,
    alertErrorRatePct: 1.0,
    notificationChannel: 'eu-platform-slack',
    startupPreset: 'docker-container',
    appVersion: 'v3.1.0',
    startupScript: STARTUP_PRESETS['docker-container'].buildScript('v3.1.0', '/ready', 8080),
  },
  'staging-compute': {
    projectId: 'staging-compute-sandbox',
    environmentName: 'Staging Cost-Optimized MIG',
    region: 'asia-northeast1',
    zones: ['asia-northeast1-a', 'asia-northeast1-b', 'asia-northeast1-c'],
    networkName: 'staging-vpc',
    subnetName: 'staging-an1',
    subnetCidr: '10.146.0.0/20',

    templateName: 'staging-web-template-v09',
    machineType: 'e2-medium',
    sourceImageFamily: 'debian-12',
    sourceImageProject: 'debian-cloud',
    bootDiskSizeGb: 20,
    bootDiskType: 'pd-balanced',
    networkTag: 'allow-health-check',
    enableShieldedVm: false,
    serviceAccountScopes: 'https://www.googleapis.com/auth/cloud-platform',

    migName: 'staging-mig',
    baseInstanceName: 'stg-vm',
    minReplicas: 2,
    maxReplicas: 6,
    autoscalingMetric: 'cpu',
    targetCpuUtilization: 0.7,
    targetLbUtilization: 0.85,
    cooldownPeriodSec: 60,
    scaleInControlMaxReduced: 1,
    maxSurge: 2,
    maxUnavailable: 1,

    healthCheckName: 'staging-http-hc',
    healthCheckProtocol: 'HTTP',
    healthCheckPort: 80,
    healthCheckPath: '/healthz',
    checkIntervalSec: 15,
    timeoutSec: 5,
    healthyThreshold: 2,
    unhealthyThreshold: 3,

    lbName: 'staging-http-lb',
    lbProtocol: 'HTTP',
    enableCloudCdn: false,
    enableCloudArmor: false,
    sessionAffinity: 'NONE',

    alertCpuThresholdPct: 85,
    alertLatencyMs: 400,
    alertErrorRatePct: 5.0,
    notificationChannel: 'dev-alerts-email',
    startupPreset: 'ops-hardened',
    appVersion: 'v1.9.4-rc2',
    startupScript: STARTUP_PRESETS['ops-hardened'].buildScript('v1.9.4-rc2', '/healthz', 80),
  },
};
