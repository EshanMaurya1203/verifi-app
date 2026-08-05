// ─── VRF-ONBOARD-002Z — Benchmark Metadata Types ────────────────────────

export type BenchmarkEnvironment =
  | "algorithmic"
  | "single_process"
  | "production";

export interface BenchmarkMetadata {
  environment: BenchmarkEnvironment;

  cpuCores: number;

  memoryMb: number;

  nodeVersion: string;

  assumptions: string[];
}

export const DEFAULT_BENCHMARK_ASSUMPTIONS: string[] = [
  "single process",
  "in-memory only",
  "no database",
  "no network latency",
  "no Redis",
  "no Vercel cold starts",
];

export function createDefaultBenchmarkMetadata(
  environment: BenchmarkEnvironment = "algorithmic"
): BenchmarkMetadata {
  const os = typeof process !== "undefined" ? require("os") : null;
  const cpuCores = os ? os.cpus().length : 1;
  const memoryMb = os ? Math.round(os.totalmem() / (1024 * 1024)) : 0;
  const nodeVersion = typeof process !== "undefined" ? process.version : "unknown";

  return {
    environment,
    cpuCores,
    memoryMb,
    nodeVersion,
    assumptions: [...DEFAULT_BENCHMARK_ASSUMPTIONS],
  };
}
