#!/usr/bin/env node

/**
 * OmniGet i18n Tracker
 * ─────────────────────────────────────────────────────────────
 * 一个完整的翻译跟踪工具。覆盖现有 generate-i18n-keys.js 不做的部分：
 *   - 翻译完成度（哪些键还是英文回退）
 *   - 覆盖率历史趋势（每次 snapshot 记一笔，看 ▲▼）
 *   - 代码使用分析（代码里用了但 locale 没有的 = bug；locale 有但代码没用 = 死键）
 *   - 按模块分解、优先级建议、可导出的待办清单
 *
 * 用法:
 *   node scripts/i18n-tracker.cjs status              # 一眼看完 + 趋势
 *   node scripts/i18n-tracker.cjs report zh           # 某语言按模块详报
 *   node scripts/i18n-tracker.cjs missing zh          # 列出未翻译键（可 --format json/csv）
 *   node scripts/i18n-tracker.cjs focus zh study      # 聚焦某模块的未翻译键
 *   node scripts/i18n-tracker.cjs usage               # 代码使用 vs locale（找 bug + 死键）
 *   node scripts/i18n-tracker.cjs next zh             # 建议接下来翻译什么
 *   node scripts/i18n-tracker.cjs snapshot            # 保存当前覆盖率快照
 *   node scripts/i18n-tracker.cjs history             # 覆盖率趋势
 *
 * 互补关系：
 *   generate-i18n-keys.js → 结构同步（所有 locale 键集合一致）
 *   i18n-tracker.cjs      → 完成度 + 历史 + 使用分析（这个文件）
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const I18N_DIR = path.join(ROOT, "src", "lib", "i18n");
const SRC_DIR = path.join(ROOT, "src");
const BASE_LANG = "en";
const HISTORY_FILE = path.join(ROOT, ".i18n-cache", "history.json");

// ── 颜色 ──────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
  gray: "\x1b[90m",
};
const color = (s, c) => process.stdout.isTTY ? `${C[c]}${s}${C.reset}` : s;

// ── 核心数据层 ─────────────────────────────────────────────────

/** 递归取出对象所有叶子键（点号路径） */
function extractKeys(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...extractKeys(v, full));
    } else {
      out.push({ key: full, value: v });
    }
  }
  return out;
}

function loadLocale(lang) {
  const p = path.join(I18N_DIR, `${lang}.json`);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function listLocales() {
  return fs
    .readdirSync(I18N_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

/** 一个键算不算"未翻译"：和英文原文相同且含字母 → 还是英文回退 */
function isUntranslated(targetVal, baseVal) {
  return targetVal === baseVal && /[a-zA-Z]/.test(String(targetVal));
}

/**
 * 扫描 src/ 下所有源码，提取实际被引用的翻译键。
 * 匹配 $t('...') / t('...') / $t("...")，忽略插值（含 ${} 的不算字面量）。
 */
function extractUsedKeys() {
  const used = new Set();
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(svelte|ts|js)$/.test(entry.name)) files.push(full);
    }
  };
  walk(SRC_DIR);

  // 同时捕获 $t('x') 和裸 t('x')，单/双引号
  const re = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, "utf-8"); } catch { continue; }
    let m;
    while ((m = re.exec(src)) !== null) used.add(m[1]);
  }
  return used;
}

/** 计算某语言的全量分析结果 */
function analyze(lang) {
  const base = loadLocale(BASE_LANG);
  const target = loadLocale(lang);
  const baseKeys = extractKeys(base);
  const tMap = new Map(extractKeys(target).map((k) => [k.key, k.value]));

  const untranslated = [];
  for (const { key, value: b } of baseKeys) {
    const t = tMap.get(key);
    if (t === undefined || isUntranslated(t, b)) untranslated.push({ key, en: b });
  }
  const total = baseKeys.length;
  const translated = total - untranslated.length;
  const byModule = {};
  for (const u of untranslated) {
    const mod = u.key.split(".")[0];
    (byModule[mod] ||= []).push(u);
  }
  return {
    lang, total, translated, untranslated: untranslated.length,
    coverage: (translated / total) * 100,
    untranslatedKeys: untranslated,
    byModule,
  };
}

// ── 历史快照 ────────────────────────────────────────────────────

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8")); }
  catch { return []; }
}

function saveSnapshot(label) {
  const history = loadHistory();
  const locales = listLocales().filter((l) => l !== BASE_LANG);
  const snapshot = {
    timestamp: new Date().toISOString(),
    label: label || "manual",
    commit: safeGitCommit(),
    locales: {},
  };
  for (const lang of locales) snapshot.locales[lang] = analyze(lang).coverage;
  history.push(snapshot);
  // 只保留最近 200 条，避免无限增长
  const trimmed = history.slice(-200);
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2) + "\n");
  return snapshot;
}

function safeGitCommit() {
  try { return execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); }
  catch { return null; }
}

/** 计算某语言相对上一次快照的覆盖率变化 */
function trend(lang) {
  const h = loadHistory();
  if (h.length < 2) return null;
  const recent = h.filter((s) => s.locales[lang] !== undefined).slice(-2);
  if (recent.length < 2) return null;
  return recent[1].locales[lang] - recent[0].locales[lang];
}

// ── 渲染辅助 ────────────────────────────────────────────────────

const bar = (pct, width = 24) => {
  const filled = Math.round((pct / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}] ${pct.toFixed(1)}%`;
};

const statusIcon = (cov) =>
  cov >= 90 ? color("●", "green") : cov >= 70 ? color("●", "cyan") :
  cov >= 50 ? color("●", "yellow") : color("●", "red");

const trendStr = (delta) => {
  if (delta === null || delta === undefined) return color("  —", "gray");
  if (Math.abs(delta) < 0.05) return color("  →", "gray");
  return delta > 0 ? color(`▲${delta.toFixed(2)}`, "green") : color(`▼${Math.abs(delta).toFixed(2)}`, "red");
};

// ── 子命令 ──────────────────────────────────────────────────────

function cmdStatus() {
  const locales = listLocales();
  const base = loadLocale(BASE_LANG);
  const total = extractKeys(base).length;

  console.log(color("\n  OmniGet i18n 翻译跟踪", "bold"));
  console.log(color(`  ${"─".repeat(56)}`, "gray"));
  console.log(color(`  基准语言: ${BASE_LANG}  ·  总键数: ${total}  ·  语言数: ${locales.length}`, "dim"));

  const results = locales.filter((l) => l !== BASE_LANG).map(analyze);
  results.sort((a, b) => b.coverage - a.coverage);

  console.log(color(`\n  ${"语言".padEnd(8)} ${"覆盖率".padEnd(34)} ${"趋势".padEnd(10)} 已翻译/总数`, "dim"));
  console.log(color(`  ${"─".repeat(70)}`, "gray"));
  for (const r of results) {
    const t = trend(r.lang);
    console.log(
      `  ${statusIcon(r.coverage)} ${r.lang.padEnd(6)} ${bar(r.coverage, 20)}  ${trendStr(t).padEnd(12)} ${r.translated}/${r.total}`
    );
  }

  // 最需要关注的模块（跨语言聚合）
  const moduleGaps = {};
  for (const r of results) {
    for (const [mod, keys] of Object.entries(r.byModule)) {
      moduleGaps[mod] = (moduleGaps[mod] || 0) + keys.length;
    }
  }
  const worst = Object.entries(moduleGaps).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (worst.length) {
    console.log(color(`\n  缺口最大的模块（所有语言未翻译键之和）`, "dim"));
    for (const [mod, n] of worst) {
      console.log(`     ${mod.padEnd(16)} ${color(String(n).padStart(5), "yellow")} 个`);
    }
  }

  console.log(color(`\n  提示: `, "dim") +
    color(`report <lang>`, "cyan") + color(" 详报  · ", "dim") +
    color(`usage`, "cyan") + color(" 代码使用分析  · ", "dim") +
    color(`snapshot`, "cyan") + color(" 记录趋势\n", "dim"));
}

function cmdReport(lang) {
  const r = analyze(lang);
  console.log(color(`\n  ${lang} 详细报告`, "bold"));
  console.log(color(`  ${"─".repeat(56)}`, "gray"));
  console.log(`  ${bar(r.coverage, 30)}`);
  console.log(color(`  已翻译 ${r.translated}/${r.total}  ·  未翻译 ${r.untranslated}\n`, "dim"));

  const modules = Object.entries(r.byModule).sort((a, b) => b[1].length - a[1].length);
  if (!modules.length) { console.log(color("  ✅ 全部翻译完成！\n", "green")); return; }

  console.log(color(`  ${"模块".padEnd(20)} ${"未翻译".padStart(6)}  占比`, "dim"));
  console.log(color(`  ${"─".repeat(46)}`, "gray"));
  for (const [mod, keys] of modules) {
    const pct = ((keys.length / r.untranslated) * 100).toFixed(0);
    console.log(`  ${mod.padEnd(20)} ${String(keys.length).padStart(6)}  ${color(pct + "%", "yellow")}`);
  }
  console.log(color(`\n  用 `, "dim") + color(`focus ${lang} <module>`, "cyan") +
    color(" 查看某模块的具体待翻译键\n", "dim"));
}

function cmdMissing(lang, opts = {}) {
  const r = analyze(lang);
  if (opts.format === "json") {
    process.stdout.write(JSON.stringify({
      lang, total: r.total, untranslated: r.untranslated,
      keys: r.untranslatedKeys.map((k) => ({ key: k.key, en: k.en })),
    }, null, 2));
    return;
  }
  if (opts.format === "csv") {
    console.log("key,en");
    for (const k of r.untranslatedKeys) console.log(`${k.key},"${String(k.en).replace(/"/g, '""')}"`);
    return;
  }
  console.log(color(`\n  ${lang} 未翻译键（${r.untranslated} 个）\n`, "bold"));
  r.untranslatedKeys.slice(0, 50).forEach((k) =>
    console.log(`  ${color(k.key, "cyan")}  ${color(String(k.en).slice(0, 50), "dim")}`));
  if (r.untranslatedKeys.length > 50)
    console.log(color(`\n  … 还有 ${r.untranslatedKeys.length - 50} 个`, "dim"));
  console.log(color(`\n  导出: `, "dim") + color(`missing ${lang} --format json|csv`, "cyan") + color("\n", "dim"));
}

function cmdFocus(lang, module) {
  const r = analyze(lang);
  const keys = r.byModule[module];
  if (!keys) { console.log(color(`  模块 "${module}" 没有未翻译键，或不存在。`, "yellow")); return; }
  console.log(color(`\n  ${lang} · ${module}（${keys.length} 个待翻译）\n`, "bold"));
  for (const k of keys) {
    console.log(`  ${color(k.key, "cyan")}`);
    console.log(color(`    EN: ${k.en}`, "dim"));
  }
  console.log("");
}

function cmdUsage() {
  const used = extractUsedKeys();
  const base = loadLocale(BASE_LANG);
  const defined = new Set(extractKeys(base).map((k) => k.key));

  const usedNotDefined = [...used].filter((k) => !defined.has(k)).sort();   // 代码用了但 locale 没有 → bug
  const orphaned = [...defined].filter((k) => !used.has(k)).sort();        // locale 有但代码没用 → 死键

  console.log(color("\n  代码使用分析", "bold"));
  console.log(color(`  ${"─".repeat(56)}`, "gray"));
  console.log(color(`  代码中引用的键: ${used.size}  ·  en.json 定义的键: ${defined.size}\n`, "dim"));

  console.log(color(`  ❌ 代码引用但 locale 缺失（潜在 bug，${usedNotDefined.length} 个）`, "red"));
  if (!usedNotDefined.length) console.log(color("     ✅ 无\n", "green"));
  else {
    usedNotDefined.slice(0, 30).forEach((k) => console.log(`     ${k}`));
    if (usedNotDefined.length > 30) console.log(color(`     … 还有 ${usedNotDefined.length - 30} 个`, "dim"));
    console.log(color(`     → 这些可能是拼写错误或忘了加进 en.json，或动态拼接的键\n`, "dim"));
  }

  console.log(color(`  🧹 en.json 有但代码从未引用（候选死键，${orphaned.length} 个）`, "yellow"));
  if (!orphaned.length) console.log(color("     ✅ 无\n", "green"));
  else {
    // 按模块分组显示
    const byMod = {};
    orphaned.forEach((k) => (byMod[k.split(".")[0]] ||= []).push(k));
    Object.entries(byMod).sort((a, b) => b[1].length - a[1].length).forEach(([mod, ks]) => {
      console.log(`     ${mod} (${ks.length})`);
    });
    console.log(color(`     → 清理它们可减小 locale 体积；先确认非动态键\n`, "dim"));
  }
}

function cmdNext(lang) {
  const r = analyze(lang);
  if (!r.untranslated) { console.log(color("  ✅ 全部完成！\n", "green")); return; }
  // 优先级：非 study 模块优先（study 体量大但属于高级功能），其次按模块大小
  const priority = ["omnibox", "downloads", "settings", "home", "nav", "common", "errors"];
  const order = (mod) => {
    const i = priority.indexOf(mod);
    return i === -1 ? 100 + mod.length : i;
  };
  const modules = Object.entries(r.byModule).sort((a, b) => order(a[0]) - order(b[0]));
  const [mod, keys] = modules[0];
  console.log(color(`\n  接下来建议翻译：${lang} / ${mod}`, "bold"));
  console.log(color(`  ${"─".repeat(56)}`, "gray"));
  console.log(color(`  ${keys.length} 个键，按优先级排序的最高项。\n`, "dim"));
  keys.slice(0, 15).forEach((k) => {
    console.log(`  ${color(k.key, "cyan")}`);
    console.log(color(`    EN: ${k.en}`, "dim"));
  });
  console.log(color(`\n  用 `, "dim") + color(`focus ${lang} ${mod}`, "cyan") +
    color(" 查看全部\n", "dim"));
}

function cmdSnapshot(label) {
  const snap = saveSnapshot(label);
  console.log(color("\n  ✅ 快照已保存", "green"));
  console.log(color(`  ${"─".repeat(56)}`, "gray"));
  console.log(`  ${color("时间:", "dim")} ${snap.timestamp}`);
  if (snap.commit) console.log(`  ${color("提交:", "dim")} ${snap.commit}`);
  console.log(color(`  ${"语言覆盖率:"}`, "dim"));
  for (const [lang, cov] of Object.entries(snap.locales).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${lang.padEnd(6)} ${cov.toFixed(2)}%`);
  }
  console.log(color(`\n  存于 .i18n-cache/history.json，趋势会在 status / history 中体现\n`, "dim"));
}

function cmdHistory() {
  const h = loadHistory();
  if (!h.length) { console.log(color("  还没有快照。先运行 ", "yellow") + color("snapshot", "cyan")); return; }
  console.log(color("\n  覆盖率历史趋势", "bold"));
  console.log(color(`  ${"─".repeat(56)}`, "gray"));
  const locales = listLocales().filter((l) => l !== BASE_LANG);
  console.log(color(`  ${"时间".padEnd(20)} ${locales.map((l) => l.padEnd(9)).join("")}`, "dim"));
  console.log(color(`  ${"─".repeat(60)}`, "gray"));
  for (const s of h.slice(-20)) {
    const d = s.timestamp.slice(0, 19).replace("T", " ");
    const cells = locales.map((l) => {
      const v = s.locales[l];
      return v === undefined ? "       —" : v.toFixed(1).padStart(7) + "%";
    });
    console.log(`  ${d}  ${cells.join("  ")}`);
  }
  if (h.length > 20) console.log(color(`  … 共 ${h.length} 条，显示最近 20 条`, "dim"));
  console.log("");
}

// ── 入口 ────────────────────────────────────────────────────────

function help() {
  console.log(color("\n  OmniGet i18n Tracker\n", "bold") +
    color("  跟踪翻译完成度、历史趋势、代码使用情况\n\n", "dim") +
    color("  用法:\n", "bold") +
    "    status                一眼看完所有语言覆盖率 + 趋势\n" +
    "    report <lang>         某语言按模块的详细报告\n" +
    "    missing <lang>        列出未翻译键（--format json|csv 可导出）\n" +
    "    focus <lang> <module> 聚焦某模块的待翻译键\n" +
    "    next <lang>           建议接下来翻译什么（按优先级）\n" +
    "    usage                 代码引用 vs locale 定义（找 bug + 死键）\n" +
    "    snapshot [label]      保存当前覆盖率快照（记录趋势用）\n" +
    "    history               查看覆盖率历史趋势\n\n" +
    color("  示例:\n", "bold") +
    color("    node scripts/i18n-tracker.cjs status\n", "dim") +
    color("    node scripts/i18n-tracker.cjs focus zh study.music\n", "dim") +
    color("    node scripts/i18n-tracker.cjs missing zh --format json > todo.json\n", "dim") +
    color("    pnpm i18n:status\n\n", "dim"));
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) opts[rest[i].slice(2)] = rest[i + 1];
  }
  const positional = rest.filter((a) => !a.startsWith("--"));

  try {
    switch (cmd) {
      case undefined:
      case "status": cmdStatus(); break;
      case "report": cmdReport(positional[0]); break;
      case "missing": cmdMissing(positional[0], opts); break;
      case "focus": cmdFocus(positional[0], positional.slice(1).join(".")); break;
      case "next": cmdNext(positional[0]); break;
      case "usage": cmdUsage(); break;
      case "snapshot": cmdSnapshot(positional[0]); break;
      case "history": cmdHistory(); break;
      case "help":
      case "--help":
      case "-h": help(); break;
      default:
        console.log(color(`未知命令: ${cmd}\n`, "red"));
        help();
        process.exit(1);
    }
  } catch (e) {
    console.error(color(`\n❌ ${e.message}`, "red"));
    process.exit(1);
  }
}

main();
