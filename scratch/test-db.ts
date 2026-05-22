import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  console.log("Fetching users...");
  const { data: users } = await supabase.from("items").select("*").eq("type", "user");
  console.log("Users:", users?.map(u => ({ id: u.id, username: u.data.username, display_name: u.data.display_name })));

  console.log("\nFetching organizations...");
  const { data: orgs } = await supabase.from("items").select("*").eq("type", "organization");
  console.log("Orgs:", orgs?.map(o => ({ id: o.id, name: o.data.name, owner_id: o.data.owner_id })));

  console.log("\nFetching role assignments...");
  const { data: roles } = await supabase.from("items").select("*").eq("type", "role_assignment");
  console.log("Roles:", roles?.map(r => ({
    id: r.id,
    scope_type: r.data.scope_type,
    scope_id: r.data.scope_id,
    user_id: r.data.user_id,
    role: r.data.role,
    status: r.data.status
  })));
}

test().catch(console.error);
