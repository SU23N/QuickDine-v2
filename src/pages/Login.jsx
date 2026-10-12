import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import Nav from "../components/Nav";
import { auth, configured } from "../firebase/config";
import { useLanguage } from "../lib/i18n";
import { useSession } from "../hooks/useSession";
export default function Login() {
  const { t } = useLanguage(),
    { staff, user } = useSession(),
    navigate = useNavigate();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/workspace");
    } catch {
      setError("Sign-in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Nav />
      <main className="dashboard-page">
        <h1>{t("login")}</h1>
        {!configured ? (
          <p>{t("demo")}</p>
        ) : (
          <form className="form-panel" onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? t("loading") : t("login")}
            </button>
            <button type="button" className="secondary" disabled={!email||busy} onClick={async()=>{try{await sendPasswordResetEmail(auth,email);setError("If this account exists, a password setup/reset email has been sent.");}catch{setError("Password reset could not start. Check the email address.");}}}>Set / reset your password</button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {user && !user.isAnonymous && !staff && <p>{t("staffOnly")}</p>}
          </form>
        )}
      </main>
    </>
  );
}
