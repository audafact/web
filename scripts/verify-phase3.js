import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Check for help flag
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🚀 Phase 3 Verification Script - Worker API Core

Usage:
  node scripts/verify-phase3.js                    # Try to use existing session
  node scripts/verify-phase3.js --jwt <token>     # Use specific JWT token
  node scripts/verify-phase3.js --help            # Show this help

To get a JWT token:
  1. Open your web app in browser
  2. Open DevTools Console
  3. Run: await supabase.auth.getSession()
  4. Copy the access_token value
  5. Use: node scripts/verify-phase3.js --jwt 'your_token'

Examples:
  node scripts/verify-phase3.js --jwt eyJhbGciOiJIUzI1NiIs...
  export TEST_JWT="your_token" && node scripts/verify-phase3.js
`);
  process.exit(0);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

const WORKER_URL = "https://audafact-api.david-g-cortinas.workers.dev";

class Phase3Verification {
  constructor() {
    this.results = {
      uploadEndpoint: { tests: [], passed: 0, total: 0 },
      accessControl: { tests: [], passed: 0, total: 0 },
      rateLimiting: { tests: [], passed: 0, total: 0 },
      security: { tests: [], passed: 0, total: 0 },
      errorHandling: { tests: [], passed: 0, total: 0 },
    };
    this.validJWT = null;
  }

  async getValidJWT() {
    try {
      // Check if JWT was passed as command line argument
      const args = process.argv.slice(2);
      const jwtIndex = args.indexOf("--jwt");
      if (jwtIndex !== -1 && args[jwtIndex + 1]) {
        this.validJWT = args[jwtIndex + 1];
        console.log("✅ Using JWT from command line argument");
        return;
      }

      // Try to get JWT from environment variable
      if (process.env.TEST_JWT && process.env.TEST_JWT !== "invalid") {
        this.validJWT = process.env.TEST_JWT;
        console.log("✅ Using JWT from environment variable");
        return;
      }

      // Try to get JWT from Supabase session
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        console.log("⚠️  No active session found. Some tests will fail.");
        console.log("💡 To test with authentication:");
        console.log(
          "   1. Copy JWT from browser: await supabase.auth.getSession()"
        );
        console.log(
          "   2. Run: node scripts/verify-phase3.js --jwt 'your_token'"
        );
        return;
      }

      this.validJWT = session.access_token;
      console.log("✅ Got JWT from Supabase session");
    } catch (error) {
      console.error("❌ Error getting JWT:", error);
    }
  }

  logTest(category, testName, passed, details = "") {
    const status = passed ? "✅" : "❌";
    console.log(`${status} ${testName}`);
    if (details) console.log(`   ${details}`);

    this.results[category].tests.push({ name: testName, passed, details });
    this.results[category].total++;
    if (passed) this.results[category].passed++;
  }

  async testUploadEndpoint() {
    console.log("\n🧪 Testing Upload Endpoint (POST /api/sign-upload)");
    console.log("=".repeat(60));

    if (!this.validJWT) {
      console.log("⚠️  Skipping upload endpoint tests - no valid JWT");
      return;
    }

    try {
      // Test 1: Missing required fields
      const missingFieldsResponse = await fetch(
        `${WORKER_URL}/api/sign-upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.validJWT}`,
          },
          body: JSON.stringify({}),
        }
      );

      this.logTest(
        "uploadEndpoint",
        "Missing required fields returns 400",
        missingFieldsResponse.status === 400,
        `Status: ${missingFieldsResponse.status}`
      );

      // Test 2: Invalid content type
      const invalidTypeResponse = await fetch(`${WORKER_URL}/api/sign-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.validJWT}`,
        },
        body: JSON.stringify({
          filename: "test.txt",
          contentType: "text/plain",
          sizeBytes: 1024,
        }),
      });

      this.logTest(
        "uploadEndpoint",
        "Invalid content type returns 400",
        invalidTypeResponse.status === 400,
        `Status: ${invalidTypeResponse.status}`
      );

      // Test 3: File too large
      const largeFileResponse = await fetch(`${WORKER_URL}/api/sign-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.validJWT}`,
        },
        body: JSON.stringify({
          filename: "test.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 200 * 1024 * 1024, // 200MB
        }),
      });

      this.logTest(
        "uploadEndpoint",
        "File too large returns 400",
        largeFileResponse.status === 400,
        `Status: ${largeFileResponse.status}`
      );
    } catch (error) {
      console.error("❌ Error testing upload endpoint:", error);
    }
  }

  async testAccessControl() {
    console.log("\n🔒 Testing Access Control System");
    console.log("=".repeat(60));

    if (!this.validJWT) {
      console.log("⚠️  Skipping access control tests - no valid JWT");
      return;
    }

    try {
      // Test 1: Library file access with valid key
      const libraryResponse = await fetch(
        `${WORKER_URL}/api/sign-file?key=library/originals/break-the-chains-version-1-2c7a13d7fa.mp3`,
        {
          headers: {
            Authorization: `Bearer ${this.validJWT}`,
          },
        }
      );

      this.logTest(
        "accessControl",
        "Library file access with valid key",
        libraryResponse.status === 200,
        `Status: ${libraryResponse.status}`
      );

      // Test 2: Invalid file key pattern
      const invalidKeyResponse = await fetch(
        `${WORKER_URL}/api/sign-file?key=invalid/path/file.mp3`,
        {
          headers: {
            Authorization: `Bearer ${this.validJWT}`,
          },
        }
      );

      this.logTest(
        "accessControl",
        "Invalid file key pattern returns 403",
        invalidKeyResponse.status === 403,
        `Status: ${invalidKeyResponse.status}`
      );

      // Test 3: Path traversal attempt
      const pathTraversalResponse = await fetch(
        `${WORKER_URL}/api/sign-file?key=library/../secret/file.mp3`,
        {
          headers: {
            Authorization: `Bearer ${this.validJWT}`,
          },
        }
      );

      this.logTest(
        "accessControl",
        "Path traversal attempt blocked",
        pathTraversalResponse.status === 403,
        `Status: ${pathTraversalResponse.status}`
      );
    } catch (error) {
      console.error("❌ Error testing access control:", error);
    }
  }

  async testRateLimiting() {
    console.log("\n⏱️  Testing Rate Limiting");
    console.log("=".repeat(60));

    if (!this.validJWT) {
      console.log("⚠️  Skipping rate limiting tests - no valid JWT");
      return;
    }

    try {
      // Test 1: Multiple rapid requests (should hit rate limit)
      // Make more requests to actually trigger rate limiting
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          fetch(
            `${WORKER_URL}/api/sign-file?key=library/originals/break-the-chains-version-1-2c7a13d7fa.mp3`,
            {
              headers: {
                Authorization: `Bearer ${this.validJWT}`,
              },
            }
          )
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.some((r) => r.status === 429);

      this.logTest(
        "rateLimiting",
        "Rate limiting enforced on rapid requests",
        rateLimited,
        `Rate limited: ${rateLimited} (made ${promises.length} requests)`
      );
    } catch (error) {
      console.error("❌ Error testing rate limiting:", error);
    }
  }

  async testSecurity() {
    console.log("\n🛡️  Testing Security Measures");
    console.log("=".repeat(60));

    try {
      // Test 1: Missing JWT token
      const noTokenResponse = await fetch(
        `${WORKER_URL}/api/sign-file?key=library/originals/test.mp3`
      );

      this.logTest(
        "security",
        "Missing JWT token returns 401",
        noTokenResponse.status === 401,
        `Status: ${noTokenResponse.status}`
      );

      // Test 2: Invalid JWT token
      const invalidTokenResponse = await fetch(
        `${WORKER_URL}/api/sign-file?key=library/originals/test.mp3`,
        {
          headers: {
            Authorization: "Bearer invalid.jwt.token",
          },
        }
      );

      this.logTest(
        "security",
        "Invalid JWT token returns 401",
        invalidTokenResponse.status === 401,
        `Status: ${invalidTokenResponse.status}`
      );

      // Test 3: CORS preflight
      const corsResponse = await fetch(`${WORKER_URL}/api/sign-file`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
        },
      });

      this.logTest(
        "security",
        "CORS preflight handled correctly",
        corsResponse.status === 200,
        `Status: ${corsResponse.status}`
      );
    } catch (error) {
      console.error("❌ Error testing security:", error);
    }
  }

  async testErrorHandling() {
    console.log("\n🚨 Testing Error Handling");
    console.log("=".repeat(60));

    try {
      // Test 1: Invalid endpoint
      const invalidEndpointResponse = await fetch(
        `${WORKER_URL}/api/invalid-endpoint`
      );

      this.logTest(
        "errorHandling",
        "Invalid endpoint returns 404",
        invalidEndpointResponse.status === 404,
        `Status: ${invalidEndpointResponse.status}`
      );

      // Test 2: Invalid HTTP method
      const invalidMethodResponse = await fetch(`${WORKER_URL}/api/sign-file`, {
        method: "POST",
      });

      this.logTest(
        "errorHandling",
        "Invalid HTTP method returns 405",
        invalidMethodResponse.status === 405,
        `Status: ${invalidMethodResponse.status}`
      );
    } catch (error) {
      console.error("❌ Error testing error handling:", error);
    }
  }

  async runAllTests() {
    console.log("🚀 Phase 3 Verification - Worker API Core");
    console.log("=".repeat(60));

    // Get valid JWT token first
    await this.getValidJWT();

    await this.testUploadEndpoint();
    await this.testAccessControl();
    await this.testRateLimiting();
    await this.testSecurity();
    await this.testErrorHandling();

    this.printResults();
  }

  printResults() {
    console.log("\n📊 Phase 3 Verification Results");
    console.log("=".repeat(60));

    let totalPassed = 0;
    let totalTests = 0;

    Object.entries(this.results).forEach(([category, data]) => {
      const percentage =
        data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0;
      console.log(
        `\n${category.toUpperCase()}: ${data.passed}/${
          data.total
        } (${percentage}%)`
      );

      data.tests.forEach((test) => {
        const status = test.passed ? "✅" : "❌";
        console.log(`  ${status} ${test.name}`);
        if (test.details) console.log(`     ${test.details}`);
      });

      totalPassed += data.passed;
      totalTests += data.total;
    });

    const overallPercentage =
      totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    console.log(
      `\n🎯 OVERALL: ${totalPassed}/${totalTests} (${overallPercentage}%)`
    );

    if (overallPercentage >= 90) {
      console.log("\n🎉 Phase 3 Verification PASSED! Ready for production.");
    } else if (overallPercentage >= 70) {
      console.log(
        "\n⚠️  Phase 3 Verification PARTIAL. Some issues need attention."
      );
    } else {
      console.log(
        "\n❌ Phase 3 Verification FAILED. Major issues need fixing."
      );
    }
  }
}

// Run verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verification = new Phase3Verification();
  verification.runAllTests().catch(console.error);
}

export { Phase3Verification };
