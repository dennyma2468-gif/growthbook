"use client";
// app/wall/page.tsx
// Memory wall — waterfall grid of processed photos
// Reads from Supabase (or localStorage fallback)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DisplayPhoto } from "@/lib/agents";
import {
  getOrCreateWallId,
  isSupabaseReady,
  loadPhotosFromSupabase,
  setWallId,
  normalizeWallCode,
} from "@/lib/photos";

const STRINGS = {
  en: {
    title: "Memory Wall",
    empty: "No photos yet",
    emptyHint: "Upload some photos to start",
    add: "+ Add more",
    highlights: "Highlights",
    all: "All",
    filtered: (n: number) => `${n} photo${n !== 1 ? "s" : ""} filtered by AI`,
    wallCode: "Wall code",
    copy: "Copy",
    copied: "Copied!",
    switch: "Switch wall",
    enterCode: "Enter wall code",
    invalidCode: "Invalid code — should be 9 letters/numbers",
    cancel: "Cancel",
    enter: "Enter",
    shareLink: "Share link",
    linkCopied: "Link copied!",
    shareHint: "Anyone with this link can view this wall (needs internet + deployed site).",
  },
  zh: {
    title: "成长墙",
    empty: "还没有照片",
    emptyHint: "上传照片开始记录",
    add: "+ 添加更多",
    highlights: "精彩时刻",
    all: "全部",
    filtered: (n: number) => `AI 过滤了 ${n} 张照片`,
    wallCode: "墙码",
    copy: "复制",
    copied: "已复制",
    switch: "切换墙",
    enterCode: "输入墙码",
    invalidCode: "无效的墙码（需 9 位字母数字）",
    cancel: "取消",
    enter: "确认",
    shareLink: "分享链接",
    linkCopied: "链接已复制",
    shareHint: "有链接的人可查看这面墙（需公网部署后生效）。",
  },
  fr: {
    title: "Mur des souvenirs",
    empty: "Pas encore de photos",
    emptyHint: "Ajoutez des photos pour commencer",
    add: "+ Ajouter",
    highlights: "Moments forts",
    all: "Tout",
    filtered: (n: number) => `${n} photo${n !== 1 ? "s" : ""} filtrée${n !== 1 ? "s" : ""} par l'IA`,
    wallCode: "Code du mur",
    copy: "Copier",
    copied: "Copié !",
    switch: "Changer de mur",
    enterCode: "Saisir le code",
    invalidCode: "Code invalide (9 caractères)",
    cancel: "Annuler",
    enter: "Valider",
    shareLink: "Lien de partage",
    linkCopied: "Lien copié !",
    shareHint: "Toute personne avec ce lien peut voir ce mur (site en ligne requis).",
  },
};

function getShareUrl(code: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/wall?code=${encodeURIComponent(code)}`;
}

// Tag color mapping
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  milestone: { bg: "#E1F5EE", text: "#085041" },
  "first steps": { bg: "#E1F5EE", text: "#085041" },
  "初次学步": { bg: "#E1F5EE", text: "#085041" },
  playful: { bg: "#EEEDFE", text: "#3C3489" },
  learning: { bg: "#E6F1FB", text: "#0C447C" },
  tender: { bg: "#FBEAF0", text: "#72243E" },
  outdoors: { bg: "#EAF3DE", text: "#27500A" },
  everyday: { bg: "#F1EFE8", text: "#444441" },
  default: { bg: "#F1EFE8", text: "#5F5E5A" },
};

function getTagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] || TAG_COLORS.default;
}

export default function WallPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [childName, setChildName] = useState("");
  const [lang, setLang] = useState<"en" | "zh" | "fr">("en");
  const [filter, setFilter] = useState<"all" | "highlights">("all");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [wallCode, setWallCode] = useState("");
  const [zoomed, setZoomed] = useState<DisplayPhoto | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  async function loadFor(wallId: string) {
    if (isSupabaseReady()) {
      const fromDb = await loadPhotosFromSupabase(wallId);
      setPhotos(fromDb);
    } else {
      const stored = localStorage.getItem("growthbook_photos");
      setPhotos(stored ? JSON.parse(stored) : []);
    }
  }

  useEffect(() => {
    async function load() {
      const name = localStorage.getItem("growthbook_child") || "";
      const l = (localStorage.getItem("growthbook_lang") || "en") as "en" | "zh" | "fr";
      setChildName(name);
      setLang(l);

      // Open shared link: /wall?code=ABC-DEF-GHJ
      let wallId = getOrCreateWallId();
      if (typeof window !== "undefined") {
        const fromUrl = new URLSearchParams(window.location.search).get("code");
        if (fromUrl) {
          const normalized = normalizeWallCode(fromUrl);
          if (normalized) {
            setWallId(normalized);
            wallId = normalized;
          }
        }
      }
      setWallCode(wallId);

      try {
        await loadFor(wallId);
      } catch (err) {
        console.error(err);
        const stored = localStorage.getItem("growthbook_photos");
        if (stored) setPhotos(JSON.parse(stored));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(wallCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(getShareUrl(wallCode));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function submitNewCode() {
    setCodeError("");
    const normalized = normalizeWallCode(codeInput);
    if (!normalized) {
      setCodeError(s.invalidCode);
      return;
    }
    try {
      setWallId(normalized);
      setWallCode(normalized);
      setLoading(true);
      setSwitching(false);
      setCodeInput("");
      await loadFor(normalized);
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // ESC closes zoomed image
  useEffect(() => {
    if (!zoomed) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomed]);

  const s = STRINGS[lang];
  const displayed = filter === "highlights" ? photos.filter((p) => p.isHighlight) : photos;

  function toggleLike(id: string) {
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "4rem 1rem", textAlign: "center" }}>
        <p style={{ color: "#888" }}>Loading...</p>
      </main>
    );
  }

  const WallCodeBar = (
    <div style={{ marginBottom: "1rem" }}>
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
        <code style={{ fontFamily: "monospace", fontWeight: 600, color: "#0F6E56", letterSpacing: 1 }}>
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
          onClick={copyShareLink}
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
      </div>
      <p style={{ fontSize: 11, color: "#999", marginTop: 6, marginBottom: 0, lineHeight: 1.4 }}>
        {s.shareHint}
      </p>
    </div>
  );

  const SwitchModal = switching && (
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
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>{s.enterCode}</h3>
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
          }}
        />
        {codeError && <p style={{ color: "#c00", fontSize: 12, marginBottom: 8 }}>{codeError}</p>}
        <div style={{ display: "flex", gap: 8 }}>
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
            onClick={submitNewCode}
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
      </div>
    </div>
  );

  if (photos.length === 0) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem", textAlign: "center" }}>
        {WallCodeBar}
        {SwitchModal}
        <div style={{ fontSize: 48, marginTop: "2rem", marginBottom: 16 }}>📭</div>
        <p style={{ fontSize: 18, fontWeight: 500 }}>{s.empty}</p>
        <p style={{ color: "#888", marginBottom: "1.5rem" }}>{s.emptyHint}</p>
        <button
          type="button"
          onClick={() => router.push("/upload")}
          style={{
            padding: "12px 24px",
            background: "#0F6E56",
            color: "white",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {s.add}
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "1rem" }}>
      {WallCodeBar}
      {SwitchModal}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>
            {childName ? `${childName}'s ${s.title}` : s.title}
          </h1>
          <p style={{ fontSize: 12, color: "#aaa" }}>
            {photos.length} photos
          </p>
        </div>
        <button
          onClick={() => router.push("/upload")}
          style={{
            padding: "8px 14px",
            border: "1px solid #0F6E56",
            borderRadius: 20,
            background: "transparent",
            color: "#0F6E56",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {s.add}
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        {(["all", "highlights"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: `1px solid ${filter === f ? "#0F6E56" : "#ddd"}`,
              background: filter === f ? "#E1F5EE" : "transparent",
              color: filter === f ? "#085041" : "#888",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: filter === f ? 500 : 400,
            }}
          >
            {f === "all" ? s.all : s.highlights}
            {f === "highlights" && ` ✦`}
          </button>
        ))}
      </div>

      {/* Waterfall grid — 2 columns */}
      <div style={{ columns: 2, gap: 10 }}>
        {displayed.map((photo) => (
          <div
            key={photo.id}
            style={{
              breakInside: "avoid",
              marginBottom: 10,
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid #eee",
              background: "white",
              position: "relative",
            }}
          >
            {photo.imageUrl || photo.base64 ? (
              <img
                src={
                  photo.imageUrl ||
                  `data:${photo.mimeType || "image/jpeg"};base64,${photo.base64}`
                }
                alt={photo.caption || ""}
                onClick={() => setZoomed(photo)}
                style={{
                  width: "100%",
                  display: "block",
                  aspectRatio: photo.displaySize === "large" ? "3/4" : "1/1",
                  objectFit: "cover",
                  cursor: "zoom-in",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: photo.displaySize === "large" ? "3/4" : "1/1",
                  background: `hsl(${Math.abs(photo.id.charCodeAt(6) || 0) % 360}, 30%, 90%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                }}
              >
                🌱
              </div>
            )}

            {/* Like button */}
            <button
              onClick={() => toggleLike(photo.id)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.9)",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Like"
            >
              {liked.has(photo.id) ? "❤️" : "🤍"}
            </button>

            {/* Highlight badge */}
            {photo.isHighlight && (
              <div style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "#0F6E56",
                color: "white",
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 10,
                fontWeight: 500,
              }}>
                ✦ highlight
              </div>
            )}

            {/* Caption area */}
            <div style={{ padding: "10px 12px" }}>
              {/* Tags */}
              {photo.tags && photo.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                  {photo.tags.slice(0, 2).map((tag) => {
                    const c = getTagColor(tag);
                    return (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: c.bg,
                          color: c.text,
                        }}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Caption */}
              <p style={{ fontSize: 12, color: "#555", lineHeight: 1.5, margin: 0 }}>
                {photo.caption || ""}
              </p>

              {/* Date */}
              {photo.date && (
                <p style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>{photo.date}</p>
              )}

              {/* Voice note indicator */}
              {photo.voiceNote && (
                <div style={{
                  marginTop: 6,
                  padding: "4px 8px",
                  background: "#EEEDFE",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#534AB7",
                }}>
                  🎤 {photo.voiceNote.slice(0, 40)}...
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen image viewer */}
      {zoomed && (
        <div
          onClick={() => setZoomed(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 12,
            cursor: "zoom-out",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(null);
            }}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "white",
              fontSize: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
          <img
            src={
              zoomed.imageUrl ||
              `data:${zoomed.mimeType || "image/jpeg"};base64,${zoomed.base64}`
            }
            alt={zoomed.caption || ""}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "85vh",
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
          {zoomed.caption && (
            <p
              style={{
                color: "white",
                fontSize: 13,
                marginTop: 16,
                textAlign: "center",
                maxWidth: 480,
                lineHeight: 1.5,
                padding: "0 12px",
              }}
            >
              {zoomed.caption}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
