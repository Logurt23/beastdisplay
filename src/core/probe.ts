/** Same-origin reachability probe of the runtime config file. */
export async function probeConfig(timeoutMs = 5000): Promise<boolean> {
  try {
    const res = await fetch(`/config.js`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}
