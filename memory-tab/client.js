/**
 * Browser half of the Memory tab (`@local/dsh-memory`).
 *
 * Registers two surfaces:
 *   - a `conversation.view` entry beside Chat and Trajectory, reading the Host
 *     half's `/api/memory.*` routes (scoped file tree, one Markdown body, BM25
 *     search, and the MiMoCode import offer);
 *   - a `settings.section` page that edits `memory/settings.json` through the
 *     same authenticated channel.
 *
 * Styling uses only `--dsw-alias-*` theme tokens so light and dark themes and
 * the host's font size follow without extra work.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-memory',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const NS = 'memory.tab';
    const STYLE_KEY = 'dsh-memory-tab';

    const en = {
      nav: 'Memory',
      title: 'Memory',
      search: 'Search memory',
      searchAction: 'Search',
      clear: 'Clear',
      refresh: 'Refresh',
      loading: 'Loading memory…',
      error: 'Could not read memory',
      retry: 'Retry',
      emptyTitle: 'No memory yet',
      emptyBody:
        'Memory is plain Markdown under {root}. Ask the agent to remember something, or write MEMORY.md there yourself.',
      select: 'Select a memory file.',
      noResults: 'No matches for “{query}”.',
      results: '{n} matches',
      files: '{n} files',
      scopeProject: 'Project',
      scopeSession: 'Session',
      scopeGlobal: 'Global',
      typeMemory: 'MEMORY',
      typeCheckpoint: 'CHECKPOINT',
      typeNotes: 'NOTES',
      typeProgress: 'PROGRESS',
      typeFree: 'NOTE',
      updated: 'updated {time}',
      snippet: 'Read the file for the full entry.',
      thisSession: 'this session',
      importTitle: 'MiMoCode memory found',
      importBody: 'This workspace is an existing MiMoCode project with {size} of memory. Import it into the Harness store?',
      importAction: 'Import',
      importing: 'Importing…',
      importDone: 'Imported MiMoCode memory.',
      importNothing: 'Nothing to import.',
      importFailed: 'Import failed',
      importedNote: 'Imported from MiMoCode · {date}',
      disabledNote: 'Memory is off. Enable it in Settings → Memory.',
      settingsNav: 'Memory',
      settingsTitle: 'Memory',
      settingsIntro:
        'Persistent Markdown memory is shared by the agent tools and the Memory tab. These controls decide what reaches the model and how much.',
      enabled: 'Enable memory',
      enabledDesc: 'Turn the whole system off, including the prompt section and both tools.',
      injectProject: 'Project memory in the prompt',
      injectProjectDesc: 'Show this workspace’s MEMORY.md to the model on every request.',
      injectGlobal: 'Global memory in the prompt',
      injectGlobalDesc: 'Show cross-project user preferences (global MEMORY.md).',
      injectSessionNotes: 'Session notes in the prompt',
      injectSessionNotesDesc: 'Show this session’s notes.md scratchpad.',
      showHint: 'Usage instructions',
      showHintDesc: 'Tell the model how to recall and record memory, even when no file exists yet.',
      autoImport: 'Auto-import MiMoCode memory',
      autoImportDesc: 'On the first session in an existing MiMoCode project, copy its memory without asking.',
      maxChars: 'Prompt budget',
      maxCharsDesc: 'Maximum characters of memory text injected per request.',
      searchLimit: 'Search results',
      searchLimitDesc: 'Default number of memory_search results.',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      saveFailed: 'Could not save settings.',
      settingsLoading: 'Loading settings…',
      mimoTitle: 'MiMoCode memory',
      mimoIntro:
        'Memory found in your MiMoCode install. Importing copies it into this store once; it does not link or keep syncing.',
      mimoGlobal: 'Global memory',
      mimoGlobalDesc: 'Cross-project preferences from MiMoCode (global MEMORY.md).',
      mimoImport: 'Import',
      mimoImported: 'Imported',
      mimoImporting: 'Importing…',
      mimoNone: 'No MiMoCode project memory found on this machine.',
      mimoUnsupported: 'MiMoCode database not readable: {reason}',
      mimoRefresh: 'Refresh list',
      mimoDone: 'Imported {name}.',
      wsTitle: 'Workspaces',
      wsIntro: 'Every Harness workspace. Import appears where MiMoCode memory was found for that workspace.',
      wsNone: 'No MiMoCode memory',
      wsNoWorkspaces: 'No workspaces yet.',
      mimoOthers: 'Other MiMoCode projects',
      mimoHint: 'Import memory from other projects in Settings → Memory.',
    };

    const zh = {
      nav: '记忆',
      title: '记忆',
      search: '搜索记忆',
      searchAction: '搜索',
      clear: '清除',
      refresh: '刷新',
      loading: '正在读取记忆…',
      error: '无法读取记忆',
      retry: '重试',
      emptyTitle: '还没有记忆',
      emptyBody: '记忆是 {root} 下的纯 Markdown 文件。让智能体记住某事，或自己写入 MEMORY.md。',
      select: '选择一条记忆文件。',
      noResults: '没有匹配“{query}”的内容。',
      results: '{n} 条结果',
      files: '{n} 个文件',
      scopeProject: '项目',
      scopeSession: '会话',
      scopeGlobal: '全局',
      typeMemory: '记忆',
      typeCheckpoint: '检查点',
      typeNotes: '笔记',
      typeProgress: '进度',
      typeFree: '笔记',
      updated: '更新于 {time}',
      snippet: '打开文件查看完整内容。',
      thisSession: '当前会话',
      importTitle: '发现 MiMoCode 记忆',
      importBody: '该工作区是已有的 MiMoCode 项目，包含 {size} 记忆。要导入到 Harness 记忆库吗？',
      importAction: '导入',
      importing: '正在导入…',
      importDone: '已导入 MiMoCode 记忆。',
      importNothing: '没有可导入的内容。',
      importFailed: '导入失败',
      importedNote: '导入自 MiMoCode · {date}',
      disabledNote: '记忆已关闭。请在“设置 → 记忆”中开启。',
      settingsNav: '记忆',
      settingsTitle: '记忆',
      settingsIntro: '持久 Markdown 记忆由智能体工具与“记忆”标签页共用。以下选项决定哪些内容进入模型上下文以及进入多少。',
      enabled: '启用记忆',
      enabledDesc: '关闭整个系统，包括提示词区段和两个工具。',
      injectProject: '提示词中包含项目记忆',
      injectProjectDesc: '每次请求都把本工作区的 MEMORY.md 提供给模型。',
      injectGlobal: '提示词中包含全局记忆',
      injectGlobalDesc: '提供跨项目用户偏好（全局 MEMORY.md）。',
      injectSessionNotes: '提示词中包含会话笔记',
      injectSessionNotesDesc: '提供当前会话的 notes.md 草稿。',
      showHint: '使用说明',
      showHintDesc: '即使还没有文件，也告诉模型如何回忆和记录记忆。',
      autoImport: '自动导入 MiMoCode 记忆',
      autoImportDesc: '在已有 MiMoCode 项目中首次开会话时，直接复制其记忆而不询问。',
      maxChars: '提示词预算',
      maxCharsDesc: '每次请求注入的记忆文本最大字符数。',
      searchLimit: '搜索结果数',
      searchLimitDesc: 'memory_search 默认返回的结果条数。',
      save: '保存',
      saving: '正在保存…',
      saved: '已保存',
      saveFailed: '无法保存设置。',
      settingsLoading: '正在读取设置…',
      mimoTitle: 'MiMoCode 记忆',
      mimoIntro: '在 MiMoCode 安装目录中找到的记忆。导入是一次性复制，不会建立链接或持续同步。',
      mimoGlobal: '全局记忆',
      mimoGlobalDesc: '来自 MiMoCode 的跨项目偏好（全局 MEMORY.md）。',
      mimoImport: '导入',
      mimoImported: '已导入',
      mimoImporting: '正在导入…',
      mimoNone: '本机没有找到 MiMoCode 项目记忆。',
      mimoUnsupported: '无法读取 MiMoCode 数据库：{reason}',
      mimoRefresh: '刷新列表',
      mimoDone: '已导入 {name}。',
      wsTitle: '工作区',
      wsIntro: '所有 Harness 工作区。若在该工作区找到 MiMoCode 记忆，会显示导入按钮。',
      wsNone: '没有 MiMoCode 记忆',
      wsNoWorkspaces: '还没有工作区。',
      mimoOthers: '其他 MiMoCode 项目',
      mimoHint: '在“设置 → 记忆”中导入其他项目的记忆。',
    };

    let translate = (key) => key;

    const css = `
.dshmem-root{display:flex;flex-direction:column;height:100%;flex:1 1 auto;min-height:0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dshmem-bar{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto;min-height:44px;box-sizing:border-box}
.dshmem-title{font-size:13px;font-weight:600;letter-spacing:.01em;white-space:nowrap}
.dshmem-count{font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
.dshmem-search{margin-left:auto;display:flex;align-items:center;gap:6px;min-width:0}
.dshmem-input{height:28px;width:220px;max-width:32vw;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none;box-sizing:border-box}
.dshmem-input::placeholder{color:var(--dsw-alias-label-secondary)}
.dshmem-input:focus{border-color:var(--dsw-alias-brand-primary)}
.dshmem-btn{height:28px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.dshmem-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.dshmem-btn:disabled{opacity:.5;cursor:default}
.dshmem-body{display:flex;flex:1;min-height:0}
.dshmem-nav{width:236px;flex:0 0 236px;border-right:1px solid var(--dsw-alias-border-l1);overflow:auto;padding:6px 0 16px}
.dshmem-group{display:flex;align-items:baseline;gap:6px;padding:12px 12px 4px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--dsw-alias-label-secondary)}
.dshmem-group-detail{margin-left:auto;font-size:10px;text-transform:none;letter-spacing:0;opacity:.8;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:right}
.dshmem-group-empty{padding:2px 12px 4px;font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.7}
.dshmem-imported{padding:0 12px 4px;font-size:10px;color:var(--dsw-alias-label-secondary)}
.dshmem-file{display:flex;align-items:baseline;gap:8px;width:100%;padding:5px 12px;border:0;background:none;text-align:left;font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);cursor:pointer}
.dshmem-file:hover{background:var(--dsw-alias-bg-layer-2)}
.dshmem-file[data-active="true"]{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.dshmem-file-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshmem-badge{margin-left:auto;font-size:9px;letter-spacing:.04em;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 4px;line-height:14px;flex:0 0 auto}
.dshmem-main{flex:1;min-width:0;overflow:auto;padding:18px 28px 40px}
.dshmem-dochead{display:flex;align-items:baseline;gap:10px;padding-bottom:10px;margin-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dshmem-path{font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}
.dshmem-stamp{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.dshmem-h{font-weight:600;margin:18px 0 8px}
.dshmem-h1{font-size:18px;line-height:26px;margin-top:0}
.dshmem-h2{font-size:15px;line-height:23px}
.dshmem-h3{font-size:13px;line-height:21px}
.dshmem-h4{font-size:13px;line-height:21px;color:var(--dsw-alias-label-secondary)}
.dshmem-p{margin:0 0 10px}
.dshmem-list{margin:0 0 10px;padding-left:20px}
.dshmem-list li{margin:2px 0}
.dshmem-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 4px}
.dshmem-pre{margin:0 0 12px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:18px}
.dshmem-hit{display:block;width:100%;text-align:left;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px;margin:0 0 8px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer}
.dshmem-hit:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.dshmem-hit-head{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}
.dshmem-hit-path{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshmem-hit-score{margin-left:auto;font-size:10px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dshmem-hit-snippet{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dshmem-empty{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:36px 8px;max-width:560px}
.dshmem-empty-title{font-size:14px;font-weight:600}
.dshmem-empty-body{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
.dshmem-error{color:var(--dsw-alias-state-error-primary);font-size:12px}
.dshmem-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.dshmem-banner{display:flex;align-items:center;gap:10px;margin:12px 16px 0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.dshmem-banner-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.dshmem-banner-title{font-size:12px;font-weight:600}
.dshmem-banner-text{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dshmem-banner-action{margin-left:auto;flex:0 0 auto}
.dshmem-off{padding:6px 16px;font-size:11px;color:var(--dsw-alias-state-warn-primary);border-bottom:1px solid var(--dsw-alias-border-l1)}
.dshmem-settings{padding:20px 24px 40px;max-width:720px;overflow:auto;height:100%;box-sizing:border-box}
.dshmem-settings-title{font-size:15px;font-weight:600;margin:0 0 6px}
.dshmem-settings-intro{font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary);margin:0 0 18px}
.dshmem-row{display:flex;align-items:flex-start;gap:16px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dshmem-row-main{min-width:0;flex:1}
.dshmem-row-label{font-size:13px;line-height:20px}
.dshmem-row-desc{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.dshmem-row-control{flex:0 0 auto;padding-top:2px}
.dshmem-switch{width:34px;height:20px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);padding:0;cursor:pointer;position:relative;transition:background .12s ease}
.dshmem-switch[data-on="true"]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dshmem-switch-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);transition:transform .12s ease;display:block}
.dshmem-switch[data-on="true"] .dshmem-switch-knob{transform:translateX(14px);background:#fff}
.dshmem-num{width:96px;height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none;box-sizing:border-box}
.dshmem-num:focus{border-color:var(--dsw-alias-brand-primary)}
.dshmem-actions{display:flex;align-items:center;gap:12px;margin-top:16px}
.dshmem-saved{font-size:12px;color:var(--dsw-alias-state-success-primary)}
.dshmem-settings-sub2{margin:20px 0 2px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.05em}
.dshmem-settings-sub{margin:30px 0 6px;padding-top:18px;border-top:1px solid var(--dsw-alias-border-l1);font-size:13px;font-weight:600}
.dshmem-settings-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.dshmem-mimo-size{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
`;

    /** Install the shared stylesheet once for every mount of this plugin. */
    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      for (const stale of document.querySelectorAll(`style[data-plugin-css="${STYLE_KEY}"]`)) stale.remove();
      const tag = document.createElement('style');
      tag.dataset.plugin = '@local/dsh-memory';
      tag.dataset.pluginCss = STYLE_KEY;
      tag.textContent = css;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    /** Format an epoch-ms value as `MM-DD HH:mm` in the page locale. */
    function shortTime(ms) {
      if (!ms) return '';
      const date = new Date(ms);
      const pad = (value) => String(value).padStart(2, '0');
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /** Format an epoch-ms or ISO value as a plain date. */
    function shortDate(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (part) => String(part).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    /** Human-readable byte size for memory listings. */
    function formatBytes(bytes) {
      if (!bytes) return '0 KB';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /** Fetch one JSON route, surfacing the Host's error text. */
    async function api(path, params, signal) {
      const url = new URL(path, window.location.origin);
      for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
      const response = await fetch(url.toString(), {
        signal,
        headers: { accept: 'application/json' },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    }

    /** POST JSON to one route. */
    async function post(path, body) {
      const response = await fetch(new URL(path, window.location.origin).toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    }

    /** Split `**bold**` and `` `code` `` spans into React nodes. */
    function inline(text) {
      const nodes = [];
      const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
      let last = 0;
      let match;
      while ((match = pattern.exec(text))) {
        if (match.index > last) nodes.push(text.slice(last, match.index));
        if (match[2] !== undefined) nodes.push(h('strong', { key: `b${match.index}` }, match[2]));
        else nodes.push(h('code', { key: `c${match.index}`, className: 'dshmem-code' }, match[3]));
        last = pattern.lastIndex;
      }
      if (last < text.length) nodes.push(text.slice(last));
      return nodes;
    }

    /** A deliberately small Markdown renderer: headings, lists, fences, spans. */
    function markdown(text) {
      const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
      const blocks = [];
      let index = 0;
      let key = 0;
      while (index < lines.length) {
        const line = lines[index];
        if (line.startsWith('```')) {
          const code = [];
          index += 1;
          while (index < lines.length && !lines[index].startsWith('```')) {
            code.push(lines[index]);
            index += 1;
          }
          index += 1;
          blocks.push(h('pre', { key: key++, className: 'dshmem-pre' }, h('code', null, code.join('\n'))));
          continue;
        }
        const heading = /^(#{1,4})\s+(.*)$/.exec(line);
        if (heading) {
          const level = heading[1].length;
          blocks.push(h('div', { key: key++, className: `dshmem-h dshmem-h${level}` }, inline(heading[2])));
          index += 1;
          continue;
        }
        if (!line.trim()) {
          index += 1;
          continue;
        }
        if (/^[-*]\s+/.test(line)) {
          const items = [];
          while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
            items.push(h('li', { key: key++ }, inline(lines[index].replace(/^[-*]\s+/, ''))));
            index += 1;
          }
          blocks.push(h('ul', { key: key++, className: 'dshmem-list' }, items));
          continue;
        }
        if (/^\d+\.\s+/.test(line)) {
          const items = [];
          while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
            items.push(h('li', { key: key++ }, inline(lines[index].replace(/^\d+\.\s+/, ''))));
            index += 1;
          }
          blocks.push(h('ol', { key: key++, className: 'dshmem-list' }, items));
          continue;
        }
        const paragraph = [line];
        index += 1;
        while (index < lines.length && lines[index].trim() && !/^(#{1,4}\s|[-*]\s|\d+\.\s|```)/.test(lines[index])) {
          paragraph.push(lines[index]);
          index += 1;
        }
        blocks.push(h('p', { key: key++, className: 'dshmem-p' }, inline(paragraph.join(' '))));
      }
      return blocks;
    }

    /** One labelled switch row in a settings page. */
    function ToggleRow({ label, description, checked, disabled, onChange }) {
      return h(
        'div',
        { className: 'dshmem-row' },
        h('div', { className: 'dshmem-row-main' }, h('div', { className: 'dshmem-row-label' }, label), h('div', { className: 'dshmem-row-desc' }, description)),
        h(
          'div',
          { className: 'dshmem-row-control' },
          h(
            'button',
            {
              type: 'button',
              role: 'switch',
              'aria-checked': checked ? 'true' : 'false',
              'aria-label': label,
              className: 'dshmem-switch',
              'data-on': checked ? 'true' : 'false',
              disabled,
              onClick: () => onChange(!checked),
            },
            h('span', { className: 'dshmem-switch-knob' }),
          ),
        ),
      );
    }

    function MemoryView(props) {
      const t = props.t || translate;
      const sessionId = props.sessionId;
      const [tree, setTree] = useState(null);
      const [status, setStatus] = useState('loading');
      const [error, setError] = useState('');
      const [active, setActive] = useState(null);
      const [doc, setDoc] = useState(null);
      const [docError, setDocError] = useState('');
      const [query, setQuery] = useState('');
      const [results, setResults] = useState(null);
      const [searching, setSearching] = useState(false);
      const [importing, setImporting] = useState(false);
      const [notice, setNotice] = useState('');
      const abort = useRef(null);

      const loadTree = useCallback(async () => {
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        setStatus('loading');
        setError('');
        try {
          const next = await api('/api/memory.tree', { session: sessionId }, controller.signal);
          setTree(next);
          setStatus('ready');
          setActive((current) => {
            if (current && next.scopes.some((scope) => scope.files.some((file) => file.path === current))) {
              return current;
            }
            for (const scope of next.scopes) {
              if (scope.files.length) return scope.files[0].path;
            }
            return null;
          });
        } catch (cause) {
          if (controller.signal.aborted) return;
          setStatus('error');
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }, [sessionId]);

      useEffect(() => {
        void loadTree();
        return () => abort.current?.abort();
      }, [loadTree]);

      useEffect(() => {
        if (!active) {
          setDoc(null);
          return;
        }
        let cancelled = false;
        setDocError('');
        api('/api/memory.file', { path: active })
          .then((next) => {
            if (!cancelled) setDoc(next);
          })
          .catch((cause) => {
            if (!cancelled) setDocError(cause instanceof Error ? cause.message : String(cause));
          });
        return () => {
          cancelled = true;
        };
      }, [active]);

      const runSearch = useCallback(
        async (event) => {
          event?.preventDefault?.();
          const term = query.trim();
          if (!term) {
            setResults(null);
            return;
          }
          setSearching(true);
          try {
            const next = await api('/api/memory.search', { q: term, session: sessionId, limit: 12 });
            setResults(next);
          } catch (cause) {
            setResults({ query: term, results: [], scanned: 0, error: cause instanceof Error ? cause.message : String(cause) });
          } finally {
            setSearching(false);
          }
        },
        [query, sessionId],
      );

      const runImport = useCallback(async () => {
        setImporting(true);
        setNotice('');
        try {
          const report = await post('/api/memory.import', { session: sessionId });
          await loadTree();
          if (report.imported?.[0]?.path) setActive(report.imported[0].path);
          setNotice(report.imported?.length ? t('importDone') : report.skipped?.[0] || t('importNothing'));
        } catch (cause) {
          setNotice(`${t('importFailed')}: ${cause instanceof Error ? cause.message : String(cause)}`);
        } finally {
          setImporting(false);
        }
      }, [sessionId, loadTree, t]);

      const scopeLabel = useMemo(
        () => ({ project: t('scopeProject'), session: t('scopeSession'), global: t('scopeGlobal') }),
        [t],
      );
      const typeLabel = useMemo(
        () => ({
          memory: t('typeMemory'),
          checkpoint: t('typeCheckpoint'),
          notes: t('typeNotes'),
          progress: t('typeProgress'),
          free: t('typeFree'),
        }),
        [t],
      );

      const total = tree ? tree.scopes.reduce((sum, scope) => sum + scope.files.length, 0) : 0;
      const mimo = tree?.mimo;
      const memoryOff = tree?.settings && tree.settings.enabled === false;

      const bar = h(
        'div',
        { className: 'dshmem-bar' },
        h('div', { className: 'dshmem-title' }, t('title')),
        h('div', { className: 'dshmem-count' }, tree ? t('files', { n: total }) : ''),
        h(
          'form',
          { className: 'dshmem-search', onSubmit: runSearch },
          h('input', {
            className: 'dshmem-input',
            value: query,
            placeholder: t('search'),
            'aria-label': t('search'),
            onChange: (event) => {
              setQuery(event.target.value);
              if (!event.target.value) setResults(null);
            },
          }),
          results
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dshmem-btn',
                  onClick: () => {
                    setQuery('');
                    setResults(null);
                  },
                },
                t('clear'),
              )
            : h('button', { type: 'submit', className: 'dshmem-btn', disabled: searching }, t('searchAction')),
          h('button', { type: 'button', className: 'dshmem-btn', onClick: () => void loadTree() }, t('refresh')),
        ),
      );

      const banner =
        mimo?.available && !mimo.importedAt
          ? h(
              'div',
              { className: 'dshmem-banner' },
              h(
                'div',
                { className: 'dshmem-banner-body' },
                h('div', { className: 'dshmem-banner-title' }, t('importTitle')),
                h(
                  'div',
                  { className: 'dshmem-banner-text' },
                  t('importBody', {
                    size: mimo.bytes ? `${Math.max(1, Math.round(mimo.bytes / 1024))} KB` : '—',
                  }),
                ),
              ),
              h(
                'div',
                { className: 'dshmem-banner-action' },
                h('button', { type: 'button', className: 'dshmem-btn', disabled: importing, onClick: () => void runImport() }, importing ? t('importing') : t('importAction')),
              ),
            )
          : null;

      let main;
      if (status === 'loading' && !tree) {
        main = h('div', { className: 'dshmem-empty' }, h('div', { className: 'dshmem-empty-body' }, t('loading')));
      } else if (status === 'error') {
        main = h(
          'div',
          { className: 'dshmem-empty' },
          h('div', { className: 'dshmem-empty-title' }, t('error')),
          h('div', { className: 'dshmem-error' }, error),
          h('button', { type: 'button', className: 'dshmem-btn', onClick: () => void loadTree() }, t('retry')),
        );
      } else if (results) {
        main = h(
          'div',
          null,
          h('div', { className: 'dshmem-dochead' }, h('div', { className: 'dshmem-path' }, t('results', { n: results.results.length }))),
          results.error
            ? h('div', { className: 'dshmem-error' }, results.error)
            : results.results.length === 0
              ? h('div', { className: 'dshmem-empty-body' }, t('noResults', { query: results.query }))
              : results.results.map((hit) =>
                  h(
                    'button',
                    {
                      key: hit.path,
                      type: 'button',
                      className: 'dshmem-hit',
                      onClick: () => {
                        setResults(null);
                        setActive(hit.path);
                      },
                    },
                    h(
                      'span',
                      { className: 'dshmem-hit-head' },
                      h('span', { className: 'dshmem-hit-path' }, hit.path),
                      h('span', { className: 'dshmem-badge' }, (typeLabel[hit.type] || hit.type).toUpperCase()),
                      h('span', { className: 'dshmem-hit-score' }, hit.score.toFixed(2)),
                    ),
                    h('span', { className: 'dshmem-hit-snippet' }, hit.snippet),
                  ),
                ),
          results.results.length ? h('div', { className: 'dshmem-empty-body', style: { marginTop: 6 } }, t('snippet')) : null,
        );
      } else if (tree && total === 0) {
        main = h(
          'div',
          { className: 'dshmem-empty' },
          h('div', { className: 'dshmem-empty-title' }, t('emptyTitle')),
          h('div', { className: 'dshmem-empty-body' }, t('emptyBody', { root: tree.root })),
          h('div', { className: 'dshmem-empty-body dshmem-mono' }, tree.root),
          mimo?.available ? null : h('div', { className: 'dshmem-empty-body' }, t('mimoHint')),
        );
      } else if (docError) {
        main = h(
          'div',
          { className: 'dshmem-empty' },
          h('div', { className: 'dshmem-empty-title' }, t('error')),
          h('div', { className: 'dshmem-error' }, docError),
        );
      } else if (!doc) {
        main = h('div', { className: 'dshmem-empty' }, h('div', { className: 'dshmem-empty-body' }, t('select')));
      } else {
        main = h(
          'div',
          null,
          h(
            'div',
            { className: 'dshmem-dochead' },
            h('div', { className: 'dshmem-path' }, doc.path),
            h('div', { className: 'dshmem-stamp' }, t('updated', { time: shortTime(doc.mtime) })),
          ),
          markdown(doc.body),
        );
      }

      const nav = tree
        ? tree.scopes.map((scope) =>
            h(
              'div',
              { key: scope.id },
              h(
                'div',
                { className: 'dshmem-group' },
                scopeLabel[scope.id] || scope.id,
                scope.detail
                  ? h(
                      'span',
                      { className: 'dshmem-group-detail', title: scope.detail },
                      scope.project?.name || (scope.id === 'session' ? t('thisSession') : ''),
                    )
                  : null,
              ),
              scope.id === 'project' && mimo?.importedAt
                ? h('div', { className: 'dshmem-imported' }, t('importedNote', { date: shortDate(mimo.importedAt) }))
                : null,
              scope.files.length === 0
                ? h('div', { className: 'dshmem-group-empty' }, '—')
                : scope.files.map((file) =>
                    h(
                      'button',
                      {
                        key: file.path,
                        type: 'button',
                        className: 'dshmem-file',
                        'data-active': file.path === active ? 'true' : 'false',
                        title: file.path,
                        onClick: () => {
                          setResults(null);
                          setActive(file.path);
                        },
                      },
                      h('span', { className: 'dshmem-file-name' }, file.name),
                      h('span', { className: 'dshmem-badge' }, (typeLabel[file.type] || file.type).toUpperCase()),
                    ),
                  ),
            ),
          )
        : null;

      return h(
        'div',
        { className: 'dshmem-root' },
        bar,
        memoryOff ? h('div', { className: 'dshmem-off' }, t('disabledNote')) : null,
        banner,
        notice ? h('div', { className: 'dshmem-banner' }, h('div', { className: 'dshmem-banner-text' }, notice)) : null,
        h('div', { className: 'dshmem-body' }, h('div', { className: 'dshmem-nav' }, nav), h('div', { className: 'dshmem-main' }, main)),
      );
    }

    function MemorySettings(props) {
      const t = props.t || translate;
      const [settings, setSettings] = useState(null);
      const [status, setStatus] = useState('loading');
      const [error, setError] = useState('');
      const [saving, setSaving] = useState(false);
      const [saved, setSaved] = useState(false);
      const [mimo, setMimo] = useState(null);
      const [mimoBusy, setMimoBusy] = useState('');
      const [mimoNotice, setMimoNotice] = useState('');
      const [mimoError, setMimoError] = useState('');

      useEffect(() => {
        let cancelled = false;
        api('/api/memory.settings')
          .then((data) => {
            if (cancelled) return;
            setSettings(data.settings);
            setStatus('ready');
          })
          .catch((cause) => {
            if (cancelled) return;
            setStatus('error');
            setError(cause instanceof Error ? cause.message : String(cause));
          });
        return () => {
          cancelled = true;
        };
      }, []);

      const loadMimo = useCallback(async () => {
        try {
          setMimo(await api('/api/memory.mimo'));
        } catch (cause) {
          setMimo({
            supported: false,
            reason: cause instanceof Error ? cause.message : String(cause),
            workspaces: [],
            others: [],
            projects: [],
            global: { bytes: 0, imported: false },
          });
        }
      }, []);

      useEffect(() => {
        void loadMimo();
      }, [loadMimo]);

      const importFromMimo = async (payload, key, name) => {
        setMimoBusy(key);
        setMimoError('');
        setMimoNotice('');
        try {
          const report = await post('/api/memory.import', payload);
          await loadMimo();
          setMimoNotice(report?.imported?.length ? t('mimoDone', { name }) : report?.skipped?.[0] || t('mimoDone', { name }));
        } catch (cause) {
          setMimoError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setMimoBusy('');
        }
      };

      const mimoRow = (entry, key, name, payload) => {
        const busy = mimoBusy === key;
        const control = entry.imported
          ? h('span', { className: 'dshmem-saved' }, t('mimoImported'))
          : entry.available === false
            ? h('span', { className: 'dshmem-row-desc' }, t('wsNone'))
            : h(
                'button',
                {
                  type: 'button',
                  className: 'dshmem-btn',
                  disabled: busy,
                  onClick: () => void importFromMimo(payload, key, name),
                },
                busy ? t('mimoImporting') : t('mimoImport'),
              );
        return h(
          'div',
          { className: 'dshmem-row', key },
          h(
            'div',
            { className: 'dshmem-row-main' },
            h(
              'div',
              { className: 'dshmem-row-label' },
              name,
              entry.available === false ? null : h('span', { className: 'dshmem-mimo-size' }, formatBytes(entry.bytes)),
            ),
            entry.path ? h('div', { className: 'dshmem-row-desc dshmem-mono' }, entry.path) : null,
          ),
          h('div', { className: 'dshmem-row-control' }, control),
        );
      };

      const patch = (key, value) => {
        setSaved(false);
        setSettings((current) => (current ? { ...current, [key]: value } : current));
      };

      const save = async () => {
        if (!settings) return;
        setSaving(true);
        setError('');
        try {
          const data = await post('/api/memory.settings', settings);
          setSettings(data.settings);
          setSaved(true);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setSaving(false);
        }
      };

      if (status === 'loading') {
        return h('div', { className: 'dshmem-settings' }, h('div', { className: 'dshmem-empty-body' }, t('settingsLoading')));
      }
      if (status === 'error' || !settings) {
        return h(
          'div',
          { className: 'dshmem-settings' },
          h('div', { className: 'dshmem-settings-title' }, t('settingsTitle')),
          h('div', { className: 'dshmem-error' }, error || t('error')),
        );
      }

      const off = settings.enabled === false;
      // Tolerate an older Host shape (no `workspaces`) and a failed catalog fetch:
      // this page must render a message, never throw inside the slot.
      const mimoWorkspaces = Array.isArray(mimo?.workspaces) ? mimo.workspaces : [];
      const mimoOthers = Array.isArray(mimo?.others)
        ? mimo.others
        : Array.isArray(mimo?.projects)
          ? mimo.projects
          : [];
      const mimoBroken = mimo !== null && mimo?.supported === false;

      // The catalog section is isolated: a failure here must not blank
      // the whole settings page. Element construction is eager, so a
      // try/catch around it covers property and data-shape errors.
      let mimoSection;
      try {
        mimoSection =
        mimo === null
          ? h('div', { className: 'dshmem-empty-body' }, t('settingsLoading'))
          : h(
              'div',
              null,
              mimoBroken
                ? h('div', { className: 'dshmem-error' }, t('mimoUnsupported', { reason: mimo.reason || 'unknown' }))
                : null,
              mimo.global && mimo.global.bytes > 0
                ? mimoRow({ ...mimo.global, available: true, path: '' }, 'global', t('mimoGlobal'), { global: true })
                : null,
              mimoBroken ? null : h('div', { className: 'dshmem-settings-sub2' }, t('wsTitle')),
              mimoBroken ? null : h('div', { className: 'dshmem-settings-intro' }, t('wsIntro')),
              mimoBroken ? null : mimoWorkspaces.length === 0
                ? h('div', { className: 'dshmem-empty-body' }, t('wsNoWorkspaces'))
                : mimoWorkspaces.map((workspace) =>
                    mimoRow(workspace, workspace.workspaceId || workspace.path, workspace.title, {
                      projectId: workspace.projectId,
                      path: workspace.path,
                    }),
                  ),
              mimoOthers.length > 0
                ? [
                    h('div', { key: 'others-head', className: 'dshmem-settings-sub2' }, t('mimoOthers')),
                    ...mimoOthers.map((entry) =>
                      mimoRow(entry, entry.projectId, entry.name, { projectId: entry.projectId, path: entry.path }),
                    ),
                  ]
                : null,
              h(
                'div',
                { className: 'dshmem-actions' },
                h('button', { type: 'button', className: 'dshmem-btn', onClick: () => void loadMimo() }, t('mimoRefresh')),
                mimoNotice ? h('span', { className: 'dshmem-saved' }, mimoNotice) : null,
                mimoError ? h('span', { className: 'dshmem-error' }, mimoError) : null,
              ),
            );
      } catch (cause) {
        mimoSection = h(
          'div',
          { className: 'dshmem-error' },
          `${t('mimoUnsupported', { reason: 'render failed' })} ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }

      return h(
        'div',
        { className: 'dshmem-settings' },
        h('div', { className: 'dshmem-settings-title' }, t('settingsTitle')),
        h('div', { className: 'dshmem-settings-intro' }, t('settingsIntro')),
        h(ToggleRow, {
          label: t('enabled'),
          description: t('enabledDesc'),
          checked: settings.enabled,
          onChange: (value) => patch('enabled', value),
        }),
        h(ToggleRow, {
          label: t('injectProject'),
          description: t('injectProjectDesc'),
          checked: settings.injectProject,
          disabled: off,
          onChange: (value) => patch('injectProject', value),
        }),
        h(ToggleRow, {
          label: t('injectGlobal'),
          description: t('injectGlobalDesc'),
          checked: settings.injectGlobal,
          disabled: off,
          onChange: (value) => patch('injectGlobal', value),
        }),
        h(ToggleRow, {
          label: t('injectSessionNotes'),
          description: t('injectSessionNotesDesc'),
          checked: settings.injectSessionNotes,
          disabled: off,
          onChange: (value) => patch('injectSessionNotes', value),
        }),
        h(ToggleRow, {
          label: t('showHint'),
          description: t('showHintDesc'),
          checked: settings.showHint,
          disabled: off,
          onChange: (value) => patch('showHint', value),
        }),
        h(ToggleRow, {
          label: t('autoImport'),
          description: t('autoImportDesc'),
          checked: settings.autoImportMimoCode,
          onChange: (value) => patch('autoImportMimoCode', value),
        }),
        h(
          'div',
          { className: 'dshmem-row' },
          h('div', { className: 'dshmem-row-main' }, h('div', { className: 'dshmem-row-label' }, t('maxChars')), h('div', { className: 'dshmem-row-desc' }, t('maxCharsDesc'))),
          h(
            'div',
            { className: 'dshmem-row-control' },
            h('input', {
              className: 'dshmem-num',
              type: 'number',
              min: 500,
              max: 50000,
              step: 500,
              value: settings.maxChars,
              disabled: off,
              'aria-label': t('maxChars'),
              onChange: (event) => patch('maxChars', Number(event.target.value)),
            }),
          ),
        ),
        h(
          'div',
          { className: 'dshmem-row' },
          h('div', { className: 'dshmem-row-main' }, h('div', { className: 'dshmem-row-label' }, t('searchLimit')), h('div', { className: 'dshmem-row-desc' }, t('searchLimitDesc'))),
          h(
            'div',
            { className: 'dshmem-row-control' },
            h('input', {
              className: 'dshmem-num',
              type: 'number',
              min: 1,
              max: 30,
              step: 1,
              value: settings.searchLimit,
              disabled: off,
              'aria-label': t('searchLimit'),
              onChange: (event) => patch('searchLimit', Number(event.target.value)),
            }),
          ),
        ),
        h('div', { className: 'dshmem-settings-sub' }, t('mimoTitle')),
        h('div', { className: 'dshmem-settings-intro' }, t('mimoIntro')),
        mimoSection,
        h(
          'div',
          { className: 'dshmem-actions' },
          h('button', { type: 'button', className: 'dshmem-btn', disabled: saving, onClick: () => void save() }, saving ? t('saving') : t('save')),
          saved ? h('span', { className: 'dshmem-saved' }, t('saved')) : null,
          error ? h('span', { className: 'dshmem-error' }, `${t('saveFailed')} ${error}`) : null,
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        translate = t;
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'memory-tab: dictionaries');
        ctx.effect(() => installStyles(), 'memory-tab: styles');
        ctx.slots.inject('conversation.view', () =>
          ctx.slots.register(
            {
              name: 'conversation.view',
              id: 'memory',
              order: 20,
              locale: NS,
              label: () => t('nav'),
            },
            MemoryView,
          ),
        );
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'memory',
              order: 30,
              locale: NS,
              label: () => t('settingsNav'),
            },
            MemorySettings,
          ),
        );
      },
    };
  },
});
