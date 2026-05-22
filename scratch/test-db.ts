import { supabase } from "../lib/supabase.js";

async function testConnection() {
  console.log("📡 Pinging Supabase client...");
  console.log("URL:", process.env.SUPABASE_URL);

  try {
    const { data, error } = await supabase.from("items").select("*").limit(1);
    
    if (error) {
      console.error("❌ Supabase query failed!");
      console.error("Error Code:", error.code);
      console.error("Error Message:", error.message);
      console.error("Hint:", error.hint);
    } else {
      console.log("✅ Supabase connection successful!");
      console.log("Result rows count:", data.length);
    }
  } catch (err: any) {
    console.error("💥 Execution crashed trying to connect:", err.message);
  }
}

testConnection();
