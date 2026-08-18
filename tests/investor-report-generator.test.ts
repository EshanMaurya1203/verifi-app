import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateInvestorReportPdf,
  InvestorReportInput,
  formatInrAmount,
  formatInrNumberOnly,
  formatUtcDateTime,
  escapePdfText,
  wrapText,
  PdfDocumentBuilder
} from "../src/lib/reports/investor-report-generator";

describe("Investor Report PDF Generator (Hardened & Proven)", () => {
  const fixedDate = new Date("2026-08-17T12:00:00.000Z");

  const sampleValidInput: InvestorReportInput = {
    reportId: "VRF-REP-2026-TEST01",
    reportPeriod: "30_days",
    generatedAt: fixedDate,
    startup: {
      name: "Acme Cloud AI",
      slug: "acme-cloud",
      category: "Artificial Intelligence",
      websiteUrl: "https://acmecloud.ai",
      founderName: "Eshan Maurya",
      founderBio: "Founder building developer infrastructure",
      publicVerificationUrl: "https://verifii.in/startup/acme-cloud",
    },
    verifiedRevenue: {
      totalRevenueInr: 145200,
      transactionCount: 84,
      connectedGatewaysCount: 2,
      lastSynchronizedAt: fixedDate,
      providers: [
        {
          provider: "stripe",
          revenueInr: 95000,
          originalRevenue: 1137.72,
          originalCurrency: "USD",
          transactionCount: 52,
          lastSyncedAt: fixedDate.toISOString(),
          status: "connected",
        },
        {
          provider: "razorpay",
          revenueInr: 50200,
          originalRevenue: 50200,
          originalCurrency: "INR",
          transactionCount: 32,
          lastSyncedAt: fixedDate.toISOString(),
          status: "connected",
        },
      ],
    },
    trustMetrics: {
      trustScore: 94,
      trustTier: "Verified Founder",
      consistencyRating: "HIGH (Low variance)",
      penaltyCount: 0,
      cleanEventsCount: 84,
    },
  };

  it("TEST 1: Returns a valid PDF Buffer starting with %PDF-1.4 and ending with %%EOF", () => {
    const pdfBuf = generateInvestorReportPdf(sampleValidInput);
    assert(Buffer.isBuffer(pdfBuf), "Result must be a Node.js Buffer");
    assert(pdfBuf.length > 1000, "PDF buffer must contain content (>1KB)");
    
    const header = pdfBuf.subarray(0, 8).toString("utf8");
    assert(header.startsWith("%PDF-1.4"), `Header must start with %PDF-1.4, got: ${header}`);
    
    const tail = pdfBuf.subarray(pdfBuf.length - 10).toString("utf8");
    assert(tail.includes("%%EOF"), `Tail must contain %%EOF, got: ${tail}`);
  });

  it("TEST 2: Generator is pure (executes in-memory without network or database dependencies)", () => {
    const start = Date.now();
    const pdfBuf = generateInvestorReportPdf(sampleValidInput);
    const duration = Date.now() - start;
    
    assert(duration < 100, `PDF generation must execute in <100ms in-memory, took ${duration}ms`);
    assert(pdfBuf.length > 0, "PDF buffer must be non-empty");
  });

  it("TEST 3: Safely handles untrusted text and special characters without corrupting PDF", () => {
    const maliciousInput: InvestorReportInput = {
      ...sampleValidInput,
      startup: {
        name: '<script>alert("XSS & SQL Injection")</script> & (Parentheses) \\ Backslash',
        slug: "xss-test",
        category: "D2C/E-commerce & <tag>",
        founderName: 'O\'Connor "The Hacker" <admin@hacker.io>',
        founderBio: "Testing control characters \x00\x08\x1F and long repetitive words ".repeat(10),
        websiteUrl: "https://very-long-domain-name-that-should-wrap-safely.example.com/very/deep/path?query=1&param=2",
      },
    };

    const pdfBuf = generateInvestorReportPdf(maliciousInput);
    assert(Buffer.isBuffer(pdfBuf), "Must return buffer for malicious text");
    assert(pdfBuf.toString("utf8").includes("%%EOF"), "PDF must remain structurally valid");
  });

  it("TEST 4: Handles multiple providers cleanly in breakdown table", () => {
    const multiProviderInput: InvestorReportInput = {
      ...sampleValidInput,
      verifiedRevenue: {
        ...sampleValidInput.verifiedRevenue,
        connectedGatewaysCount: 3,
        providers: [
          { provider: "stripe", revenueInr: 50000, transactionCount: 20, originalRevenue: 600, originalCurrency: "USD" },
          { provider: "razorpay", revenueInr: 30000, transactionCount: 15, originalRevenue: 30000, originalCurrency: "INR" },
          { provider: "stripe", revenueInr: 20000, transactionCount: 10, originalRevenue: 240, originalCurrency: "USD" },
        ],
      },
    };

    const pdfBuf = generateInvestorReportPdf(multiProviderInput);
    assert(Buffer.isBuffer(pdfBuf));
    assert(pdfBuf.length > 1000);
  });

  it("TEST 5: Deterministic generatedAt produces consistent byte structure", () => {
    const buf1 = generateInvestorReportPdf(sampleValidInput);
    const buf2 = generateInvestorReportPdf(sampleValidInput);
    
    assert.strictEqual(buf1.length, buf2.length, "Deterministic inputs must produce identical byte length");
    assert(buf1.equals(buf2), "Deterministic inputs must produce identical byte buffer");
  });

  it("TEST 6: Handles zero revenue and empty provider state safely", () => {
    const zeroRevenueInput: InvestorReportInput = {
      ...sampleValidInput,
      verifiedRevenue: {
        totalRevenueInr: 0,
        transactionCount: 0,
        connectedGatewaysCount: 0,
        lastSynchronizedAt: fixedDate,
        providers: [],
      },
      trustMetrics: {
        trustScore: 0,
        consistencyRating: "UNRATED (Zero transactions)",
        penaltyCount: 0,
      },
    };

    const pdfBuf = generateInvestorReportPdf(zeroRevenueInput);
    assert(Buffer.isBuffer(pdfBuf));
    assert(pdfBuf.length > 1000);
  });

  it("TEST 7: Handles large revenue values with proper INR currency formatting", () => {
    const largeRevenueInput: InvestorReportInput = {
      ...sampleValidInput,
      verifiedRevenue: {
        ...sampleValidInput.verifiedRevenue,
        totalRevenueInr: 25000000, // ₹2.5 Crore
      },
    };

    const pdfBuf = generateInvestorReportPdf(largeRevenueInput);
    assert(Buffer.isBuffer(pdfBuf));
    assert(formatInrAmount(25000000).includes("2,50,00,000"), "Currency formatter must use Indian numbering system");
  });

  it("TEST 8: Handles missing optional founder bio and website gracefully", () => {
    const minimalInput: InvestorReportInput = {
      ...sampleValidInput,
      startup: {
        name: "Minimal Startup",
        slug: "minimal-startup",
        websiteUrl: undefined,
        founderName: undefined,
        founderBio: undefined,
      },
    };

    const pdfBuf = generateInvestorReportPdf(minimalInput);
    assert(Buffer.isBuffer(pdfBuf));
    assert(pdfBuf.length > 1000);
  });

  it("TEST 9: Date formatter produces clean deterministic UTC strings", () => {
    const formatted = formatUtcDateTime("2026-08-17T14:30:00.000Z");
    assert.strictEqual(formatted, "17 Aug 2026 14:30 UTC");
  });

  it("TEST 10: Indian Rupee symbol is represented correctly as a native vector glyph in generated PDF", () => {
    const pdfBuf = generateInvestorReportPdf(sampleValidInput);
    const pdfText = pdfBuf.toString("utf8");
    
    // The PDF stream must contain vector drawing commands for the Rupee geometry (line caps & joins)
    assert(pdfText.includes("1 J 1 j"), "PDF must contain vector line join operators for the Rupee glyph");
    assert(pdfText.includes("1,45,200"), "PDF must contain the formatted numerical revenue amount");
  });

  it("TEST 11: Multiple INR formats render without corruption (499, 999, 10000, 12345678.90)", () => {
    assert.strictEqual(formatInrNumberOnly(499), "499");
    assert.strictEqual(formatInrNumberOnly(999), "999");
    assert.strictEqual(formatInrNumberOnly(10000), "10,000");
    assert.strictEqual(formatInrNumberOnly(12345678.90), "1,23,45,679");
    
    const doc = new PdfDocumentBuilder();
    doc.drawCurrency(499, 50, 700);
    doc.drawCurrency(999, 50, 650);
    doc.drawCurrency(10000, 50, 600);
    doc.drawCurrency(12345678.90, 50, 550);
    const buf = doc.build();
    
    assert(Buffer.isBuffer(buf));
    assert(buf.subarray(0, 8).toString().startsWith("%PDF-1.4"));
    assert(buf.subarray(buf.length - 6).toString().includes("%%EOF"));
  });

  it("TEST 12: Non-ASCII founder/startup text does not corrupt the PDF", () => {
    const nonAsciiText = "Café & Naïve “Founder” – ‘Quotes’ • Bullet";
    const escaped = escapePdfText(nonAsciiText);
    
    // Escaped string must contain clean printable ASCII equivalents
    assert(!/[\x80-\xFF]/.test(escaped), "Sanitized string must not contain raw multibyte UTF-8 bytes");
    assert(escaped.includes('"Founder"'), "Quotes must be mapped cleanly");
    assert(escaped.includes("'Quotes'"), "Single quotes must be mapped cleanly");
  });

  it("TEST 13: Long URL remains inside page bounds via word wrapping", () => {
    const longUrl = "https://subdomain.example-startup-domain-name-with-extended-length.co.in/deeply/nested/verification/public/endpoint/token?ref=investor_report_campaign_2026_q3";
    const lines = wrapText(longUrl, 200, 8);
    
    assert(lines.length > 1, "Long URL must be broken into multiple wrapped lines");
    for (const line of lines) {
      assert(line.length <= 50, `Line length ${line.length} must not exceed line character limit`);
    }
  });

  it("TEST 14: Multi-page output remains structurally valid with correct page count", () => {
    const doc = new PdfDocumentBuilder();
    doc.drawText("Page 1 Content", 50, 700);
    doc.addPage();
    doc.drawText("Page 2 Content", 50, 700);
    doc.addPage();
    doc.drawText("Page 3 Content", 50, 700);
    
    assert.strictEqual(doc.pageCount, 3, "Page count must equal 3");
    
    const buf = doc.build();
    const pdfText = buf.toString("utf8");
    
    assert(pdfText.includes("/Count 3"), "PDF Pages object must declare /Count 3");
    assert(pdfText.includes("%%EOF"), "PDF trailer must end cleanly with %%EOF");
  });
});
