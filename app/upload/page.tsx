"use client";
// app/upload/page.tsx
// Mobile-first upload screen
// What happens here:
// 1. Parent picks photos from phone
// 2. Photos converted to base64
// 3. Pipeline runs (3 agents)
// 4. Results saved to localStorage (no database needed for MVP)
// 5. Redirect to /wall

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/lib/agents";
import {
  getOrCreateWallId,
  isSupabaseReady,
  savePhotosToSupabase,
  normalizeWallCode,
  setWallId,
} from "@/lib/photos";
import { resizeAndEncode } from "@/lib/image-utils";
import WallCodeBar from "@/components/WallCodeBar";

type SelectedPhoto = {
  id: string;
  file: File;
  preview: string;
};

const STRINGS = {
  en: {
    title: "Add photos",
    subtitle: "Select photos from your camera roll",
    tap: "Tap to choose photos",
    selected: (n: number) => `${n} photo${n !== 1 ? "s" : ""} selected`,
    childName: "Child's name (optional)",
    lang: "Caption language",
    process: "Process photos →",
    processing: "Processing...",
    step1: "Filtering photos",
    step2: "Writing captions",
    step3: "Designing layout",
    done: "Done! Showing your memories...",
    remove: "Remove",
    clearAll: "Clear all",
  },
  zh: {
    title: "添加照片",
    subtitle: "从相册选择照片",
    tap: "点击选择照片",
    selected: (n: number) => `已选择 ${n} 张照片`,
    childName: "孩子的名字（可选）",
    lang: "描述语言",
    process: "开始处理 →",
    processing: "处理中...",
    step1: "筛选照片",
    step2: "生成描述",
    step3: "排版设计",
    done: "完成！正在显示成长记录...",
    remove: "删除",
    clearAll: "全部清除",
  },
  fr: {
    title: "Ajouter des photos",
    subtitle: "Choisissez des photos de votre galerie",
    tap: "Appuyez pour choisir",
    selected: (n: number) => `${n} photo${n !== 1 ? "s" : ""} sélectionnée${n !== 1 ? "s" : ""}`,
    childName: "Prénom de l'enfant (optionnel)",
    lang: "Langue des descriptions",
    process: "Traiter les photos →",
    processing: "En cours...",
    step1: "Filtrage des photos",
    step2: "Rédaction des légendes",
    step3: "Mise en page",
    done: "Terminé ! Affichage des souvenirs...",
    remove: "Supprimer",
    clearAll: "Tout effacer",
  },
};

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  
  const [lang, setLang] = useState<Language>("en");
  const [childName, setChildName] = useState("");
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0); // 0=idle, 1-3=agents, 4=done
  const [error, setError] = useState("");
  const [wallCode, setWallCodeState] = useState("");
  const [isNewWall, setIsNewWall] = useState(false);

  useEffect(() => {
    let { id, isNew } = getOrCreateWallId();
    if (typeof window !== "undefined") {
      const fromUrl = new URLSearchParams(window.location.search).get("code");
      if (fromUrl) {
        const normalized = normalizeWallCode(fromUrl);
        if (normalized) {
          setWallId(normalized);
          id = normalized;
          isNew = false;
        }
      }
    }
    setWallCodeState(id);
    setIsNewWall(isNew);
    const storedLang = localStorage.getItem("growthbook_lang") as Language | null;
    if (storedLang) setLang(storedLang);
  }, []);

  const s = STRINGS[lang];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // allow picking same file again

    picked.forEach((file) => {
      const id = `sel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const reader = new FileReader();
      reader.onerror = () =>
        setError("Could not read one photo. Try JPG/PNG or pick again.");
      reader.onload = (ev) => {
        const preview = ev.target?.result as string;
        if (!preview) return;
        setSelected((prev) => [...prev, { id, file, preview }]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(id: string) {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  }

  function clearAllPhotos() {
    setSelected([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleProcess() {
    if (selected.length === 0) return;
    setError("");
    setStep(1);

    try {
      const rawPhotos = await Promise.all(
        selected.map(async (item, i) => {
          const base64 = await resizeAndEncode(item.file, 1024);
          return {
            id: `photo_${i}_${Date.now()}`,
            base64,
            mimeType: "image/jpeg",
          };
        })
      );

      const progressTimer = setInterval(() => {
        setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
      }, 6000);

      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawPhotos,
          language: lang,
          childName: childName || undefined,
        }),
      });
      clearInterval(progressTimer);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      // Keep original image data for the wall (match by photo id — agent3 may reorder)
      const previewById: Record<string, string> = {};
      rawPhotos.forEach((rp, i) => {
        const preview = selected[i]?.preview;
        if (preview?.includes(",")) previewById[rp.id] = preview.split(",")[1];
      });
      const newPhotos = data.map((photo: { id: string; base64?: string; mimeType?: string }) => ({
        ...photo,
        base64: photo.base64 || previewById[photo.id] || "",
        mimeType: photo.mimeType || "image/jpeg",
      }));

      localStorage.setItem("growthbook_child", childName);
      localStorage.setItem("growthbook_lang", lang);

      if (isSupabaseReady()) {
        const wallId = wallCode || getOrCreateWallId().id;
        await savePhotosToSupabase(newPhotos, wallId);
        // Only store settings locally — photos live in Supabase
        localStorage.removeItem("growthbook_photos");
      } else {
        // Fallback: localStorage (limited size, same device only)
        let existing: Array<{ id: string }> = [];
        try {
          existing = JSON.parse(localStorage.getItem("growthbook_photos") || "[]");
        } catch {
          existing = [];
        }
        const existingIds = new Set(existing.map((p) => p.id));
        const merged = [
          ...existing,
          ...newPhotos.filter((p: { id: string }) => !existingIds.has(p.id)),
        ];
        localStorage.setItem("growthbook_photos", JSON.stringify(merged));
      }

      setStep(4);
      setTimeout(() => router.push("/wall"), 1200);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep(0);
      console.error(err);
    }
  }

  const stepLabels = ["", s.step1, s.step2, s.step3, s.done];

  return (
    <main style={{
      maxWidth: 480,
      margin: "0 auto",
      padding: "1.5rem 1rem",
      fontFamily: "var(--font-sans, system-ui)",
    }}>
      {wallCode && (
        <WallCodeBar
          wallCode={wallCode}
          lang={lang}
          isNew={isNewWall && selected.length === 0}
          onChange={(c) => {
            setWallCodeState(c);
            setIsNewWall(false);
          }}
        />
      )}

      {/* Language toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", position: "relative", zIndex: 10 }}>
        {(["en", "zh", "fr"] as Language[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLang(l);
            }}
            style={{
              padding: "10px 16px",
              minHeight: 44,
              borderRadius: 20,
              border: `1px solid ${lang === l ? "#0F6E56" : "#ddd"}`,
              background: lang === l ? "#E1F5EE" : "transparent",
              color: lang === l ? "#085041" : "#888",
              fontSize: 13,
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            {l === "en" ? "EN" : l === "zh" ? "中文" : "FR"}
          </button>
        ))}
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>{s.title}</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: "1.5rem" }}>{s.subtitle}</p>

      {/* Upload zone — wrapped in <label> so iOS Safari opens the file picker */}
      <label
        style={{
          display: "block",
          position: "relative",
          overflow: "hidden",
          border: "2px dashed #ccc",
          borderRadius: 16,
          padding: "2rem",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "1.5rem",
          background: selected.length > 0 ? "#f9f9f9" : "transparent",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <input
          id="growthbook-file-input"
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
            zIndex: 2,
          }}
          onChange={handleFileChange}
        />
        <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
        
        {selected.length === 0 ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <p style={{ fontWeight: 500 }}>{s.tap}</p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>JPG, PNG, HEIC</p>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                pointerEvents: "auto",
              }}
            >
              <p style={{ fontSize: 13, color: "#0F6E56", fontWeight: 500, margin: 0 }}>
                {s.selected(selected.length)}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearAllPhotos();
                }}
                style={{
                  fontSize: 12,
                  color: "#c00",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                {s.clearAll}
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                pointerEvents: "auto",
              }}
            >
              {selected.map((item) => (
                <div key={item.id} style={{ position: "relative" }}>
                  <img
                    src={item.preview}
                    alt=""
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      objectFit: "cover",
                      borderRadius: 8,
                      display: "block",
                    }}
                  />
                  <button
                    type="button"
                    aria-label={s.remove}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removePhoto(item.id);
                    }}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.65)",
                      color: "white",
                      border: "none",
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {/* tap label area to add more */}
              <div
                style={{
                  aspectRatio: "1",
                  borderRadius: 8,
                  border: "2px dashed #ccc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: "#aaa",
                }}
              >
                +
              </div>
            </div>
          </>
        )}
        </div>
      </label>

      {/* Child name input */}
      <input
        type="text"
        placeholder={s.childName}
        value={childName}
        onChange={(e) => setChildName(e.target.value)}
        style={{
          width: "100%",
          padding: "12px 16px",
          border: "1px solid #ddd",
          borderRadius: 12,
          fontSize: 15,
          marginBottom: "1rem",
          outline: "none",
        }}
      />

      {/* Agent pipeline progress */}
      {step > 0 && (
        <div style={{
          padding: "1rem",
          borderRadius: 12,
          border: "1px solid #E1F5EE",
          background: "#f9fffe",
          marginBottom: "1rem",
        }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: step > n ? "#0F6E56" : step === n ? "#5DCAA5" : "#eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: step >= n ? "white" : "#aaa",
                flexShrink: 0,
                transition: "background 0.3s",
              }}>
                {step > n ? "✓" : n}
              </div>
              <span style={{
                fontSize: 14,
                color: step === n ? "#0F6E56" : step > n ? "#444" : "#bbb",
                fontWeight: step === n ? 500 : 400,
              }}>
                {[s.step1, s.step2, s.step3][n - 1]}
                {step === n && " ✦"}
              </span>
            </div>
          ))}
          {step === 4 && (
            <p style={{ fontSize: 13, color: "#0F6E56", fontWeight: 500, marginTop: 8 }}>{s.done}</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ color: "#c00", fontSize: 13, marginBottom: "1rem", padding: "8px 12px", background: "#fff5f5", borderRadius: 8 }}>
          {error}
        </p>
      )}

      {/* Process button */}
      <button
        type="button"
        onClick={handleProcess}
        disabled={selected.length === 0 || step > 0}
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: 14,
          border: "none",
          background: selected.length === 0 || step > 0 ? "#ccc" : "#0F6E56",
          color: "white",
          fontSize: 16,
          fontWeight: 600,
          cursor: selected.length === 0 || step > 0 ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {step > 0 && step < 4 ? s.processing : s.process}
      </button>
    </main>
  );
}
