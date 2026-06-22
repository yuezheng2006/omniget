<script lang="ts">
    import type * as Coverage from "$lib/i18n/coverage";

    // 仅开发环境渲染；生产构建里这是个空壳页，不泄露内部信息。
    // 用动态 import + DEV 守卫，确保 coverage.ts 及其 10 个 locale JSON
    // 不会被打进生产 bundle（if(false) 块会被 Vite 整段删除）。
    const DEV = import.meta.env.DEV;

    let api = $state<typeof Coverage | null>(null);
    $effect(() => {
        if (DEV && !api) import("$lib/i18n/coverage").then((m) => (api = m));
    });

    let selected = $state<Coverage.Locale>("zh");
    let activeModule = $state<string | null>(null);

    const all = $derived(api ? api.getAllCoverage() : []);
    const cov = $derived(api ? api.getCoverage(selected) : null);
    const modules = $derived(
        cov
            ? Object.entries(cov.byModule)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => ({ name, count, pct: cov.untranslated ? (count / cov.untranslated) * 100 : 0 }))
            : []
    );
    const moduleGaps = $derived(api && activeModule ? api.getModuleGaps(selected, activeModule) : []);

    // 优先翻译顺序（核心交互在前，study 体量大靠后）
    const PRIORITY = ["omnibox", "downloads", "home", "nav", "common", "errors", "settings"];
    const priorityRank = (m: string) => {
        const i = PRIORITY.indexOf(m);
        return i === -1 ? 100 : i;
    };
    const nextModule = $derived(
        [...modules].sort((a, b) => priorityRank(a.name) - priorityRank(b.name))[0]
    );

    const statusColor = (c: number): string =>
        c >= 90 ? "var(--success, #2ecc71)" : c >= 70 ? "var(--accent)" : c >= 50 ? "var(--warning, #f5a623)" : "var(--error, #e74c3c)";
</script>

<svelte:head><title>i18n 翻译跟踪 · Dev</title></svelte:head>

{#if !DEV}
    <div class="denied">
        <p>此页面仅在开发模式下可用。</p>
    </div>
{:else}
    <div class="wrap">
        <header class="head">
            <h1>i18n 翻译跟踪</h1>
            <p class="sub">实时覆盖率 · 模块分解 · 优先级建议。CLI: <code>pnpm i18n:status</code> / <code>i18n:usage</code></p>
        </header>

        <!-- 所有语言一览 -->
        <section class="card">
            <h2>所有语言</h2>
            <div class="locale-grid">
                {#each all as l (l.locale)}
                    <button
                        class="locale-row"
                        class:active={selected === l.locale}
                        onclick={() => { selected = l.locale; activeModule = null; }}
                    >
                        <span class="locale-code">{l.locale}</span>
                        <span class="locale-bar">
                            <span class="locale-bar-fill" style="width:{l.coverage}%; background:{statusColor(l.coverage)}"></span>
                        </span>
                        <span class="locale-pct" style="color:{statusColor(l.coverage)}">{l.coverage.toFixed(1)}%</span>
                        <span class="locale-count">{l.translated}/{l.total}</span>
                    </button>
                {/each}
            </div>
        </section>

        <!-- 选中语言详情 -->
        <section class="card">
            <div class="card-head">
                <h2>{selected} · 模块分解</h2>
                {#if cov}
                    <span class="big-pct" style="color:{statusColor(cov.coverage)}">{cov.coverage.toFixed(2)}%</span>
                {/if}
            </div>
            {#if cov}
                <p class="muted">已翻译 {cov.translated}/{cov.total} · 待翻译 {cov.untranslated}</p>
            {/if}

            {#if nextModule && nextModule.count > 0}
                <div class="suggest">
                    💡 建议接下来：<strong>{nextModule.name}</strong>（{nextModule.count} 个待翻译）
                    <button class="link-btn" onclick={() => (activeModule = nextModule.name)}>查看 →</button>
                </div>
            {/if}

            <div class="module-list">
                {#each modules as m (m.name)}
                    <button
                        class="module-row"
                        class:active={activeModule === m.name}
                        onclick={() => (activeModule = activeModule === m.name ? null : m.name)}
                    >
                        <span class="module-name">{m.name}</span>
                        <span class="module-bar"><span class="module-bar-fill" style="width:{m.pct}%"></span></span>
                        <span class="module-count">{m.count}</span>
                        <span class="module-pct">{m.pct.toFixed(0)}%</span>
                    </button>
                {/each}
                {#if modules.length === 0}
                    <p class="done">✅ 全部翻译完成！</p>
                {/if}
            </div>
        </section>

        <!-- 模块具体待翻译键 -->
        {#if activeModule}
            <section class="card">
                <div class="card-head">
                    <h2>{selected} / {activeModule}</h2>
                    <span class="muted">{moduleGaps.length} 个</span>
                </div>
                <div class="keys">
                    {#each moduleGaps.slice(0, 60) as g (g.key)}
                        <div class="key-row">
                            <code class="key-path">{g.key}</code>
                            <span class="key-en">{g.en}</span>
                        </div>
                    {/each}
                    {#if moduleGaps.length > 60}
                        <p class="muted">… 还有 {moduleGaps.length - 60} 个，用 <code>pnpm i18n:focus {selected} {activeModule}</code> 查看全部</p>
                    {/if}
                </div>
            </section>
        {/if}

        <footer class="foot muted">
            {#if cov}总键数 {cov.total} · {/if}基准语言 en · 趋势分析见 <code>pnpm i18n:history</code> · 死键/缺键分析见 <code>pnpm i18n:usage</code>
        </footer>
    </div>
{/if}

<style>
    .denied {
        padding: var(--padding);
        color: var(--text-muted);
    }
    .wrap {
        max-width: 760px;
        margin: 0 auto;
        padding: calc(var(--padding) * 2);
        display: flex;
        flex-direction: column;
        gap: calc(var(--padding) * 1.5);
    }
    .head h1 {
        font-size: var(--text-2xl);
        font-weight: 600;
        margin: 0;
    }
    .head .sub {
        color: var(--text-muted);
        font-size: var(--text-sm);
        margin: 4px 0 0;
    }
    .card {
        background: var(--primary);
        border: 1px solid var(--content-border);
        border-radius: var(--border-radius);
        padding: calc(var(--padding) * 1.5);
        display: flex;
        flex-direction: column;
        gap: var(--padding);
    }
    .card h2 {
        font-size: var(--text-md);
        font-weight: 600;
        margin: 0;
    }
    .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
    }
    .big-pct {
        font-size: var(--text-xl);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
    .muted {
        color: var(--text-muted);
        font-size: var(--text-sm);
    }
    .done {
        color: var(--success, #2ecc71);
    }
    code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        background: var(--accent-soft);
        padding: 1px 5px;
        border-radius: 4px;
    }

    .locale-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .locale-row {
        display: grid;
        grid-template-columns: 48px 1fr 56px 70px;
        align-items: center;
        gap: var(--padding);
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--secondary);
        font: inherit;
    }
    .locale-row:hover {
        background: var(--accent-soft);
    }
    .locale-row.active {
        border-color: var(--accent);
        background: var(--accent-soft);
    }
    .locale-code {
        font-weight: 600;
        font-size: var(--text-sm);
    }
    .locale-bar {
        height: 8px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--secondary) 12%, transparent);
        overflow: hidden;
    }
    .locale-bar-fill {
        display: block;
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s;
    }
    .locale-pct {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        font-size: var(--text-sm);
        text-align: right;
    }
    .locale-count {
        font-size: var(--text-xs);
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
        text-align: right;
    }

    .suggest {
        font-size: var(--text-sm);
        padding: 8px 10px;
        background: var(--accent-soft);
        border-radius: 8px;
    }
    .link-btn {
        background: none;
        border: none;
        color: var(--accent);
        cursor: pointer;
        font: inherit;
        padding: 0 0 0 4px;
    }
    .module-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .module-row {
        display: grid;
        grid-template-columns: 140px 1fr 40px 44px;
        align-items: center;
        gap: var(--padding);
        padding: 7px 10px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        text-align: left;
        color: var(--secondary);
        font: inherit;
    }
    .module-row:hover {
        background: var(--accent-soft);
    }
    .module-row.active {
        border-color: var(--accent);
    }
    .module-name {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
    }
    .module-bar {
        height: 6px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--secondary) 12%, transparent);
        overflow: hidden;
    }
    .module-bar-fill {
        display: block;
        height: 100%;
        background: var(--accent);
        border-radius: 3px;
    }
    .module-count {
        font-variant-numeric: tabular-nums;
        font-size: var(--text-sm);
        text-align: right;
    }
    .module-pct {
        font-size: var(--text-xs);
        color: var(--text-muted);
        text-align: right;
    }

    .keys {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .key-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--padding);
        padding: 6px 10px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--secondary) 5%, transparent);
        align-items: baseline;
    }
    .key-path {
        background: none;
        padding: 0;
        color: var(--accent);
        word-break: break-all;
    }
    .key-en {
        color: var(--text-muted);
        font-size: var(--text-xs);
        word-break: break-word;
    }

    .foot {
        text-align: center;
        font-size: var(--text-xs);
    }
</style>
