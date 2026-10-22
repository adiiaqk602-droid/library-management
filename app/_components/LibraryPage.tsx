import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export async function LibraryPage({ slug }: { slug: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, role, library_id").eq("id", user.id).single();
  if (!profile) redirect("/login");
  const { data: library } = await supabase.from("libraries").select("id, name, slug").eq("slug", slug).single();
  if (!library) redirect("/dashboard");
  if (profile.role !== "super_admin" && profile.library_id !== library.id) redirect("/dashboard");
  const { count: booksCount } = await supabase.from("books").select("*", { count: "exact", head: true }).eq("library_id", library.id);
  const { data: books } = await supabase.from("books").select("id, accession_no, title, author, status").eq("library_id", library.id).order("created_at", { ascending: false }).limit(20);
  return <main><div className="panel"><p><Link href="/dashboard">Dashboard</Link> {profile.role === "super_admin" && <Link href="/admin">Admin panel</Link>}</p>
    <h1>{library.name}</h1><p>Signed in as {profile.full_name} ({profile.role})</p><h2>Books: {booksCount ?? 0}</h2>
    <p className="muted">Starter view: book listing only. Add validated forms and tested workflows before production use.</p>
    <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th align="left">Accession No.</th><th align="left">Title</th><th align="left">Author</th><th align="left">Status</th></tr></thead>
    <tbody>{(books ?? []).map((b) => <tr key={b.id}><td style={{padding:"8px 4px"}}>{b.accession_no}</td><td>{b.title}</td><td>{b.author ?? "—"}</td><td>{b.status}</td></tr>)}</tbody></table>
    <form action={signOut} style={{marginTop:24}}><button>Sign out</button></form>
  </div></main>;
}
