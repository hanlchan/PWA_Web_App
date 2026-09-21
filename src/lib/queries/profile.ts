import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/supabase/auth";
export async function getPrivateProfile(){const userId=await getVerifiedUserId();if(!userId)return null;const supabase=await createClient();const [{data:profile},{data:settings}]=await Promise.all([supabase.from("profiles").select("*").eq("id",userId).single(),supabase.from("profile_settings").select("*").eq("user_id",userId).single()]);return profile&&settings?{profile,settings}:null;}
