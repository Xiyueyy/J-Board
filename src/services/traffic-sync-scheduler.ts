import { prisma } from "@/lib/prisma";
import { syncNodeClientTraffic } from "@/services/traffic-sync";

const DEFAULT_INTERVAL_SECONDS = 60;
const MIN_INTERVAL_SECONDS = 10;
const globalForTrafficSync = globalThis as typeof globalThis & {
  __jboardTrafficSyncScheduler?: TrafficSyncSchedulerState;
};

type Timer = ReturnType<typeof setTimeout>;

interface TrafficSyncSchedulerState {
  started: boolean;
  running: boolean;
  timer: Timer | null;
}

function getState() {
  if (!globalForTrafficSync.__jboardTrafficSyncScheduler) {
    globalForTrafficSync.__jboardTrafficSyncScheduler = {
      started: false,
      running: false,
      timer: null,
    };
  }
  return globalForTrafficSync.__jboardTrafficSyncScheduler;
}

function normalizeIntervalSeconds(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return DEFAULT_INTERVAL_SECONDS;
  return Math.max(MIN_INTERVAL_SECONDS, Math.trunc(value));
}

function unrefTimer(timer: Timer) {
  if (typeof timer === "object" && timer && "unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
}

async function getTrafficSyncSettings() {
  const config = await prisma.appConfig.findUnique({
    where: { id: "default" },
    select: {
      trafficSyncEnabled: true,
      trafficSyncIntervalSeconds: true,
    },
  });

  return {
    enabled: config?.trafficSyncEnabled ?? true,
    intervalSeconds: normalizeIntervalSeconds(config?.trafficSyncIntervalSeconds),
  };
}

function scheduleNext(state: TrafficSyncSchedulerState, intervalSeconds: number) {
  state.timer = setTimeout(() => {
    void runTrafficSyncCycle(state);
  }, intervalSeconds * 1000);
  unrefTimer(state.timer);
}

async function runTrafficSyncCycle(state: TrafficSyncSchedulerState) {
  let intervalSeconds = DEFAULT_INTERVAL_SECONDS;

  try {
    const settings = await getTrafficSyncSettings();
    intervalSeconds = settings.intervalSeconds;

    if (settings.enabled && !state.running) {
      state.running = true;
      try {
        await syncNodeClientTraffic({ maxAgeMs: 0 });
      } finally {
        state.running = false;
      }
    }
  } catch (error) {
    console.error("J-Board traffic sync scheduler failed", error);
  } finally {
    scheduleNext(state, intervalSeconds);
  }
}

export function startTrafficSyncScheduler() {
  if (process.env.JBOARD_TRAFFIC_SYNC_SCHEDULER === "false") return;

  const state = getState();
  if (state.started) return;

  state.started = true;
  scheduleNext(state, 5);
}
