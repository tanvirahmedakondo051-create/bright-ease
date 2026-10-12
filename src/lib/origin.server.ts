import { getRequest } from "@tanstack/react-start/server";

const isLocal = (h: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h);

/** Public origin of the current request (handles the sandbox preview proxy and nginx proxies). */
export function appOrigin() {
  const r = getRequest();
  const u = new URL(r.url);
  const fwdHost = r.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const fwdProto = r.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const host = fwdHost || u.host;
  let proto = fwdProto || u.protocol.replace(":", "");
  if (u.hostname === "localhost" && fwdHost) proto = "https";
  let origin = `${proto}://${host}`;
  // Public sites are behind https; plain http gets 301-redirected and pg_net won't follow.
  if (origin.startsWith("http://") && !isLocal(host)) origin = "https://" + origin.slice(7);
  return origin;
}
