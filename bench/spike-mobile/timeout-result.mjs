// Shared by the runners: when a page never posts its result (a hang blocks the page itself), the
// runner writes the failure in its place, with the last stage the page reported to serve.mjs.

import { writeFileSync } from "node:fs";

// `reason` replaces the default message (e.g. when the browser never started the page at all).
export async function writeTimeoutResult({ resultFile, resultName, pageUrl, seconds, port = 8377, runner, extra = {}, reason = null }) {
  let lastProgress = null;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/progress?name=${encodeURIComponent(resultName)}`);
    if (response.ok) lastProgress = await response.json();
  } catch { /* server unreachable: leave null */ }
  const query = Object.fromEntries(new URL(pageUrl, "http://localhost").searchParams);
  const message = reason ?? `the page did not post a result within ${seconds} s` + (lastProgress ? `; last stage: ${lastProgress.stage}${lastProgress.detail ? ` ${lastProgress.detail}` : ""}` : "");
  const report = {
    kind: "spike-mobile-run", schemaVersion: 1, status: "failed", writtenBy: runner, page: pageUrl, config: query,
    fatal: { name: "Timeout", message },
    failures: [{ stage: lastProgress?.stage ?? "load", item: lastProgress?.detail ?? null, error: { name: "Timeout", message } }],
    lastProgress, answers: [], finishedAt: new Date().toISOString(), ...extra,
  };
  writeFileSync(resultFile, JSON.stringify(report, null, 2));
  return report;
}
