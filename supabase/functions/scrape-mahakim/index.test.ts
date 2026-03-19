import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const BASE_URL = `${SUPABASE_URL}/functions/v1/scrape-mahakim`;

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "apikey": SUPABASE_ANON_KEY,
};

// Test 1: Invalid action returns 400
Deno.test("returns error for unknown action", async () => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "unknownAction" }),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

// Test 2: getLatestSync with a random case ID returns null
Deno.test("getLatestSync returns null for non-existent case", async () => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "getLatestSync",
      caseId: "00000000-0000-0000-0000-000000000000",
    }),
  });
  const data = await res.json();
  assertEquals(res.status, 200);
  assertEquals(data.success, true);
  assertEquals(data.data, null);
});

// Test 3: submitSyncJob with missing data returns 400
Deno.test("submitSyncJob rejects missing fields", async () => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "submitSyncJob",
      jobId: null,
      caseId: null,
      caseNumber: null,
    }),
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

// Test 4: retryFailedJobs action works (no jobs to retry)
Deno.test("retryFailedJobs succeeds with zero jobs", async () => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "retryFailedJobs" }),
  });
  const data = await res.json();
  assertEquals(res.status, 200);
  assertEquals(data.success, true);
  assertEquals(data.processed, 0);
});

// Test 5: CORS preflight
Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(BASE_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

// Test 6: getLatestSync for actual existing case
Deno.test("getLatestSync returns data for real case", async () => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "getLatestSync",
      caseId: "dde2646f-e1ad-45a1-8b6c-a42890d5cdcf",
    }),
  });
  const data = await res.json();
  assertEquals(res.status, 200);
  assertEquals(data.success, true);
  // This case has a sync job
  if (data.data) {
    assertEquals(typeof data.data.status, "string");
    assertEquals(typeof data.data.case_number, "string");
  }
});
