export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTrafficSyncScheduler } = await import("./services/traffic-sync-scheduler");
    startTrafficSyncScheduler();
  }
}
