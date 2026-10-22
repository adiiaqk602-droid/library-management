import { signIn } from "./actions";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?: string}> }) {
  const params = await searchParams;
  return <main><div className="panel"><h1>Library System Login</h1>
    {params.error && <p role="alert">Login failed. Please check your email and password.</p>}
    <form action={signIn}><label>Email</label><input name="email" type="email" autoComplete="username" required />
      <label>Password</label><input name="password" type="password" autoComplete="current-password" required />
      <button type="submit">Sign in</button></form>
      <p className="muted">Accounts are created by the system administrator.</p></div></main>;
}
