import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAccount } from "../lib/account";

function Auth({ mode }) {
  const isSignUp = mode === "sign-up";
  const { user, ready, signIn, signUp } = useAccount();
  const { state } = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to={state?.from || "/"} replace />;

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isSignUp) await signUp(form);
      else await signIn({ email: form.email, password: form.password });
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        {isSignUp ? "Create your account" : "Welcome back"}
      </h1>
      <p className="text-muted mt-1 mb-6">
        Keep your watchlist and portfolio on every device, and get price alerts.
      </p>
      <form onSubmit={submit} className="card p-6 flex flex-col gap-4">
        {isSignUp && (
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input className="input mt-1" required minLength={2} maxLength={60} value={form.name} onChange={update("name")} />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input className="input mt-1" type="email" autoComplete="email" required value={form.email} onChange={update("email")} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input className="input mt-1" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={isSignUp ? 8 : 1} value={form.password} onChange={update("password")} />
        </label>
        {error && <p role="alert" className="text-sm text-down">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Please wait" : isSignUp ? "Create account" : "Sign in"}
        </button>
        <p className="text-center text-sm text-muted">
          {isSignUp ? "Already registered? " : "New here? "}
          <Link to={isSignUp ? "/sign-in" : "/sign-up"} state={state} className="text-brand font-medium">
            {isSignUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Auth;
