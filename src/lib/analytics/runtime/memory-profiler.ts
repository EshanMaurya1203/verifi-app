// ─── VRF-ONBOARD-002Z — Memory Profiler Module ───────────────────────────

export interface MemoryProfile {
  heapUsedMb: number;

  heapTotalMb: number;

  rssMb: number;

  externalMb: number;

  arrayBuffersMb: number;
}

/**
 * Captures the current Node.js process memory profile converting bytes to megabytes (MB).
 */
export function captureMemoryProfile(): MemoryProfile {
  if (typeof process === "undefined" || !process.memoryUsage) {
    return {
      heapUsedMb: 0,
      heapTotalMb: 0,
      rssMb: 0,
      externalMb: 0,
      arrayBuffersMb: 0,
    };
  }

  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Number((bytes / (1024 * 1024)).toFixed(2));

  return {
    heapUsedMb: toMb(mem.heapUsed || 0),
    heapTotalMb: toMb(mem.heapTotal || 0),
    rssMb: toMb(mem.rss || 0),
    externalMb: toMb(mem.external || 0),
    arrayBuffersMb: toMb(mem.arrayBuffers || 0),
  };
}
