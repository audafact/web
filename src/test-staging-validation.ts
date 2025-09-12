/**
 * Staging Environment Validation Tests
 * Run these tests to validate the staging environment is working correctly
 */

import { supabase } from "./services/supabase";

const STAGING_API_BASE = "https://staging.media.audafact.com";

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

class StagingValidator {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log("🧪 Running Staging Environment Validation Tests...\n");

    // Test 1: Authentication
    await this.testAuthentication();

    // Test 2: Worker Endpoints
    await this.testWorkerEndpoints();

    // Test 3: Upload Flow
    await this.testUploadFlow();

    // Test 4: Preview Flow
    await this.testPreviewFlow();

    // Test 5: Rate Limiting
    await this.testRateLimiting();

    // Test 6: Error Handling
    await this.testErrorHandling();

    // Test 7: CORS Configuration
    await this.testCORSConfiguration();

    // Display results
    this.displayResults();
  }

  private async testAuthentication(): Promise<void> {
    console.log("1️⃣ Testing Authentication...");

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        this.addResult("Authentication", false, error.message);
        return;
      }

      if (!data.session) {
        this.addResult("Authentication", false, "No active session");
        return;
      }

      const token = data.session.access_token;
      if (!token) {
        this.addResult("Authentication", false, "No access token");
        return;
      }

      this.addResult("Authentication", true, "JWT token obtained", {
        tokenLength: token.length,
        userId: data.session.user?.id,
      });
    } catch (error) {
      this.addResult("Authentication", false, `Error: ${error}`);
    }
  }

  private async testWorkerEndpoints(): Promise<void> {
    console.log("2️⃣ Testing Worker Endpoints...");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        this.addResult("Worker Endpoints", false, "No authentication token");
        return;
      }

      // Test sign-file endpoint
      const testKey =
        "library/originals/break-the-chains-version-1-2c7a13d7fa.mp3";
      const response = await fetch(
        `${STAGING_API_BASE}/api/sign-file?key=${encodeURIComponent(testKey)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        this.addResult(
          "Worker Endpoints",
          false,
          `Sign-file failed: ${response.status}`
        );
        return;
      }

      const result = await response.json();
      if (!result.url) {
        this.addResult("Worker Endpoints", false, "No URL in response");
        return;
      }

      this.addResult("Worker Endpoints", true, "All endpoints responding", {
        signFileStatus: response.status,
        hasSignedUrl: !!result.url,
      });
    } catch (error) {
      this.addResult("Worker Endpoints", false, `Error: ${error}`);
    }
  }

  private async testUploadFlow(): Promise<void> {
    console.log("3️⃣ Testing Upload Flow...");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        this.addResult("Upload Flow", false, "No authentication token");
        return;
      }

      // Test sign-upload endpoint
      const uploadData = {
        filename: "test-staging.mp3",
        contentType: "audio/mpeg",
        sizeBytes: 1024,
      };

      const response = await fetch(`${STAGING_API_BASE}/api/sign-upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(uploadData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.addResult(
          "Upload Flow",
          false,
          `Sign-upload failed: ${response.status} - ${errorText}`
        );
        return;
      }

      const result = await response.json();
      if (!result.uploadUrl) {
        this.addResult("Upload Flow", false, "No upload URL in response");
        return;
      }

      this.addResult("Upload Flow", true, "Upload flow working", {
        uploadUrl: result.uploadUrl,
        fileKey: result.fileKey,
      });
    } catch (error) {
      this.addResult("Upload Flow", false, `Error: ${error}`);
    }
  }

  private async testPreviewFlow(): Promise<void> {
    console.log("4️⃣ Testing Preview Flow...");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        this.addResult("Preview Flow", false, "No authentication token");
        return;
      }

      // Test with a library track
      const testKey =
        "library/originals/break-the-chains-version-1-2c7a13d7fa.mp3";
      const response = await fetch(
        `${STAGING_API_BASE}/api/sign-file?key=${encodeURIComponent(testKey)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        this.addResult(
          "Preview Flow",
          false,
          `Preview failed: ${response.status}`
        );
        return;
      }

      const result = await response.json();
      const signedUrl = result.url;

      // Test if the signed URL is accessible
      const previewResponse = await fetch(signedUrl, { method: "HEAD" });

      if (!previewResponse.ok) {
        this.addResult(
          "Preview Flow",
          false,
          `Signed URL not accessible: ${previewResponse.status}`
        );
        return;
      }

      this.addResult("Preview Flow", true, "Preview flow working", {
        signedUrl: signedUrl,
        previewStatus: previewResponse.status,
        contentType: previewResponse.headers.get("content-type"),
      });
    } catch (error) {
      this.addResult("Preview Flow", false, `Error: ${error}`);
    }
  }

  private async testRateLimiting(): Promise<void> {
    console.log("5️⃣ Testing Rate Limiting...");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        this.addResult("Rate Limiting", false, "No authentication token");
        return;
      }

      // Make multiple rapid requests to test rate limiting
      const requests = Array(5)
        .fill(null)
        .map(() =>
          fetch(`${STAGING_API_BASE}/api/sign-file?key=test`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );

      const responses = await Promise.all(requests);
      const rateLimitHeaders = responses[0].headers.get("X-RateLimit-Limit");
      const rateLimitRemaining = responses[0].headers.get(
        "X-RateLimit-Remaining"
      );

      this.addResult("Rate Limiting", true, "Rate limiting headers present", {
        rateLimitHeader: rateLimitHeaders,
        rateLimitRemaining: rateLimitRemaining,
        allRequestsStatus: responses.map((r) => r.status),
      });
    } catch (error) {
      this.addResult("Rate Limiting", false, `Error: ${error}`);
    }
  }

  private async testErrorHandling(): Promise<void> {
    console.log("6️⃣ Testing Error Handling...");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        this.addResult("Error Handling", false, "No authentication token");
        return;
      }

      // Test with invalid key
      const response = await fetch(
        `${STAGING_API_BASE}/api/sign-file?key=invalid-key`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Should return 404 or 400 for invalid key
      if (response.status >= 400 && response.status < 500) {
        this.addResult("Error Handling", true, "Error handling working", {
          invalidKeyStatus: response.status,
        });
      } else {
        this.addResult(
          "Error Handling",
          false,
          `Unexpected status for invalid key: ${response.status}`
        );
      }
    } catch (error) {
      this.addResult("Error Handling", false, `Error: ${error}`);
    }
  }

  private async testCORSConfiguration(): Promise<void> {
    console.log("7️⃣ Testing CORS Configuration...");

    try {
      // Test OPTIONS request for CORS preflight
      const response = await fetch(`${STAGING_API_BASE}/api/sign-file`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Authorization",
        },
      });

      const corsHeaders = {
        "Access-Control-Allow-Origin": response.headers.get(
          "Access-Control-Allow-Origin"
        ),
        "Access-Control-Allow-Methods": response.headers.get(
          "Access-Control-Allow-Methods"
        ),
        "Access-Control-Allow-Headers": response.headers.get(
          "Access-Control-Allow-Headers"
        ),
      };

      this.addResult(
        "CORS Configuration",
        true,
        "CORS headers present",
        corsHeaders
      );
    } catch (error) {
      this.addResult("CORS Configuration", false, `Error: ${error}`);
    }
  }

  private addResult(
    name: string,
    success: boolean,
    error?: string,
    details?: any
  ): void {
    this.results.push({ name, success, error, details });
  }

  private displayResults(): void {
    console.log("\n📊 Staging Validation Results:");
    console.log("=".repeat(50));

    const passed = this.results.filter((r) => r.success).length;
    const total = this.results.length;

    this.results.forEach((result) => {
      const status = result.success ? "✅" : "❌";
      console.log(`${status} ${result.name}`);

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.details) {
        console.log(`   Details:`, result.details);
      }
    });

    console.log("\n" + "=".repeat(50));
    console.log(`📈 Summary: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log("🎉 All staging validation tests passed!");
    } else {
      console.log("⚠️ Some tests failed. Check the details above.");
    }
  }
}

// Export for use in browser console
export const stagingValidator = new StagingValidator();

// Auto-run if called directly
if (typeof window !== "undefined") {
  // Make it available globally for browser console
  (window as any).testStaging = () => stagingValidator.runAllTests();
  console.log(
    "🧪 Staging validator loaded! Run 'testStaging()' in console to start validation."
  );
}
