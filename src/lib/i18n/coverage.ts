/**
 * i18n 覆盖率分析（浏览器端）
 * ─────────────────────────────────────────────────────────────
 * 与 scripts/i18n-tracker.cjs 对应的 TypeScript 版本，供应用内
 * 仪表盘实时计算覆盖率。usage 分析（扫描源码）仅在 CLI 做，因为
 * 浏览器无法读取源文件树。
 */
import en from "./en.json";
import el from "./el.json";
import es from "./es.json";
import fr from "./fr.json";
import it from "./it.json";
import ja from "./ja.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";
import zhTw from "./zh-TW.json";

export const LOCALES = ["en", "ru", "pt", "es", "zh", "zh-TW", "ja", "el", "it", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

const DICTS: Record<Locale, unknown> = { en, ru, pt, es, zh, "zh-TW": zhTw, ja, el, it, fr };

export interface Leaf {
  key: string;
  value: unknown;
}

/** 递归取出所有叶子键 */
export function extractLeaves(obj: unknown, prefix = ""): Leaf[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  const out: Leaf[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...extractLeaves(v, full));
    else out.push({ key: full, value: v });
  }
  return out;
}

/** 与英文原文相同且含字母 → 视为未翻译（英文回退） */
function isUntranslated(target: unknown, base: unknown): boolean {
  return target === base && /[a-zA-Z]/.test(String(target));
}

export interface Gap {
  key: string;
  en: string;
  module: string;
}

export interface LocaleCoverage {
  locale: Locale;
  total: number;
  translated: number;
  untranslated: number;
  coverage: number; // 0-100
  gaps: Gap[];
  byModule: Record<string, number>;
}

const enLeaves = extractLeaves(en);
const enMap = new Map(enLeaves.map((l) => [l.key, l.value]));

export function getCoverage(locale: Locale): LocaleCoverage {
  const target = DICTS[locale];
  const tLeaves = extractLeaves(target);
  const tMap = new Map(tLeaves.map((l) => [l.key, l.value]));

  const gaps: Gap[] = [];
  for (const { key, value: base } of enLeaves) {
    const tv = tMap.get(key);
    if (tv === undefined || isUntranslated(tv, base)) {
      gaps.push({ key, en: String(base), module: key.split(".")[0] });
    }
  }

  const byModule: Record<string, number> = {};
  for (const g of gaps) byModule[g.module] = (byModule[g.module] || 0) + 1;

  const total = enLeaves.length;
  const untranslated = gaps.length;
  return {
    locale,
    total,
    translated: total - untranslated,
    untranslated,
    coverage: total ? ((total - untranslated) / total) * 100 : 0,
    gaps,
    byModule,
  };
}

export function getAllCoverage(): LocaleCoverage[] {
  // en 是基准，跳过（覆盖率恒为 ~0）
  return (LOCALES.filter((l) => l !== "en") as Locale[]).map(getCoverage);
}

/** 取某语言某模块的未翻译键 */
export function getModuleGaps(locale: Locale, module: string): Gap[] {
  return getCoverage(locale).gaps.filter((g) => g.module === module || g.key.startsWith(module + "."));
}
