// Deployment smoke test. This is NOT an E2E suite (see 957 Batch H) — it only
// asserts unauthenticated behaviour, which is precisely checkable without a
// session: protected routes must bounce to /login, public routes must serve,
// and /api/health must be honest. A redirect is a PASS only where a redirect is
// the correct answer; an unexpected status fails the run.

const baseUrl = process.env.TOMP_SMOKE_BASE_URL || "https://tomp-platform.vercel.app";

/** @type {{ path: string, expect: "public-200" | "redirect-login" | "health" | "not-found" }[]} */
const checks = [
  { path: "/login", expect: "public-200" },
  { path: "/api/health", expect: "health" },
  { path: "/no-access", expect: "public-200" },
  // Protected app routes — an anonymous request MUST redirect to login.
  { path: "/", expect: "redirect-login" },
  { path: "/projects", expect: "redirect-login" },
  { path: "/mission-control", expect: "redirect-login" },
  { path: "/assignments", expect: "redirect-login" },
  { path: "/recovery", expect: "redirect-login" },
  { path: "/superadmin", expect: "redirect-login" },
  { path: "/resources", expect: "redirect-login" },
  // Driver entry with no token — should render its "no job" notice, not error.
  { path: "/driver", expect: "public-200" },
  // Retired legacy paths — must not serve content (404, or a compat redirect).
  { path: "/admin", expect: "gone" },
  { path: "/live-test", expect: "gone" }
];

const failures = [];

function redirectsToLogin(response) {
  if (response.status < 300 || response.status >= 400) return false;
  const location = response.headers.get("location") || "";
  return /\/login(\?|$)/.test(location) || location.includes("/login");
}

for (const check of checks) {
  const url = new URL(check.path, baseUrl).toString();
  let response;
  try {
    response = await fetch(url, { redirect: "manual" });
  } catch (error) {
    failures.push(`${check.path} — request failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`FAIL   ${check.path} (network)`);
    continue;
  }

  let ok = false;
  let note = String(response.status);

  if (check.expect === "public-200") {
    ok = response.status === 200;
  } else if (check.expect === "redirect-login") {
    ok = redirectsToLogin(response);
    note = `${response.status} -> ${response.headers.get("location") || "(no location)"}`;
    if (response.status === 200) note += "  [LEAK: served without auth]";
  } else if (check.expect === "gone") {
    // 404, or any redirect away — just never a 200 that serves the old page.
    ok = response.status === 404 || (response.status >= 300 && response.status < 400);
    if (response.status === 200) note += "  [still serving a retired path]";
  } else if (check.expect === "health") {
    ok = response.status === 200;
    if (ok) {
      const json = await response.json().catch(() => null);
      if (!json || json.status !== "ok") {
        ok = false;
        note += `  health.status=${json?.status ?? "unparseable"}`;
      } else if (json.checks?.publicSecretSafe === false) {
        ok = false;
        note += "  [publicSecretSafe=false]";
      } else {
        note += `  scopedReads=${json.checks?.scopedReadsEnabled} version=${json.version}`;
      }
    }
  }

  console.log(`${ok ? "PASS" : "FAIL"}   ${check.path}  (${note})`);
  if (!ok) failures.push(`${check.path} — expected ${check.expect}, got ${note}`);
}

if (failures.length > 0) {
  console.error(`\nProduction smoke FAILED for ${baseUrl}:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\nProduction smoke passed for ${baseUrl}`);
