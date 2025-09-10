#!/usr/bin/env node

/**
 * Test script to verify database functions work correctly
 * Run this after applying the migrations to verify everything works
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("- VITE_SUPABASE_URL");
  console.error("- VITE_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabaseFunctions() {
  console.log("🧪 Testing Database Functions...\n");

  try {
    // Test 1: Test quota function
    console.log("1. Testing quota function...");
    const { data: quotaResult, error: quotaError } = await supabase.rpc(
      "check_user_upload_quota",
      {
        p_user_id: "00000000-0000-0000-0000-000000000000", // Test UUID
        p_file_size: 1000000, // 1MB
        p_quota_limit: 100000000, // 100MB
      }
    );

    if (quotaError) {
      console.error("❌ Error testing quota function:", quotaError);
    } else {
      console.log("✅ Quota function works, result:", quotaResult);
    }

    // Test 2: Test access control function
    console.log("\n2. Testing access control function...");
    const { data: accessResult, error: accessError } = await supabase.rpc(
      "check_library_access",
      {
        p_user_id: "00000000-0000-0000-0000-000000000000", // Test UUID
        p_track_id: "00000000-0000-0000-0000-000000000000", // Test UUID
      }
    );

    if (accessError) {
      console.error("❌ Error testing access control function:", accessError);
    } else {
      console.log("✅ Access control function works, result:", accessResult);
    }

    // Test 3: Test usage function
    console.log("\n3. Testing usage function...");
    const { data: usageResult, error: usageError } = await supabase.rpc(
      "get_user_upload_usage",
      {
        p_user_id: "00000000-0000-0000-0000-000000000000", // Test UUID
        p_period_days: 1,
      }
    );

    if (usageError) {
      console.error("❌ Error testing usage function:", usageError);
    } else {
      console.log("✅ Usage function works, result:", usageResult);
    }

    // Test 4: Test basic table operations
    console.log("\n4. Testing basic table operations...");

    // Try to select from uploads table
    const { data: uploadsData, error: uploadsError } = await supabase
      .from("uploads")
      .select(
        "id, user_id, file_key, content_type, size_bytes, title, created_at, updated_at"
      )
      .limit(1);

    if (uploadsError) {
      console.error("❌ Error accessing uploads table:", uploadsError);
    } else {
      console.log(
        "✅ Uploads table accessible, columns:",
        Object.keys(uploadsData[0] || {})
      );
    }

    // Try to select from library_tracks table
    const { data: tracksData, error: tracksError } = await supabase
      .from("library_tracks")
      .select("id, name, file_key, preview_key")
      .limit(1);

    if (tracksError) {
      console.error("❌ Error accessing library_tracks table:", tracksError);
    } else {
      console.log(
        "✅ Library tracks table accessible, columns:",
        Object.keys(tracksData[0] || {})
      );
    }

    console.log("\n🎉 Database function testing completed!");
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  }
}

// Run the tests
testDatabaseFunctions();
