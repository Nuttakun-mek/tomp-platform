const baseUrl = process.env.TOMP_SMOKE_BASE_URL || "https://tomp-platform.vercel.app";
const routes = [
  "/",
  "/api/health",
  "/live-test",
  "/mission-control",
  "/assignments",
  "/projects",
  "/driver",
  "/admin",
  "/admin/pilot-smoke-test",
  "/admin/enterprise-readiness",
  "/admin/data-quality",
  "/admin/operations",
  "/recovery"
];

const failures = [];

for (const route of routes) {
  const url = new URL(route, baseUrl).toString();
  try {
    const response = await fetch(url, { redirect: "manual" });
    const ok = response.status >= 200 && response.status < 400;
    console.log(`${ok ? "PASS" : "FAIL"} ${response.status} ${url}`);
    if (!ok) failures.push(`${url} returned ${response.status}`);
    if (route === "/api/health") {
      const json = await response.json();
      if (json.status !== "ok") failures.push(`/api/health status is ${json.status}`);
    }
  } catch (error) {
    console.log(`FAIL ${url} ${error instanceof Error ? error.message : String(error)}`);
    failures.push(url);
  }
}

if (failures.length > 0) {
  console.error("Production smoke test failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production smoke test passed for ${baseUrl}`);
