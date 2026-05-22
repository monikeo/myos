import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Migration failed: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log("⚙️  Reading existing myos.db SQLite file...");
  
  let db;
  try {
    db = new Database("myos.db");
  } catch (err: any) {
    console.error("❌ Could not read myos.db SQLite database. Make sure it exists in the workspace root.", err.message);
    process.exit(1);
  }

  const rows = db.prepare("SELECT * FROM items").all() as any[];
  
  if (rows.length === 0) {
    console.log("⚠️  SQLite items table is empty. Nothing to migrate.");
    process.exit(0);
  }

  console.log(`📦 Found ${rows.length} items to migrate. Commencing batch ingestion into Supabase...`);

  // Transform to Supabase schema format
  const records = rows.map(r => ({
    id: r.id,
    type: r.type,
    data: JSON.parse(r.data),
    created_at: r.created_at,
    updated_at: r.updated_at
  }));

  // Batch insert in blocks of 50
  const chunkSize = 50;
  let successCount = 0;
  
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { error } = await supabase.from("items").upsert(chunk);
    
    if (error) {
      console.error(`❌ Error migrating batch ${i / chunkSize + 1}:`, error.message);
    } else {
      successCount += chunk.length;
      console.log(`✅ Migrated batch ${i / chunkSize + 1}: ${successCount}/${records.length} records...`);
    }
  }

  console.log(`\n🎉 Ingestion sequence completed. ${successCount} records successfully migrated to Supabase!`);
}

runMigration().catch(console.error);
