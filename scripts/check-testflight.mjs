#!/usr/bin/env node
// Where the TestFlight build stands, without opening App Store Connect.
//
//   node scripts/check-testflight.mjs
//
// Answers the two questions worth asking during a field test: has Apple finished
// with the external build yet, and can a driver actually install it. Apple emails
// the account holder when the review finishes, but the email is easy to miss and
// says less than this does.
//
// Reads the App Store Connect API key from apps/mobile-driver/credentials/,
// which is gitignored. The key is the same one eas.json submits with.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

const APP_ID = "6811029020";
const KEY_ID = "397359LM92";
const ISSUER_ID = "396b2546-6f33-4996-aba0-ba8fd80d19c4";
const P8_PATH = path.join(ROOT, "apps", "mobile-driver", "credentials", `AuthKey_${KEY_ID}.p8`);

if (!fs.existsSync(P8_PATH)) {
  console.error(`App Store Connect key not found at ${P8_PATH}`);
  process.exit(2);
}

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const issued = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" })}.${b64({
  iss: ISSUER_ID,
  iat: issued,
  exp: issued + 600,
  aud: "appstoreconnect-v1"
})}`;
const jwt = `${unsigned}.${crypto
  .sign("sha256", Buffer.from(unsigned), { key: fs.readFileSync(P8_PATH, "utf8"), dsaEncoding: "ieee-p1363" })
  .toString("base64url")}`;

async function asc(url) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${url}`, {
    headers: { Authorization: `Bearer ${jwt}` }
  });
  const body = await res.json();
  if (body.errors) throw new Error(body.errors.map((e) => `${e.title}: ${e.detail ?? ""}`).join(" | "));
  return body;
}

// What the review states mean, because "WAITING_FOR_REVIEW" and "IN_REVIEW" look
// alike and only one of them means a person has started.
const REVIEW_STATE = {
  WAITING_FOR_REVIEW: "submitted — in Apple's queue, nobody has looked yet",
  IN_REVIEW: "a reviewer is working on it now",
  APPROVED: "APPROVED — the public link works, drivers can install",
  REJECTED: "REJECTED — read Apple's message in App Store Connect"
};

const builds = await asc(
  `/v1/builds?filter[app]=${APP_ID}&limit=4&sort=-version` +
    `&fields[builds]=version,processingState,uploadedDate,expired` +
    `&include=betaAppReviewSubmission&fields[betaAppReviewSubmissions]=betaReviewState`
);

const submissions = new Map(
  (builds.included ?? []).map((item) => [item.id, item.attributes.betaReviewState])
);

console.log("BUILDS");
for (const build of builds.data) {
  const { version, processingState, expired } = build.attributes;
  const submissionId = build.relationships?.betaAppReviewSubmission?.data?.id;
  const state = submissionId ? submissions.get(submissionId) : null;
  const review = state ? `${state} — ${REVIEW_STATE[state] ?? ""}` : "not submitted for external review";
  console.log(`  build ${String(version).padEnd(4)} ${String(processingState).padEnd(11)} ${expired ? "EXPIRED " : ""}${review}`);
}

const groups = await asc(
  `/v1/betaGroups?filter[app]=${APP_ID}&fields[betaGroups]=name,isInternalGroup,publicLink,publicLinkEnabled`
);
console.log("\nGROUPS");
for (const group of groups.data) {
  const a = group.attributes;
  const testers = await asc(`/v1/betaGroups/${group.id}/betaTesters?fields[betaTesters]=email,state&limit=50`);
  const invited = testers.data.filter((t) => t.attributes.state !== "NOT_INVITED").length;
  const notInvited = testers.data.length - invited;
  console.log(
    `  ${a.name.padEnd(24)} ${a.isInternalGroup ? "internal" : "external"}  ` +
      `testers=${testers.data.length}${notInvited ? ` (${notInvited} NOT INVITED — no email was ever sent)` : ""}`
  );
  if (a.publicLink) console.log(`    link: ${a.publicLink}${a.publicLinkEnabled ? "" : "  (disabled)"}`);
}
