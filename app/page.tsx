import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function RootPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect("/kanban");
    }
  } catch {
    // If not authenticated or error, redirect to login
  }
  redirect("/login");
}
