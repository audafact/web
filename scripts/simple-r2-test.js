import fetch from "node-fetch";

const WORKER_URL = "https://audafact-api.david-g-cortinas.workers.dev";

/**
 * Simple test to check if R2 is accessible
 */
async function testR2Access() {
  console.log("🧪 Testing R2 Access...\n");

  try {
    // Test 1: Check if Worker is responding
    console.log("1️⃣ Testing Worker response...");
    const response = await fetch(`${WORKER_URL}/api/sign-file?key=test`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${await response.text()}\n`);

    // Test 2: Try to access a non-existent file
    console.log("2️⃣ Testing R2 file access...");
    const streamResponse = await fetch(
      `${WORKER_URL}/api/stream?key=test-file`
    );
    console.log(`   Status: ${streamResponse.status}`);
    console.log(`   Response: ${await streamResponse.text()}\n`);

    // Test 3: Check if we can get a presigned URL (without auth)
    console.log("3️⃣ Testing presigned URL generation...");
    const uploadResponse = await fetch(`${WORKER_URL}/api/sign-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: "test.mp3",
        contentType: "audio/mp3",
        sizeBytes: 1024,
      }),
    });
    console.log(`   Status: ${uploadResponse.status}`);
    console.log(`   Response: ${await uploadResponse.text()}\n`);
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

/**
 * Test with a simple file upload to R2
 */
async function testSimpleUpload() {
  console.log("📤 Testing Simple R2 Upload...\n");

  try {
    // Create a simple test file
    const testContent = "This is a test file for R2 migration";
    const testBuffer = Buffer.from(testContent, "utf8");

    // Try to get a presigned URL (this will fail without auth, but let's see the error)
    console.log("🔑 Requesting presigned URL...");
    const response = await fetch(`${WORKER_URL}/api/sign-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: "test-upload.txt",
        contentType: "text/plain",
        sizeBytes: testBuffer.length,
      }),
    });

    console.log(`   Status: ${response.status}`);
    const responseText = await response.text();
    console.log(`   Response: ${responseText}`);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log(`   ✅ Got presigned URL: ${data.uploadUrl}`);
      console.log(`   Key: ${data.key}`);
    } else {
      console.log(`   ❌ Failed to get presigned URL`);
    }
  } catch (error) {
    console.error("❌ Upload test failed:", error);
  }
}

// Main execution
async function main() {
  console.log("🚀 Simple R2 Test Script\n");

  await testR2Access();
  console.log("---");
  await testSimpleUpload();

  console.log("\n🎯 Test completed!");
}

main().catch(console.error);
