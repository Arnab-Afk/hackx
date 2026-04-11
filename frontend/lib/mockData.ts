// Mock data for UI preview when backend is unavailable

export const MOCK_SESSION_ID = "sess-demo-001";

export const MOCK_CONTAINERS = [
  { id: "ctr-001", name: "frontend", image: "node:20", status: "running", ports: { "3000/tcp": ["0.0.0.0:3000"] } as Record<string, string[]>, created: "2026-04-11T10:00:00Z" },
  { id: "ctr-002", name: "backend", image: "python:3.12", status: "running", ports: { "8080/tcp": ["0.0.0.0:8080"] } as Record<string, string[]>, created: "2026-04-11T10:00:05Z" },
  { id: "ctr-003", name: "postgres", image: "postgres:16", status: "running", ports: {} as Record<string, string[]>, created: "2026-04-11T10:00:10Z" },
  { id: "ctr-004", name: "redis-cache", image: "redis:7", status: "stopped", ports: {} as Record<string, string[]>, created: "2026-04-11T08:00:00Z" },
];

export const MOCK_SESSIONS = [
  {
    id: "sess-demo-001",
    prompt: "Deploy a DeFi analytics dashboard with React frontend, Python FastAPI backend with pandas, and PostgreSQL",
    state: "completed",
    created_at: "2026-04-11T10:00:00Z",
    updated_at: "2026-04-11T10:01:02Z",
  },
  {
    id: "sess-demo-002",
    prompt: "Deploy the repository at https://github.com/acme/nft-marketplace",
    state: "completed",
    created_at: "2026-04-11T08:30:00Z",
    updated_at: "2026-04-11T08:31:15Z",
  },
  {
    id: "sess-demo-003",
    prompt: "Deploy a Next.js dapp with Hardhat smart contract development environment",
    state: "failed",
    created_at: "2026-04-10T22:10:00Z",
    updated_at: "2026-04-10T22:10:45Z",
  },
];

export const MOCK_ACTION_LOG = {
  id: 1,
  session_id: "sess-demo-001",
  team_id: "team-demo-42",
  created_at: "2026-04-11T10:01:02Z",
  actions: [
    {
      index: 0,
      tool: "analyze_repo",
      input: { github_url: "https://github.com/acme/defi-dashboard" },
      result: { stack: ["react", "fastapi", "postgres"], files_found: 47, has_smart_contracts: false },
      timestamp: "2026-04-11T10:00:01Z",
      hash: "sha256:a3f9c2d1e4b7a8090f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3",
    },
    {
      index: 1,
      tool: "generate_deployment_plan",
      input: { summary: "3-container stack: React (node:20), FastAPI (python:3.12), PostgreSQL 16", estimated_cost_per_hour: 0.018, has_smart_contracts: false },
      result: { status: "confirmed" },
      timestamp: "2026-04-11T10:00:04Z",
      hash: "sha256:b4c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c",
    },
    {
      index: 2,
      tool: "create_container",
      input: { name: "frontend", image: "node:20", ram_mb: 2048, cpu_cores: 1.0, ports: ["3000/tcp"] },
      result: { container_id: "ctr-001", status: "running" },
      timestamp: "2026-04-11T10:00:08Z",
      hash: "sha256:c5d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d",
    },
    {
      index: 3,
      tool: "create_container",
      input: { name: "backend", image: "python:3.12", ram_mb: 4096, cpu_cores: 2.0, ports: ["8080/tcp"] },
      result: { container_id: "ctr-002", status: "running" },
      timestamp: "2026-04-11T10:00:14Z",
      hash: "sha256:d6e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e",
    },
    {
      index: 4,
      tool: "setup_database",
      input: { type: "postgres", version: "16" },
      result: { container_id: "ctr-003", host: "postgres", port: 5432, status: "running" },
      timestamp: "2026-04-11T10:00:20Z",
      hash: "sha256:e7f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f",
    },
    {
      index: 5,
      tool: "install_packages",
      input: { container_id: "ctr-001", packages: ["react", "vite", "wagmi", "viem", "recharts"], manager: "npm" },
      result: { installed: 5, duration_ms: 8420 },
      timestamp: "2026-04-11T10:00:30Z",
      hash: "sha256:f8a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a",
    },
    {
      index: 6,
      tool: "install_packages",
      input: { container_id: "ctr-002", packages: ["fastapi", "pandas", "uvicorn", "psycopg2", "web3"], manager: "pip" },
      result: { installed: 5, duration_ms: 12300 },
      timestamp: "2026-04-11T10:00:44Z",
      hash: "sha256:a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
    },
    {
      index: 7,
      tool: "configure_network",
      input: { containers: ["frontend", "backend", "postgres"], exposed_ports: [3000, 8080], internal_only: [5432] },
      result: { network_id: "team42-net", assigned_domain: "team42.comput3.xyz" },
      timestamp: "2026-04-11T10:00:50Z",
      hash: "sha256:b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c",
    },
    {
      index: 8,
      tool: "setup_ide",
      input: { container_id: "ctr-001", type: "vscode" },
      result: { url: "https://ide.team42.comput3.xyz", status: "running" },
      timestamp: "2026-04-11T10:00:55Z",
      hash: "sha256:c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d",
    },
    {
      index: 9,
      tool: "health_check",
      input: { container_id: "ctr-001" },
      result: { status: "healthy", uptime_ms: 1240, http_status: 200 },
      timestamp: "2026-04-11T10:01:00Z",
      hash: "sha256:d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e",
    },
  ],
};

export const MOCK_PLAN = {
  summary: "3-container stack on a single provider node: React 18 frontend (node:20), FastAPI + pandas backend (python:3.12), and PostgreSQL 16. Internal network isolates the database. VS Code IDE exposed on port 443.",
  estimated_cost_per_hour: 0.018,
  has_smart_contracts: false,
  status: "pending",
  containers: [
    { name: "frontend", image: "node:20", ram_mb: 2048, cpu_cores: 1.0, ports: ["3000/tcp"] },
    { name: "backend", image: "python:3.12", ram_mb: 4096, cpu_cores: 2.0, ports: ["8080/tcp"] },
    { name: "postgres", image: "postgres:16", ram_mb: 1024, cpu_cores: 0.5, ports: [] },
  ],
};
