// @ts-nocheck
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    const res = await signIn("credentials", { username, password, redirect: false });
    if (res.error) setError("Invalid username or password");
    else router.push("/portal");
  }

  return (
    <main className="login-page">
      <section className="login-aside">
        <div>
          <div className="brand"><span className="brand-mark">K</span><div><div className="brand-name">KPS Technology</div><div className="brand-caption">Fleet operations</div></div></div>
          <h1>Every truck. One clear view.</h1>
          <p>Keep vehicles moving with trip settlements, document reminders, and practical fleet records in one place.</p>
        </div>
        <div className="login-points"><span>Trip accounting and mileage</span><span>Photo-backed expense records</span><span>Expiry alerts before they matter</span></div>
      </section>
      <section className="login-form-wrap">
        <div className="login-card">
          <div className="eyebrow">Secure fleet access</div>
          <h2>Welcome back</h2>
          <p>Use the username created for your KPS Technology account.</p>
          <form onSubmit={handleSubmit}>
            <div className="field"><label htmlFor="username">Username</label><input id="username" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <div className="notice notice-error">{error}</div>}
            <button className="button button-primary" type="submit">Sign in to fleet console</button>
          </form>
        </div>
      </section>
    </main>
  );
}
