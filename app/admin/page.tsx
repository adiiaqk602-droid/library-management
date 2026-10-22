import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/dashboard");
  const { data: libraries } = await supabase.from("libraries").select("id,name,slug").order("name");
  return <main><div className="panel"><h1>Super Admin Panel</h1><p>Welcome, {profile.full_name}</p><p>Admin can access all five libraries.</p>
    <ul>{(libraries ?? []).map((lib) => <li key={lib.id}><Link href={"/" + lib.slug}>{lib.name}</Link> <span className="muted">/{lib.slug}</span></li>)}</ul>
    <p className="muted">Create/assign accounts in Supabase Dashboard in this starter. A secure user-management screen is a later module.</p>
    <form action={signOut}><button>Sign out</button></form></div></main>;
}
