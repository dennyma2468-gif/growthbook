"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  getUserWalls,
  normalizeWallCode,
  switchToWall,
  createWallForUser,
} from "@/lib/walls";

type Lang = "en" | "zh" | "fr";

const T = {
  en: {
    wallCode: "Wall code",
    copy: "Copy",
    copied: "Copied!",
    shareLink: "Share link",
    linkCopied: "Link copied!",
    switch: "Switch wall",
    enterCode: "Enter or switch wall code",
    invalidCode: "Invalid code (9 letters/numbers)",
    cancel: "Cancel",
    enter: "Enter",
    recent: "Recent walls",
    signOut: "Sign out",
    myWalls: "My walls",
    newWall: "+ New wall",
    shareHint: "Anyone with this link can view this wall.",
    saveWarning:
      "⚠️ Your wall is linked to your account. You can sign in on any device with the same email.",
    newWallTitle: "New wall created",
    dismiss: "Got it",
  },
  zh: {
    wallCode: "墙码",
    copy: "复制",
    copied: "已复制",
    shareLink: "分享链接",
    linkCopied: "链接已复制",
    switch: "切换",
    enterCode: "输入或切换墙码",
    invalidCode: "无效墙码（需 9 位字母数字）",
    cancel: "取消",
    enter: "确认",
    recent: "最近的墙",
    shareHint: "有此链接的人都可查看这面墙。",
    saveWarning:
      "⚠️ 这面墙已绑定你的账号。用同一邮箱在任何设备登录即可查看。",
    newWallTitle: "新墙已创建",
    dismiss: "我知道了",
    signOut: "退出登录",
    myWalls: "我的墙",
    newWall: "+ 新建墙",
  },
  fr: {
    wallCode: "Code",
    copy: "Copier",
    copied: "Copié",
    shareLink: "Partager",
    linkCopied: "Lien copié !",
    switch: "Changer",
    enterCode: "Entrer un code de mur",
    invalidCode: "Code invalide (9 caractères)",
    cancel: "Annuler",
    enter: "Valider",
    recent: "Murs récents",
    shareHint: "Toute personne avec ce lien peut voir ce mur.",
    saveWarning:
      "⚠️ Ce mur est lié à votre compte. Connectez-vous avec le même e-mail sur n'importe quel appareil.",
    newWallTitle: "Nouveau mur créé",
    dismiss: "Compris",
    signOut: "Déconnexion",
    myWalls: "Mes murs",
    newWall: "+ Nouveau mur",
  },
};

function getShareUrl(code: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/wall?code=${encodeURIComponent(code)}`;
}

export default function WallCodeBar({
  wallCode,
  lang = "en",
  isNew = false,
  onChange,
}: {
  wallCode: string;
  lang?: Lang;
  isNew?: boolean;
  onChange?: (newCode: string) => void;
}) {
  const s = T[lang];
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [myWalls, setMyWalls] = useState<string[]>([]);
  const [showNewBanner, setShowNewBanner] = useState(isNew);
  const router = useRouter();

  useEffect(() => {
    getUserWalls()
      .then((walls) => setMyWalls(walls.map((w) => w.id).filter((c) => c !== wallCode)))
      .catch(() => setMyWalls([]));
  }, [wallCode, switching]);

  useEffect(() => {
    setShowNewBanner(isNew);
  }, [isNew]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(wallCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getShareUrl(wallCode));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {}
  }

  async function applyCode(code: string) {
    try {
      const normalized = await switchToWall(code);
      setSwitching(false);
      setCodeInput("");
      setCodeError("");
      onChange?.(normalized);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleNewWall() {
    try {
      const id = await createWallForUser();
      onChange?.(id);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submit() {
    const normalized = normalizeWallCode(codeInput);
    if (!normalized) {
      setCodeError(s.invalidCode);
      return;
    }
    await applyCode(normalized);
  }

  return (
    <div style={{ marginBottom: "1rem" }}>
      {showNewBanner && (
        <div
          style={{
            background: "#FEF6E5",
            border: "1px solid #F0C36D",
            padding: "10px 12px",
            borderRadius: 12,
            marginBottom: 8,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0, marginBottom: 6, fontWeight: 600, color: "#7A4A02" }}>
            {s.newWallTitle}
          </p>
          <p style={{ margin: 0, color: "#7A4A02" }}>{s.saveWarning}</p>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={copyCode}
              style={{
                padding: "6px 12px",
                fontSize: 11,
                border: "1px solid #7A4A02",
                background: "#7A4A02",
                color: "white",
                borderRadius: 14,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {copied ? s.copied : `${s.copy} (${wallCode})`}
            </button>
            <button
              type="button"
              onClick={() => setShowNewBanner(false)}
              style={{
                padding: "6px 12px",
                fontSize: 11,
                border: "1px solid #7A4A02",
                background: "transparent",
                color: "#7A4A02",
                borderRadius: 14,
                cursor: "pointer",
              }}
            >
              {s.dismiss}
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "#f5f7f9",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          fontSize: 12,
        }}
      >
        <span style={{ color: "#666" }}>{s.wallCode}:</span>
        <code
          style={{
            fontFamily: "monospace",
            fontWeight: 600,
            color: "#0F6E56",
            letterSpacing: 1,
          }}
        >
          {wallCode}
        </code>
        <button
          type="button"
          onClick={copyCode}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            border: "1px solid #0F6E56",
            background: "transparent",
            color: "#0F6E56",
            borderRadius: 16,
            cursor: "pointer",
          }}
        >
          {copied ? s.copied : s.copy}
        </button>
        <button
          type="button"
          onClick={copyLink}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            border: "1px solid #0F6E56",
            background: "#E1F5EE",
            color: "#085041",
            borderRadius: 16,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {linkCopied ? s.linkCopied : s.shareLink}
        </button>
        <button
          type="button"
          onClick={() => setSwitching(true)}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            border: "1px solid #ddd",
            background: "transparent",
            color: "#666",
            borderRadius: 16,
            cursor: "pointer",
          }}
        >
          {s.switch}
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            border: "1px solid #ddd",
            background: "transparent",
            color: "#888",
            borderRadius: 16,
            cursor: "pointer",
          }}
        >
          {s.signOut}
        </button>
      </div>

      {switching && (
        <div
          onClick={() => setSwitching(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 16,
              padding: "1.5rem",
              width: "100%",
              maxWidth: 360,
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>
              {s.enterCode}
            </h3>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="ABC-DEF-GHJ"
              autoFocus
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 16,
                fontFamily: "monospace",
                letterSpacing: 1,
                border: "1px solid #ddd",
                borderRadius: 10,
                marginBottom: 8,
                outline: "none",
                textTransform: "uppercase",
                boxSizing: "border-box",
              }}
            />
            {codeError && (
              <p style={{ color: "#c00", fontSize: 12, marginBottom: 8 }}>{codeError}</p>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: myWalls.length ? 16 : 0 }}>
              <button
                type="button"
                onClick={() => {
                  setSwitching(false);
                  setCodeInput("");
                  setCodeError("");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "1px solid #ddd",
                  background: "transparent",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                onClick={submit}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "none",
                  background: "#0F6E56",
                  color: "white",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {s.enter}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: myWalls.length ? 12 : 0 }}>
              <button
                type="button"
                onClick={handleNewWall}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: 12,
                  border: "1px dashed #0F6E56",
                  background: "#f9fffe",
                  color: "#0F6E56",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {s.newWall}
              </button>
            </div>

            {myWalls.length > 0 && (
              <>
                <p
                  style={{
                    fontSize: 11,
                    color: "#888",
                    margin: 0,
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {s.myWalls}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {myWalls.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => applyCode(c)}
                      style={{
                        padding: "6px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                        border: "1px solid #ddd",
                        background: "#f9f9f9",
                        color: "#333",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
