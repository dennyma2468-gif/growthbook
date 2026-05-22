"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@/lib/auth";
import { ensureUserWall, switchToWall, normalizeWallCode } from "@/lib/walls";

const T = {
  en: {
    title: "GrowthBook",
    subtitle: "Sign in to your child's memory wall",
    email: "Email",
    password: "Password",
    childName: "Child's name (optional)",
    signIn: "Sign in",
    signUp: "Create account",
    claimCode: "Have an old wall code? (optional)",
    claimPlaceholder: "ABC-DEF-GHJ",
    loading: "Please wait...",
    switchMode: "New here? Create account",
    switchModeBack: "Already have an account? Sign in",
  },
  zh: {
    title: "成长册",
    subtitle: "登录后查看孩子的成长墙",
    email: "邮箱",
    password: "密码",
    childName: "孩子的名字（可选）",
    signIn: "登录",
    signUp: "注册账号",
    claimCode: "有之前的墙码？（可选）",
    claimPlaceholder: "ABC-DEF-GHJ",
    loading: "请稍候...",
    switchMode: "新用户？注册账号",
    switchModeBack: "已有账号？登录",
  },
  fr: {
    title: "GrowthBook",
    subtitle: "Connectez-vous au mur des souvenirs",
    email: "E-mail",
    password: "Mot de passe",
    childName: "Prénom de l'enfant (optionnel)",
    signIn: "Connexion",
    signUp: "Créer un compte",
    claimCode: "Ancien code de mur ? (optionnel)",
    claimPlaceholder: "ABC-DEF-GHJ",
    loading: "Veuillez patienter...",
    switchMode: "Nouveau ? Créer un compte",
    switchModeBack: "Déjà un compte ? Connexion",
  },
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/upload";
  const codeFromUrl = searchParams.get("code") || "";

  const [lang] = useState<"en" | "zh" | "fr">("zh");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [claimCode, setClaimCode] = useState(codeFromUrl);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const s = T[lang];

  async function afterAuth() {
    const claim = normalizeWallCode(claimCode);
    if (claim) {
      await switchToWall(claim);
    } else {
      await ensureUserWall(childName || undefined);
    }
    if (childName) localStorage.setItem("growthbook_child", childName);
    router.push(next);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      await afterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 400,
        margin: "0 auto",
        padding: "2rem 1rem",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>{s.title}</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: "1.5rem" }}>{s.subtitle}</p>

      <form onSubmit={handleSubmit}>
        <label style={{ fontSize: 13, color: "#666" }}>{s.email}</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label style={{ fontSize: 13, color: "#666", marginTop: 12, display: "block" }}>
          {s.password}
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {mode === "signup" && (
          <>
            <label style={{ fontSize: 13, color: "#666", marginTop: 12, display: "block" }}>
              {s.childName}
            </label>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        <label style={{ fontSize: 13, color: "#666", marginTop: 12, display: "block" }}>
          {s.claimCode}
        </label>
        <input
          type="text"
          value={claimCode}
          onChange={(e) => setClaimCode(e.target.value)}
          placeholder={s.claimPlaceholder}
          style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: 1 }}
        />

        {error && (
          <p
            style={{
              color: "#c00",
              fontSize: 13,
              marginTop: 12,
              padding: "8px 12px",
              background: "#fff5f5",
              borderRadius: 8,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "1.25rem",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: loading ? "#ccc" : "#0F6E56",
            color: "white",
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? s.loading : mode === "signup" ? s.signUp : s.signIn}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        style={{
          marginTop: "1rem",
          background: "none",
          border: "none",
          color: "#0F6E56",
          fontSize: 14,
          cursor: "pointer",
          textAlign: "center",
          width: "100%",
        }}
      >
        {mode === "signin" ? s.switchMode : s.switchModeBack}
      </button>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #ddd",
  borderRadius: 10,
  fontSize: 15,
  marginTop: 6,
  outline: "none",
  boxSizing: "border-box",
};
