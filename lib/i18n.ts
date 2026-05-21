// lib/i18n.ts
// All UI strings in one place
// Usage: import { t } from "@/lib/i18n"; then t("upload.title", "zh")

export type Language = "en" | "zh" | "fr";

const strings = {
  en: {
    "app.name": "GrowthBook",
    "app.tagline": "Every moment, remembered.",
    "upload.title": "Add photos",
    "upload.subtitle": "Select photos from your camera roll",
    "upload.tap": "Tap to choose photos",
    "upload.process": "Process photos →",
    "upload.processing": "Processing...",
    "wall.title": "Memory Wall",
    "wall.highlights": "Highlights",
    "wall.all": "All",
    "wall.add": "+ Add more",
    "agent.1": "Filtering photos",
    "agent.2": "Writing captions",
    "agent.3": "Designing layout",
  },
  zh: {
    "app.name": "成长册",
    "app.tagline": "每一刻，都值得被记住。",
    "upload.title": "添加照片",
    "upload.subtitle": "从相册选择照片",
    "upload.tap": "点击选择照片",
    "upload.process": "开始处理 →",
    "upload.processing": "处理中...",
    "wall.title": "成长墙",
    "wall.highlights": "精彩时刻",
    "wall.all": "全部",
    "wall.add": "+ 添加更多",
    "agent.1": "筛选照片",
    "agent.2": "生成描述",
    "agent.3": "排版设计",
  },
  fr: {
    "app.name": "GrowthBook",
    "app.tagline": "Chaque moment, mémorisé.",
    "upload.title": "Ajouter des photos",
    "upload.subtitle": "Choisissez des photos de votre galerie",
    "upload.tap": "Appuyez pour choisir",
    "upload.process": "Traiter les photos →",
    "upload.processing": "En cours...",
    "wall.title": "Mur des souvenirs",
    "wall.highlights": "Moments forts",
    "wall.all": "Tout",
    "wall.add": "+ Ajouter",
    "agent.1": "Filtrage des photos",
    "agent.2": "Rédaction des légendes",
    "agent.3": "Mise en page",
  },
};

export function t(key: string, lang: Language = "en"): string {
  return strings[lang][key as keyof typeof strings["en"]] || strings.en[key as keyof typeof strings["en"]] || key;
}
