/**
 * VRF-003 SVG Output Encoding Regression Test Suite
 *
 * Comprehensive runtime and unit tests for SVG output encoding:
 * 1. escapeXml() unit tests for all XML entity characters (&, <, >, ", ')
 * 2. Truncation-before-encoding order enforcement
 * 3. XML parseability & well-formedness verification
 * 4. Actual GET route handler execution verifying Response headers & body
 *
 * Uses harmless marker strings only — no executable payloads.
 */
import assert from "assert";
import { supabaseServer } from "../src/lib/supabase-server";

// Stub supabaseServer.from on the singleton instance
const mockStartup = {
  id: 101,
  startup_name: "Test&Co <Markers> Ltd",
  slug: "test-slug",
  is_public: true,
  user_id: "test-user-id",
  penalty_count: 0,
  verification_type: "stripe",
  proof_url: null,
};

interface MockChain {
  select: () => MockChain;
  eq: () => MockChain;
  maybeSingle: () => Promise<{ data: typeof mockStartup | null; error: null }>;
  limit: () => Promise<{ data: never[]; error: null }>;
}

(supabaseServer as unknown as { from: (_table: string) => MockChain }).from = (_table: string) => {
  const chain: MockChain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: mockStartup, error: null }),
    limit: async () => ({ data: [], error: null }),
  };
  return chain;
};

// Import route and helper
import { escapeXml, GET } from "../src/app/api/badge/[slug]/route";

async function run() {
  console.log("==========================================================");
  console.log("   VRF-003 SVG OUTPUT ENCODING REGRESSION TEST SUITE      ");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`✗ ${name}: ${msg}`);
      failed++;
    }
  }

  // ── TEST A: & becomes &amp; ──
  await test("TEST A: '&' becomes '&amp;'", () => {
    assert.strictEqual(escapeXml("A&B"), "A&amp;B");
    assert.strictEqual(escapeXml("&"), "&amp;");
    assert.strictEqual(escapeXml("Tom & Jerry"), "Tom &amp; Jerry");
  });

  // ── TEST B: < becomes &lt; ──
  await test("TEST B: '<' becomes '&lt;'", () => {
    assert.strictEqual(escapeXml("A<B"), "A&lt;B");
    assert.strictEqual(escapeXml("<"), "&lt;");
  });

  // ── TEST C: > becomes &gt; ──
  await test("TEST C: '>' becomes '&gt;'", () => {
    assert.strictEqual(escapeXml("A>B"), "A&gt;B");
    assert.strictEqual(escapeXml(">"), "&gt;");
  });

  // ── TEST D: " becomes &quot; ──
  await test("TEST D: '\"' becomes '&quot;'", () => {
    assert.strictEqual(escapeXml('A"B'), "A&quot;B");
    assert.strictEqual(escapeXml('"'), "&quot;");
  });

  // ── TEST E: ' becomes &apos; ──
  await test("TEST E: \"'\" becomes '&apos;'", () => {
    assert.strictEqual(escapeXml("A'B"), "A&apos;B");
    assert.strictEqual(escapeXml("'"), "&apos;");
  });

  // ── TEST F: Truncation happens BEFORE encoding ──
  await test("TEST F: Long names are truncated BEFORE encoding", () => {
    // 21 chars: "Test&Co <Markers> Ltd"
    const rawName = "Test&Co <Markers> Ltd";
    assert(rawName.length > 15, "Test name must be > 15 chars");

    // Exact route logic: truncate raw first, then encode
    const truncatedName =
      rawName.length > 15 ? rawName.substring(0, 14) + "..." : rawName;
    const encoded = escapeXml(truncatedName);

    // truncatedName = "Test&Co <Marke..." (14 chars + "...")
    assert.strictEqual(truncatedName, "Test&Co <Marke...");
    // encoded should safely escape & and < in the truncated result
    assert.strictEqual(encoded, "Test&amp;Co &lt;Marke...");

    // Verify entity reference is complete (&amp; and &lt;), not chopped
    assert(encoded.includes("&amp;"), "Must contain full &amp; entity");
    assert(encoded.includes("&lt;"), "Must contain full &lt; entity");
  });

  // ── TEST G: Normal startup names render unchanged ──
  await test("TEST G: Normal startup names without special chars are unchanged", () => {
    assert.strictEqual(escapeXml("Acme Corp"), "Acme Corp");
    assert.strictEqual(escapeXml("StartupXYZ"), "StartupXYZ");
    assert.strictEqual(escapeXml("My SaaS Product"), "My SaaS Product");
    assert.strictEqual(escapeXml(""), "");
  });

  // ── TEST H: Combination of all 5 special characters ──
  await test("TEST H: All five XML special characters in combination", () => {
    assert.strictEqual(
      escapeXml(`A&B<C>D"E'F`),
      "A&amp;B&lt;C&gt;D&quot;E&apos;F"
    );
  });

  // ── TEST I: No single-pass double encoding ──
  await test("TEST I: Raw ampersand encodes to exactly &amp; without duplicate entity tags", () => {
    assert.strictEqual(escapeXml("&"), "&amp;");
    assert.strictEqual(escapeXml("&&"), "&amp;&amp;");
  });

  // ── TEST J: Generated SVG is XML-parseable (Well-Formedness Check) ──
  await test("TEST J: Generated SVG with encoded name contains no bare delimiters", () => {
    const startupName = escapeXml("Test&Co <Markers>");
    const svg = `<svg width="300" height="80" viewBox="0 0 300 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="72" y="34">${startupName}</text>
    </svg>`;

    // Extract text content
    const textMatch = svg.match(/<text[^>]*>(.*?)<\/text>/);
    assert(textMatch, "SVG must contain a <text> element");
    const textContent = textMatch[1];

    // Check no bare & (must be valid entity)
    const hasBareAmpersand = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(textContent);
    assert.strictEqual(hasBareAmpersand, false, "No bare & in text content");

    // Check no bare < inside text content
    assert(!textContent.includes("<"), "No bare < in text content");
    assert(!textContent.includes(">"), "No bare > in text content");
  });

  // ── TEST K: Actual Route Handler Execution (Response, Headers & SVG Body) ──
  await test("TEST K: Route Handler GET returns 200 with correct Content-Type, CSP, Content-Disposition and encoded SVG", async () => {
    const req = new Request("http://localhost:3000/api/badge/test-slug");
    const res = await GET(req, { params: Promise.resolve({ slug: "test-slug" }) });

    assert.strictEqual(res.status, 200, "Route must return HTTP 200");

    // 1. Content-Type Header
    const contentType = res.headers.get("Content-Type");
    assert.strictEqual(contentType, "image/svg+xml", "Content-Type must be image/svg+xml");

    // 2. Content-Security-Policy Header
    const csp = res.headers.get("Content-Security-Policy");
    assert(csp, "Content-Security-Policy header must be present");
    assert(csp.includes("default-src 'none'"), "CSP must enforce default-src 'none'");
    assert(csp.includes("style-src 'unsafe-inline'"), "CSP must include style-src 'unsafe-inline'");

    // 3. Content-Disposition Header
    const contentDisposition = res.headers.get("Content-Disposition");
    assert.strictEqual(contentDisposition, 'inline; filename="badge.svg"', "Content-Disposition must be inline");

    // 4. Cache-Control Header
    const cacheControl = res.headers.get("Cache-Control");
    assert.strictEqual(cacheControl, "public, max-age=3600", "Cache-Control must be public, max-age=3600");

    // 5. SVG Body Content Verification
    const svgBody = await res.text();
    assert(svgBody.startsWith("<svg"), "Body must start with <svg");
    assert(svgBody.includes("</svg>"), "Body must end with </svg>");

    // Confirm that the mock startup name ("Test&Co <Markers> Ltd") is safely truncated and XML-encoded
    assert(svgBody.includes("Test&amp;Co &lt;Marke..."), "SVG body must contain truncated & XML-encoded name");
    assert(!svgBody.includes("Test&Co"), "SVG body must NOT contain raw unencoded ampersand");
    assert(!svgBody.includes("<Markers>"), "SVG body must NOT contain raw unencoded angle brackets");
  });

  // ── Summary ──
  console.log(`\n==========================================================`);
  console.log(`   RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`==========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
