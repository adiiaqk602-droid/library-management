import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, role, library_id").eq("id", user.id).single();
  if (!profile) return <main><div className="panel"><h1>Account not configured</h1><p>Ask the Super Admin to assign your role and library.</p><form action={signOut}><button>Sign out</button></form></div></main>;
  if (profile.role === "super_admin") redirect("/admin");
  const { data: library } = await supabase.from("libraries").select("name, slug").eq("id", profile.library_id).single();
  if (!library) return <main><div className="panel"><h1>Library assignment missing</h1><form action={signOut}><button>Sign out</button></form></div></main>;
  redirect("/" + library.slug);
}
