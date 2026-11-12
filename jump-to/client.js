/**
 * Browser half of the Jump To bundle (`@local/dsh-jump`).
 *
 * Three surfaces share one small store:
 *   - a `conversation.session.header.actions` trigger that opens the switcher;
 *   - a `shell.overlay` palette listing attention sessions, recent sessions,
 *     and workspaces, with fuzzy title/workspace matching;
 *   - a `conversation.composer.dock` status strip showing the current session's
 *     live state plus other sessions that are running or waiting on the user.
 *
 * Styling uses only `--dsw-alias-*` theme tokens, so light/dark mode and host
 * font sizes follow without extra work. The palette owns its keyboard handling;
 * it deliberately avoids importing Harness client modules.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-jump',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useMemo, useRef, useState, useSyncExternalStore } = React;

    const NS = 'jumpTo';
    const STYLE_KEY = 'dsh-jump';
    const EMPTY_LIST = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} };
    const EMPTY_WORKSPACES = { items: [], archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'pending', error: null };
    const EMPTY_STATUSES = new Map();

    /** Whether the page runs on a macOS-family platform. */
    function isMacPlatform() {
      if (typeof navigator === 'undefined') return false;
      const platform = navigator.userAgentData?.platform ?? navigator.platform ?? '';
      return /mac|iphone|ipad|ipod/i.test(platform);
    }

    /** Visible shortcut label for the toggle. */
    function hotkeyLabel() {
      return isMacPlatform() ? '\u2318\u21e7E' : 'Ctrl+Shift+E';
    }

    /** ARIA key-shortcut spelling for the toggle. */
    function hotkeyAria() {
      return isMacPlatform() ? 'Meta+Shift+E' : 'Control+Shift+E';
    }

    const UNGROUPED_ID = '__ungrouped__';
    const ICON_STORAGE_KEY = 'dsh-jump.workspace-icons.v1';
    const DEFAULT_ICON_ID = 'folder';
    const ICON_CHOICES = [
      { id: 'folder', char: '\u{1F4C1}', labelKey: 'iconFolder' },
      { id: 'code', char: '\u{1F4BB}', labelKey: 'iconCode' },
      { id: 'flask', char: '\u{1F9EA}', labelKey: 'iconFlask' },
      { id: 'rocket', char: '\u{1F680}', labelKey: 'iconRocket' },
      { id: 'chart', char: '\u{1F4CA}', labelKey: 'iconChart' },
      { id: 'bug', char: '\u{1F41B}', labelKey: 'iconBug' },
      { id: 'globe', char: '\u{1F310}', labelKey: 'iconGlobe' },
      { id: 'book', char: '\u{1F4DA}', labelKey: 'iconBook' },
      { id: 'palette', char: '\u{1F3A8}', labelKey: 'iconPalette' },
      { id: 'inbox', char: '\u{1F4E5}', labelKey: 'iconInbox' },
    ];
    const ICON_BY_ID = new Map(ICON_CHOICES.map((choice) => [choice.id, choice]));
    const DEFAULT_ICON = ICON_BY_ID.get(DEFAULT_ICON_ID);
    const UNGROUPED_ICON = ICON_BY_ID.get('inbox');

    /** Read the browser-local workspace icon map. */
    function readIconPrefs() {
      try {
        if (typeof localStorage === 'undefined') return {};
        const raw = localStorage.getItem(ICON_STORAGE_KEY);
        if (raw === null) return {};
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const out = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string' && ICON_BY_ID.has(value)) out[key] = value;
        }
        return out;
      } catch (_error) {
        return {};
      }
    }

    /** Persist the browser-local workspace icon map. */
    function writeIconPrefs(prefs) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(ICON_STORAGE_KEY, JSON.stringify(prefs));
      } catch (_error) {
        /* storage can be unavailable in private or restricted contexts */
      }
    }

    /** Resolve one workspace's icon, with the ungrouped fallback. */
    function iconFor(prefs, workspaceId) {
      const chosen = ICON_BY_ID.get(prefs?.[workspaceId]);
      return chosen ?? (workspaceId === UNGROUPED_ID ? UNGROUPED_ICON : DEFAULT_ICON);
    }

    /** Local midnight in milliseconds. */
    function startOfTodayMs() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }

    /** English dictionary. */
    const en = {
      open: 'Jump to…',
      searchPlaceholder: 'Search workspaces and conversations',
      needsAttention: 'Needs attention',
      recent: 'Recent sessions',
      sessions: 'Sessions',
      workspaces: 'Workspaces',
      actions: 'Actions',
      newSession: 'New session',
      newSessionHere: 'New session in {workspace}',
      current: 'Current',
      noMatches: 'No matching workspaces or conversations',
      noResultsHint: 'Try a workspace name or a conversation title.',
      noSessions: 'No sessions yet',
      sessionCount: '{count} sessions',
      sessionCountOne: '1 session',
      activeCount: '{count} active',
      activeCountOne: '1 active',
      waiting: 'Waiting',
      waitingApproval: 'Waiting for approval',
      waitingAnswer: 'Waiting for answer',
      planReview: 'Plan awaiting review',
      working: 'Working',
      done: 'Done',
      lastFailed: 'Last turn failed',
      idle: 'Idle',
      subagentsRunning: '{count} subagents running',
      subagentsRunningOne: '1 subagent running',
      otherRunning: '{count} running',
      otherRunningOne: '1 running',
      otherWaiting: '{count} waiting',
      otherWaitingOne: '1 waiting',
      otherDone: '{count} done',
      otherDoneOne: '1 done',
      statusAria: 'Agent status',
      statusOpen: 'Open jump to',
      clear: 'Clear search',
      close: 'Close',
      hintNavigate: 'navigate',
      hintOpen: 'open',
      hintClose: 'close',
      hintToggle: 'toggle',
      ungrouped: 'Ungrouped',
      noWorkspaces: 'No workspaces yet',
      noActiveConversations: 'No active conversations',
      noConversations: 'No conversations yet',
      moreActive: '+{count} more',
      changeIcon: 'Change icon',
      back: 'Back',
      allConversations: 'All conversations',
      results: 'Results',
      openWorkspace: 'Open {workspace}',
      hintBack: 'back',
      iconFolder: 'Folder',
      iconCode: 'Code',
      iconFlask: 'Experiment',
      iconRocket: 'Rocket',
      iconChart: 'Chart',
      iconBug: 'Bug',
      iconGlobe: 'Globe',
      iconBook: 'Book',
      iconPalette: 'Design',
      iconInbox: 'Inbox',
      justNow: 'just now',
      minutesAgo: '{count}m ago',
      hoursAgo: '{count}h ago',
      daysAgo: '{count}d ago',
    };

    /** Chinese dictionary, key-identical to English. */
    const zh = {
      open: '跳转到…',
      searchPlaceholder: '搜索工作区与会话',
      needsAttention: '需要处理',
      recent: '最近会话',
      sessions: '会话',
      workspaces: '工作区',
      actions: '操作',
      newSession: '新建会话',
      newSessionHere: '在 {workspace} 新建会话',
      current: '当前',
      noMatches: '没有匹配的工作区或会话',
      noResultsHint: '试试工作区名称或会话标题。',
      noSessions: '还没有会话',
      sessionCount: '{count} 个会话',
      sessionCountOne: '1 个会话',
      activeCount: '{count} 个进行中',
      activeCountOne: '1 个进行中',
      waiting: '等待中',
      waitingApproval: '等待批准',
      waitingAnswer: '等待回答',
      planReview: '计划待审',
      working: '运行中',
      done: '已完成',
      lastFailed: '上轮失败',
      idle: '空闲',
      subagentsRunning: '{count} 个子代理运行中',
      subagentsRunningOne: '1 个子代理运行中',
      otherRunning: '{count} 个运行中',
      otherRunningOne: '1 个运行中',
      otherWaiting: '{count} 个等待中',
      otherWaitingOne: '1 个等待中',
      otherDone: '{count} 个已完成',
      otherDoneOne: '1 个已完成',
      statusAria: '代理状态',
      statusOpen: '打开跳转',
      clear: '清除搜索',
      close: '关闭',
      hintNavigate: '导航',
      hintOpen: '打开',
      hintClose: '关闭',
      hintToggle: '开关',
      ungrouped: '未分组',
      noWorkspaces: '还没有工作区',
      noActiveConversations: '今天没有活跃会话',
      noConversations: '还没有会话',
      moreActive: '还有 {count} 个',
      changeIcon: '更改图标',
      back: '返回',
      allConversations: '全部会话',
      results: '结果',
      openWorkspace: '打开 {workspace}',
      hintBack: '返回',
      iconFolder: '文件夹',
      iconCode: '代码',
      iconFlask: '实验',
      iconRocket: '火箭',
      iconChart: '图表',
      iconBug: '缺陷',
      iconGlobe: '全球',
      iconBook: '书籍',
      iconPalette: '设计',
      iconInbox: '收件箱',
      justNow: '刚刚',
      minutesAgo: '{count} 分钟前',
      hoursAgo: '{count} 小时前',
      daysAgo: '{count} 天前',
    };

    const CSS = `
.dshj-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: min(11vh, 112px) 16px 16px;
  background: color-mix(in srgb, #000 26%, transparent);
  pointer-events: auto;
}
.dshj-panel {
  display: flex;
  flex-direction: column;
  width: min(840px, 100%);
  max-height: min(78vh, 720px);
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1));
  box-shadow: var(--dsw-elevation-panel, 0 18px 50px color-mix(in srgb, #000 28%, transparent));
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}
.dshj-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  padding: 10px 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}
.dshj-search-icon {
  display: inline-flex;
  flex: none;
  color: var(--dsw-alias-label-secondary);
}
.dshj-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 14px;
}
.dshj-input::placeholder {
  color: var(--dsw-alias-label-secondary);
}
.dshj-input::-webkit-search-cancel-button {
  display: none;
}
.dshj-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.dshj-clear:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dshj-scroll {
  min-height: 0;
  padding: 4px 6px 8px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.dshj-new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dshj-new:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dshj-grid-wrap {
  padding: 2px 4px 8px;
}
.dshj-grid-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 6px 6px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.dshj-grid-count,
.dshj-detail-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
}
.dshj-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 0 4px;
}
.dshj-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-bg-layer-1);
  cursor: pointer;
  transition: border-color 0.12s var(--ds-ease-in-out, ease), background-color 0.12s var(--ds-ease-in-out, ease);
}
.dshj-card:hover {
  border-color: var(--dsw-alias-border-l2);
}
.dshj-card[data-card-active="true"] {
  border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, var(--dsw-alias-bg-layer-1));
}
.dshj-card-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.dshj-card-icon,
.dshj-detail-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.dshj-detail-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  font-size: 16px;
}
.dshj-card-icon:hover,
.dshj-detail-icon:hover {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
}
.dshj-card-text {
  flex: 1;
  min-width: 0;
}
.dshj-card-title,
.dshj-detail-title {
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshj-card-path,
.dshj-detail-path {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshj-card-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 14px;
}
.dshj-card-signal {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
.dshj-card-signal[data-state="running"] {
  background: var(--dsw-alias-brand-primary);
}
.dshj-card-signal[data-state="waiting"] {
  background: var(--dsw-alias-state-warn-primary);
}
.dshj-card-signal[data-state="done"] {
  background: var(--dsw-alias-state-success-primary);
}
.dshj-card-active {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.dshj-card-active[data-empty="true"] {
  color: var(--dsw-alias-label-secondary);
  font-weight: 400;
}
.dshj-card-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 18px;
  margin-top: 9px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
}
.dshj-card-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.dshj-card-conv {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 27px;
  padding: 4px 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dshj-card-conv:hover {
  background: var(--dsw-alias-bg-layer-2);
}
.dshj-card-conv-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshj-card-conv-time {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 14px;
}
.dshj-card-empty {
  padding: 5px 6px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
}
.dshj-card-more {
  padding: 2px 6px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 15px;
}
.dshj-icon-row {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 4px 0 1px;
}
.dshj-icon-choice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.dshj-icon-choice:hover {
  background: var(--dsw-alias-bg-layer-2);
}
.dshj-detail {
  padding: 0 4px 8px;
}
.dshj-detail-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
  padding: 8px 6px 10px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1));
}
.dshj-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dshj-back:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dshj-detail-titles {
  flex: 1;
  min-width: 120px;
}
.dshj-detail-meta {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 5px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
}
.dshj-detail-active {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.dshj-detail-new {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 4px;
  height: 27px;
  padding: 0 9px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.dshj-detail-new:hover {
  background: var(--dsw-alias-bg-base);
}
.dshj-detail-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 6px 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.dshj-detail-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.dshj-detail-row {
  min-height: 36px;
  scroll-margin-top: 64px;
}
.dshj-empty-detail {
  padding-top: 18px;
}
.dshj-grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 180px;
}
.dshj-new:focus-visible,
.dshj-back:focus-visible,
.dshj-card-icon:focus-visible,
.dshj-detail-icon:focus-visible,
.dshj-detail-new:focus-visible,
.dshj-icon-choice:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
@media (max-width: 700px) {
  .dshj-grid {
    grid-template-columns: 1fr;
  }
  .dshj-detail-head {
    gap: 7px;
  }
  .dshj-detail-new {
    margin-left: 31px;
  }
}
.dshj-section {
  padding: 10px 10px 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.dshj-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  padding: 7px 10px;
  border: 0;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dshj-row[data-active="true"] {
  background: var(--dsw-alias-bg-layer-2);
}
.dshj-row:focus-visible,
.dshj-clear:focus-visible,
.dshj-status:focus-visible,
.dshj-trigger:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dshj-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.dshj-meta {
  flex: 0 1 auto;
  max-width: 46%;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshj-chip {
  display: inline-flex;
  align-items: center;
  flex: none;
  max-width: 42%;
  padding: 1px 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshj-chip[data-tone="active"] {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}
.dshj-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dshj-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
.dshj-dot[data-state="running"] {
  background: var(--dsw-alias-brand-primary);
}
.dshj-dot[data-state="waiting"] {
  background: var(--dsw-alias-state-warn-primary);
}
.dshj-dot[data-state="done"] {
  background: var(--dsw-alias-state-success-primary);
}
.dshj-dot[data-state="error"] {
  background: var(--dsw-alias-state-error-primary);
}
.dshj-empty {
  padding: 26px 14px 12px;
  color: var(--dsw-alias-label-secondary);
  text-align: center;
  font-size: 12px;
}
.dshj-empty-title {
  margin-bottom: 4px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}
.dshj-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
  padding: 8px 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}
.dshj-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.dshj-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  font-size: 10px;
  font-family: var(--ds-font-family-code, monospace);
}
.dshj-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border: 0.5px solid transparent;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.dshj-trigger:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dshj-trigger-label {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dshj-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 2px 8px;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  cursor: pointer;
  white-space: nowrap;
}
.dshj-status:hover {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}
.dshj-status[data-attention="warning"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 24%, var(--dsw-alias-bg-layer-1));
}
.dshj-status[data-attention="warning"]:hover {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 30%, var(--dsw-alias-bg-layer-1));
}
.dshj-status[data-attention="success"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 20%, var(--dsw-alias-bg-layer-1));
}
.dshj-status[data-attention="success"]:hover {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 26%, var(--dsw-alias-bg-layer-1));
}
.dshj-status[data-attention="error"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 20%, var(--dsw-alias-bg-layer-1));
}
.dshj-status[data-attention="error"]:hover {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 26%, var(--dsw-alias-bg-layer-1));
}
.dshj-status[data-attention] .dshj-status-label,
.dshj-status[data-attention] .dshj-status-detail,
.dshj-status[data-attention] .dshj-status-detail.dshj-warn {
  color: var(--dsw-alias-label-primary);
}
.dshj-status[data-attention] .dshj-status-icon {
  color: var(--dsw-alias-label-primary);
}
.dshj-status[data-attention] .dshj-dot {
  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-1);
}
.dshj-status-label {
  overflow: hidden;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  text-overflow: ellipsis;
}
.dshj-status-detail {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  text-overflow: ellipsis;
}
.dshj-status-detail.dshj-warn {
  color: var(--dsw-alias-state-warn-primary);
}
.dshj-status-detail.dshj-done {
  color: var(--dsw-alias-state-success-primary);
}
.dshj-status-sep {
  flex: none;
  width: 1px;
  height: 10px;
  background: var(--dsw-alias-border-l2);
}
.dshj-status-icon {
  display: inline-flex;
  flex: none;
  color: var(--dsw-alias-label-secondary);
}
.dshj-panel,
.dshj-row,
.dshj-trigger,
.dshj-status,
.dshj-input {
  box-sizing: border-box;
}
@media (prefers-reduced-motion: no-preference) {
  .dshj-dot[data-state="running"],
  .dshj-card-signal[data-state="running"] {
    animation: dshj-pulse 1.6s ease-in-out infinite;
  }
}
@keyframes dshj-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@media (max-width: 720px) {
  .dshj-trigger {
    width: 28px;
    padding: 0;
    justify-content: center;
  }
  .dshj-trigger-label {
    display: none;
  }
}
`;

    /**
     * Install the stylesheet once per document.
     * @returns cleanup removing the stylesheet.
     */
    function installStyles() {
      const previous = document.querySelectorAll(`style[data-plugin-css="${STYLE_KEY}"]`);
      for (const node of previous) node.remove();
      const tag = document.createElement('style');
      tag.dataset.pluginCss = STYLE_KEY;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => {
        if (tag.isConnected) tag.remove();
      };
    }

    /** A tiny observable used to connect the three slot entries. */
    function createJumpStore() {
      let state = { open: false, returnFocus: null };
      const listeners = new Set();
      const emit = () => {
        for (const listener of [...listeners]) {
          try {
            listener();
          } catch (_error) {
            /* a broken listener must not keep the store from notifying others */
          }
        }
      };
      const focusLater = (target) => {
        if (target === null || target === undefined) return;
        const restore = () => {
          if (target.isConnected && typeof target.focus === 'function') target.focus();
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
        else setTimeout(restore, 0);
      };
      return {
        getSnapshot: () => state,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        open: () => {
          if (state.open) return;
          const active = typeof document === 'undefined' ? null : document.activeElement;
          const target = active !== null && typeof HTMLElement !== 'undefined' && active instanceof HTMLElement ? active : null;
          state = { open: true, returnFocus: target };
          emit();
        },
        close: () => {
          if (!state.open) return;
          const target = state.returnFocus;
          state = { open: false, returnFocus: null };
          emit();
          focusLater(target);
        },
      };
    }

    /** Read the store reactively. */
    function useJumpState(store) {
      return useSyncExternalStore(
        (listener) => store.subscribe(listener),
        store.getSnapshot,
        store.getSnapshot,
      );
    }

    /** Last path segment, for workspaces without a title. */
    function basename(path) {
      const value = String(path ?? '').replace(/[\\/]+$/, '');
      const slash = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'));
      return slash >= 0 ? value.slice(slash + 1) : value;
    }

    /** Human display title for one workspace. */
    function workspaceTitle(workspace) {
      const title = String(workspace?.title ?? '').trim();
      return title !== '' ? title : basename(workspace?.path) || String(workspace?.workspaceId ?? '');
    }

    /** A session row that belongs in navigation. */
    function navigable(row) {
      return row !== undefined && row !== null && row.blank !== true && row.origin !== 'subagent';
    }

    /** The main view retains exactly the selected Session. */
    function isCurrent(row) {
      const retained = row?.retainedBy?.mainView;
      return typeof retained === 'number' && retained > 0;
    }

    /** One session's UI state, pending interaction first. */
    function sessionState(status, row, snapshot) {
      if (status?.pendingInteraction !== undefined) return 'waiting';
      const running = status?.running ?? row?.running ?? snapshot?.running;
      if (running === true) return 'running';
      if (status?.completionUnread === true) return 'done';
      if (snapshot?.lastAgentError) return 'error';
      return 'idle';
    }

    /** Localized label for one session state. */
    function stateLabel(state, pending, t) {
      if (state === 'waiting') {
        switch (pending?.kind) {
          case 'approval': return t('waitingApproval');
          case 'plan-review': return t('planReview');
          case 'question': return t('waitingAnswer');
          default: return t('waiting');
        }
      }
      if (state === 'running') return t('working');
      if (state === 'done') return t('done');
      if (state === 'error') return t('lastFailed');
      return t('idle');
    }

    /** Pick the singular or plural locale key. */
    function countLabel(count, oneKey, manyKey, t) {
      return count === 1 ? t(oneKey) : t(manyKey, { count });
    }

    /** Short relative time. */
    function relativeTime(time, t) {
      if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0) return '';
      const minutes = Math.floor(Math.max(0, Date.now() - time) / 60000);
      if (minutes < 1) return t('justNow');
      if (minutes < 60) return t('minutesAgo', { count: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t('hoursAgo', { count: hours });
      return t('daysAgo', { count: Math.floor(hours / 24) });
    }

    /** Ranked match: exact, prefix, substring, then ordered subsequence. */
    function scoreText(text, query) {
      if (query === '') return 0;
      const haystack = String(text ?? '').toLowerCase();
      const needle = query.toLowerCase();
      if (haystack === '') return -1;
      if (haystack === needle) return 1200;
      if (haystack.startsWith(needle)) return 1000 - Math.min(haystack.length, 400) * 0.1;
      const index = haystack.indexOf(needle);
      if (index >= 0) return 800 - index - Math.min(haystack.length, 400) * 0.1;
      let hi = 0;
      let ni = 0;
      let gaps = 0;
      let first = -1;
      while (hi < haystack.length && ni < needle.length) {
        if (haystack[hi] === needle[ni]) {
          if (first < 0) first = hi;
          ni += 1;
        } else if (ni > 0) {
          gaps += 1;
        }
        hi += 1;
      }
      if (ni !== needle.length) return -1;
      return 400 - gaps - Math.max(0, first) * 0.5;
    }

    /** Session-id to workspace map. */
    function workspaceBySession(workspaces) {
      const map = new Map();
      for (const workspace of workspaces?.items ?? []) {
        for (const id of workspace.sessionIds ?? []) map.set(id, workspace);
      }
      return map;
    }

    /** Running direct children recorded by the parent's subagent catalog. */
    function runningChildren(list, statuses, id) {
      const children = list?.projectionsBySession?.[id]?.values?.subagentCatalog;
      if (!Array.isArray(children) || children.length === 0) return null;
      let running = 0;
      for (const child of children) {
        const status = statuses?.get?.(child.id);
        const row = list?.byId?.[child.id];
        if ((status?.running ?? row?.running) === true) running += 1;
      }
      return { total: children.length, running };
    }

    /** Newest first, then title for a stable order. */
    function byRecent(left, right) {
      return right.interactedAt - left.interactedAt || String(left.displayTitle).localeCompare(String(right.displayTitle));
    }

    /** One session entry shared by the workspace cards and the detail list. */
    function sessionEntry({ id, row, status, todayStartMs, lastPromptAt, subagents }) {
      const running = (status?.running ?? row?.running) === true;
      const interactedAt = typeof lastPromptAt === 'number' && lastPromptAt > 0 ? lastPromptAt : row?.updatedAt ?? 0;
      return {
        id,
        row,
        state: sessionState(status, row, undefined),
        pending: status?.pendingInteraction,
        running,
        interactedAt,
        active: running || interactedAt >= todayStartMs,
        displayTitle: row?.displayTitle || id,
        current: isCurrent(row),
        subagents,
      };
    }

    /**
     * Build every workspace card plus the Ungrouped grouping.
     * Active means running now or updated since local midnight; cards list at
     * most three active conversations, newest first. A query filters cards by
     * workspace text and by conversation titles, listing the matching
     * conversations inside the matching cards.
     */
    function buildCatalog({ list, workspaces, statuses, query, t, iconPrefs }) {
      const q = query.trim();
      const todayStartMs = startOfTodayMs();
      const archived = new Set(workspaces?.archivedSessionIds ?? []);
      const wsBySession = workspaceBySession(workspaces);
      const statusFor = (id) => (statuses !== undefined && statuses !== null && typeof statuses.get === 'function' ? statuses.get(id) : undefined);
      const byWorkspace = new Map();
      const ungrouped = [];
      for (const id of list?.ids ?? []) {
        const row = list?.byId?.[id];
        if (!navigable(row) || archived.has(id)) continue;
        const entry = sessionEntry({
          id,
          row,
          status: statusFor(id),
          todayStartMs,
          lastPromptAt: list?.projectionsBySession?.[id]?.values?.sessionListMetadata?.lastPromptAt,
          subagents: runningChildren(list, statuses, id),
        });
        const workspace = wsBySession.get(id);
        if (workspace === undefined) {
          ungrouped.push(entry);
        } else {
          if (!byWorkspace.has(workspace.workspaceId)) byWorkspace.set(workspace.workspaceId, []);
          byWorkspace.get(workspace.workspaceId).push(entry);
        }
      }

      const cards = [];
      for (const workspace of workspaces?.items ?? []) {
        cards.push(makeCard({
          id: workspace.workspaceId,
          workspace,
          title: workspaceTitle(workspace),
          path: workspace.path ?? '',
          entries: byWorkspace.get(workspace.workspaceId) ?? [],
          q,
          icon: iconFor(iconPrefs, workspace.workspaceId),
        }));
      }
      if (ungrouped.length > 0) {
        cards.push(makeCard({
          id: UNGROUPED_ID,
          workspace: null,
          title: t('ungrouped'),
          path: '',
          entries: ungrouped,
          q,
          icon: iconFor(iconPrefs, UNGROUPED_ID),
        }));
      }

      const visible = cards.filter((card) => q === '' || card.score >= 0);
      if (q === '') visible.sort((left, right) => right.latestAt - left.latestAt || left.title.localeCompare(right.title));
      else visible.sort((left, right) => right.score - left.score || right.latestAt - left.latestAt || left.title.localeCompare(right.title));
      return { cards, visible };
    }

    /** Build one card from its session entries. */
    function makeCard({ id, workspace, title, path, entries, q, icon }) {
      const sorted = entries.slice().sort(byRecent);
      const activeEntries = sorted.filter((entry) => entry.active);
      const latestAt = sorted.length === 0 ? 0 : sorted[0].interactedAt;
      const activeCount = activeEntries.length;
      const signal = sorted.some((entry) => entry.state === 'waiting')
        ? 'waiting'
        : sorted.some((entry) => entry.state === 'running')
          ? 'running'
          : sorted.some((entry) => entry.state === 'done')
            ? 'done'
            : undefined;

      let listed = [];
      let more = 0;
      let score = 0;
      if (q === '') {
        listed = activeEntries.slice(0, 3);
        more = Math.max(0, activeCount - listed.length);
      } else {
        const workspaceScore = Math.max(scoreText(title, q), scoreText(path, q) * 0.7);
        const matches = sorted
          .map((entry) => ({ entry, score: scoreText(entry.displayTitle, q) }))
          .filter((match) => match.score >= 0)
          .sort((left, right) => right.score - left.score || right.entry.interactedAt - left.entry.interactedAt);
        if (matches.length > 0) {
          listed = matches.slice(0, 3).map((match) => match.entry);
          more = Math.max(0, matches.length - listed.length);
          score = Math.max(workspaceScore, matches[0].score);
        } else {
          listed = activeEntries.slice(0, 3);
          more = Math.max(0, activeCount - listed.length);
          score = workspaceScore;
        }
      }

      return {
        id,
        workspace,
        title,
        path,
        icon,
        entries: sorted,
        activeEntries,
        activeCount,
        latestAt,
        signal,
        listed,
        more,
        score,
        total: sorted.length,
      };
    }

    /** Magnifier glyph. */
    function iconSearch(size = 14) {
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
        'aria-hidden': true,
      },
        h('circle', { cx: 7, cy: 7, r: 4.4 }),
        h('path', { d: 'M10.4 10.4 14 14' }),
      );
    }

    /** Folder glyph. */
    function iconFolder(size = 14) {
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('path', { d: 'M1.8 4.3h4l1.2 1.4h7.2v6.4a.9.9 0 0 1-.9.9H2.7a.9.9 0 0 1-.9-.9z' }),
      );
    }

    /** Plus glyph. */
    function iconPlus(size = 12) {
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        'aria-hidden': true,
      },
        h('path', { d: 'M8 3v10M3 8h10' }),
      );
    }

    /** Right chevron, used as the card's open affordance. */
    function iconChevronRight(size = 12) {
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M6 3l5 5-5 5' }));
    }

    /** Left chevron, used as the detail view's back affordance. */
    function iconChevronLeft(size = 12) {
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M10 3 5 8l5 5' }));
    }

    /** Keeps a broken entry from blanking its slot. */
    class SilentBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch() {}
      render() {
        return this.state.failed ? null : this.props.children;
      }
    }

    /** Header trigger: one click opens the switcher. */
    function JumpHeaderAction(props) {
      const { store, t } = props;
      const state = useJumpState(store);
      const hint = `${t('open')} (${hotkeyLabel()})`;
      return h('button', {
        type: 'button',
        className: 'dshj-trigger',
        title: hint,
        'aria-label': hint,
        'aria-keyshortcuts': hotkeyAria(),
        'aria-haspopup': 'dialog',
        'aria-expanded': state.open,
        onClick: () => store.open(),
      }, iconSearch(), h('span', { className: 'dshj-trigger-label' }, t('open')));
    }

    /** Overlay host: only mounts the data-reading body while open. */
    function JumpOverlayHost(props) {
      return h(SilentBoundary, null, h(JumpOverlayHostBody, props));
    }

    function JumpOverlayHostBody(props) {
      const state = useJumpState(props.store);
      if (!state.open) return null;
      return h(JumpOverlay, props);
    }

    /** The searchable workspace catalog. */
    function JumpOverlay(props) {
      const {
        store, t, useSessions, useWorkspaces, useSessionStatus,
        openSession, startSession,
      } = props;
      const list = useSessions((value) => value) ?? EMPTY_LIST;
      const workspaces = useWorkspaces((value) => value) ?? EMPTY_WORKSPACES;
      const statuses = useSessionStatus((value) => value) ?? EMPTY_STATUSES;
      const [query, setQuery] = useState('');
      const [selectedId, setSelectedId] = useState(null);
      const [activeCard, setActiveCard] = useState(0);
      const [activeConv, setActiveConv] = useState(0);
      const [iconPickerId, setIconPickerId] = useState(null);
      const [iconPrefs, setIconPrefs] = useState(readIconPrefs);
      const inputRef = useRef(null);
      const scrollRef = useRef(null);

      const catalog = useMemo(
        () => buildCatalog({ list, workspaces, statuses, query, t, iconPrefs }),
        [list, workspaces, statuses, query, t, iconPrefs],
      );
      const selectedCard = selectedId === null
        ? null
        : catalog.cards.find((card) => card.id === selectedId) ?? null;
      const inDetail = selectedCard !== null;

      const detailEntries = useMemo(() => {
        if (selectedCard === null) return [];
        const q = query.trim();
        if (q === '') return selectedCard.entries;
        return selectedCard.entries
          .map((entry) => ({ entry, score: scoreText(entry.displayTitle, q) }))
          .filter((match) => match.score >= 0)
          .sort((left, right) => right.score - left.score || right.entry.interactedAt - left.entry.interactedAt)
          .map((match) => match.entry);
      }, [selectedCard, query]);

      useEffect(() => {
        if (selectedId !== null && !catalog.cards.some((card) => card.id === selectedId)) {
          setSelectedId(null);
          setActiveCard(0);
          setActiveConv(0);
        }
      }, [catalog.cards, selectedId]);

      useEffect(() => {
        if (catalog.visible.length === 0) {
          if (activeCard !== 0) setActiveCard(0);
          return;
        }
        if (activeCard >= catalog.visible.length) setActiveCard(catalog.visible.length - 1);
      }, [catalog.visible.length, activeCard]);

      useEffect(() => {
        if (detailEntries.length === 0) {
          if (activeConv !== 0) setActiveConv(0);
          return;
        }
        if (activeConv >= detailEntries.length) setActiveConv(detailEntries.length - 1);
      }, [detailEntries.length, activeConv]);

      useEffect(() => {
        if (inputRef.current !== null) inputRef.current.focus();
      }, []);

      useEffect(() => {
        const container = scrollRef.current;
        if (container === null) return;
        const item = container.querySelector('[data-active-item="true"]');
        if (item !== null && typeof item.scrollIntoView === 'function') {
          item.scrollIntoView({ block: 'nearest' });
        }
      }, [activeCard, activeConv, selectedId, query]);

      const focusInput = () => {
        if (inputRef.current !== null) inputRef.current.focus();
      };

      const openDetail = (cardId) => {
        setQuery('');
        setSelectedId(cardId);
        setActiveConv(0);
        setIconPickerId(null);
        focusInput();
      };

      const backToGrid = () => {
        const index = catalog.visible.findIndex((card) => card.id === selectedId);
        setQuery('');
        setSelectedId(null);
        setActiveCard(index >= 0 ? index : 0);
        setActiveConv(0);
        setIconPickerId(null);
        focusInput();
      };

      const chooseSession = (sessionId) => {
        store.close();
        openSession(sessionId);
      };

      const startNew = (workspaceId) => {
        store.close();
        if (workspaceId === undefined) startSession();
        else startSession(workspaceId);
      };

      const chooseIcon = (workspaceId, iconId) => {
        const next = { ...iconPrefs, [workspaceId]: iconId };
        setIconPrefs(next);
        writeIconPrefs(next);
        setIconPickerId(null);
        focusInput();
      };

      const changeQuery = (value) => {
        setQuery(value);
        setActiveCard(0);
        setActiveConv(0);
        setIconPickerId(null);
      };

      const onKeyDown = (event) => {
        const native = event.nativeEvent ?? event;
        if (native !== undefined && native !== null && native.isComposing === true) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (inDetail) backToGrid();
          else store.close();
          return;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          focusInput();
          return;
        }
        if (!inDetail) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (catalog.visible.length === 0) return;
            event.preventDefault();
            event.stopPropagation();
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            setActiveCard((current) => (current + delta + catalog.visible.length) % catalog.visible.length);
            focusInput();
            return;
          }
          if (event.key === 'Enter') {
            const target = event.target;
            if (target !== null && typeof target.tagName === 'string' && target.tagName === 'BUTTON') return;
            const card = catalog.visible[activeCard];
            if (card === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            openDetail(card.id);
          }
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (detailEntries.length === 0) return;
          event.preventDefault();
          event.stopPropagation();
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          setActiveConv((current) => (current + delta + detailEntries.length) % detailEntries.length);
          focusInput();
          return;
        }
        if (event.key === 'Enter') {
          const target = event.target;
          if (target !== null && typeof target.tagName === 'string' && target.tagName === 'BUTTON') return;
          const entry = detailEntries[activeConv];
          if (entry === undefined) return;
          event.preventDefault();
          event.stopPropagation();
          chooseSession(entry.id);
        }
      };

      const activeDescendant = inDetail
        ? detailEntries[activeConv] === undefined ? undefined : `dshj-conv-${activeConv}`
        : catalog.visible[activeCard] === undefined ? undefined : `dshj-card-${activeCard}`;
      const plusWorkspaceId = selectedCard !== null && selectedCard.workspace !== null ? selectedCard.id : undefined;
      const plusLabel = plusWorkspaceId === undefined
        ? t('newSession')
        : t('newSessionHere', { workspace: selectedCard.title });

      return h('div', {
        className: 'dshj-backdrop',
        onClick: (event) => {
          if (event.target === event.currentTarget) store.close();
        },
        onKeyDown,
      },
        h('div', {
          className: 'dshj-panel',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('open'),
        },
          h('div', { className: 'dshj-search' },
            h('span', { className: 'dshj-search-icon' }, iconSearch(15)),
            h('input', {
              ref: inputRef,
              className: 'dshj-input',
              type: 'search',
              value: query,
              placeholder: t('searchPlaceholder'),
              'aria-label': t('searchPlaceholder'),
              'aria-controls': inDetail ? 'dshj-detail-list' : 'dshj-grid',
              'aria-activedescendant': activeDescendant,
              role: 'combobox',
              'aria-expanded': true,
              'aria-autocomplete': 'list',
              autoComplete: 'off',
              spellCheck: false,
              onChange: (event) => changeQuery(event.target.value),
            }),
            query === '' ? null : h('button', {
              type: 'button',
              className: 'dshj-clear',
              tabIndex: -1,
              title: t('clear'),
              'aria-label': t('clear'),
              onClick: () => {
                changeQuery('');
                focusInput();
              },
            }, '×'),
            h('button', {
              type: 'button',
              className: 'dshj-new',
              tabIndex: -1,
              title: plusLabel,
              'aria-label': plusLabel,
              onClick: () => startNew(plusWorkspaceId),
            }, iconPlus()),
          ),
          h('div', { className: 'dshj-scroll', ref: scrollRef },
            inDetail
              ? renderDetail({
                card: selectedCard,
                entries: detailEntries,
                query,
                activeConv,
                setActiveConv,
                iconPickerId,
                iconPrefs,
                t,
                backToGrid,
                chooseSession,
                chooseIcon,
                setIconPickerId,
                startNew,
                focusInput,
              })
              : renderGrid({
                catalog,
                query,
                activeCard,
                setActiveCard,
                iconPickerId,
                iconPrefs,
                t,
                openDetail,
                chooseSession,
                chooseIcon,
                setIconPickerId,
                focusInput,
              }),
          ),
          h('div', { className: 'dshj-footer' },
            h('span', { className: 'dshj-hint' },
              h('kbd', { className: 'dshj-kbd' }, '↑'),
              h('kbd', { className: 'dshj-kbd' }, '↓'),
              t('hintNavigate'),
            ),
            h('span', { className: 'dshj-hint' },
              h('kbd', { className: 'dshj-kbd' }, '↵'),
              t('hintOpen'),
            ),
            h('span', { className: 'dshj-hint' },
              h('kbd', { className: 'dshj-kbd' }, 'esc'),
              inDetail ? t('hintBack') : t('hintClose'),
            ),
            h('span', { className: 'dshj-hint' },
              h('kbd', { className: 'dshj-kbd' }, hotkeyLabel()),
              t('hintToggle'),
            ),
          ),
        ),
      );
    }

    /** Two-column workspace grid. */
    function renderGrid({ catalog, query, activeCard, setActiveCard, iconPickerId, iconPrefs, t, openDetail, chooseSession, chooseIcon, setIconPickerId, focusInput }) {
      if (catalog.visible.length === 0) {
        return h('div', {
          className: 'dshj-empty dshj-grid-empty',
          id: 'dshj-grid',
          role: 'listbox',
          'aria-label': t('workspaces'),
        },
          h('div', { className: 'dshj-empty-title' }, catalog.cards.length === 0 ? t('noWorkspaces') : t('noMatches')),
          catalog.cards.length === 0 ? null : h('div', null, t('noResultsHint')),
        );
      }
      return h('div', { className: 'dshj-grid-wrap' },
        h('div', { className: 'dshj-grid-head' },
          h('span', null, query.trim() === '' ? t('workspaces') : t('results')),
          h('span', { className: 'dshj-grid-count' }, catalog.visible.length),
        ),
        h('div', { className: 'dshj-grid', id: 'dshj-grid', role: 'listbox', 'aria-label': t('workspaces') },
          catalog.visible.map((card, index) => renderCard({
            card,
            index,
            active: index === activeCard,
            setActiveCard,
            iconPickerId,
            iconPrefs,
            t,
            openDetail,
            chooseSession,
            chooseIcon,
            setIconPickerId,
            focusInput,
          })),
        ),
      );
    }

    /** One workspace card. */
    function renderCard({ card, index, active, setActiveCard, iconPickerId, iconPrefs, t, openDetail, chooseSession, chooseIcon, setIconPickerId, focusInput }) {
      const icon = iconFor(iconPrefs, card.id);
      return h('div', {
        key: card.id,
        id: `dshj-card-${index}`,
        className: 'dshj-card',
        role: 'option',
        'aria-selected': active,
        'data-card-active': active ? 'true' : undefined,
        'data-active-item': active ? 'true' : undefined,
        'aria-label': `${t('openWorkspace', { workspace: card.title })} · ${countLabel(card.activeCount, 'activeCountOne', 'activeCount', t)}`,
        onClick: () => openDetail(card.id),
        onMouseEnter: () => setActiveCard(index),
      },
        h('div', { className: 'dshj-card-head' },
          h('button', {
            type: 'button',
            className: 'dshj-card-icon',
            tabIndex: -1,
            title: t('changeIcon'),
            'aria-label': `${t('changeIcon')}: ${card.title}`,
            onClick: (event) => {
              event.stopPropagation();
              setIconPickerId(iconPickerId === card.id ? null : card.id);
              focusInput();
            },
          }, icon.char),
          h('div', { className: 'dshj-card-text' },
            h('div', { className: 'dshj-card-title' }, card.title),
            card.path === '' ? null : h('div', { className: 'dshj-card-path' }, card.path),
            h('div', { className: 'dshj-card-meta' },
              card.signal === undefined ? null : h('span', { className: 'dshj-card-signal', 'data-state': card.signal }),
              h('span', {
                className: 'dshj-card-active',
                'data-empty': card.activeCount === 0 ? 'true' : undefined,
              }, countLabel(card.activeCount, 'activeCountOne', 'activeCount', t)),
            ),
          ),
          h('span', { className: 'dshj-card-open', 'aria-hidden': true }, iconChevronRight()),
        ),
        iconPickerId === card.id ? renderIconPicker(card, chooseIcon, t) : null,
        h('div', { className: 'dshj-card-list' },
          card.listed.length === 0
            ? h('div', { className: 'dshj-card-empty' },
              card.total === 0 ? t('noConversations') : t('noActiveConversations'))
            : card.listed.map((entry) => renderCardConversation(entry, chooseSession, t)),
          card.more > 0 ? h('div', { className: 'dshj-card-more' }, t('moreActive', { count: card.more })) : null,
        ),
      );
    }

    /** One conversation row inside a card. */
    function renderCardConversation(entry, chooseSession, t) {
      return h('button', {
        type: 'button',
        key: entry.id,
        className: 'dshj-card-conv',
        tabIndex: -1,
        title: `${entry.displayTitle} · ${stateLabel(entry.state, entry.pending, t)}`,
        onClick: (event) => {
          event.stopPropagation();
          chooseSession(entry.id);
        },
      },
        h('span', { className: 'dshj-dot', 'data-state': entry.state }),
        h('span', { className: 'dshj-card-conv-title' }, entry.displayTitle),
        h('span', { className: 'dshj-card-conv-time' }, relativeTime(entry.interactedAt, t)),
      );
    }

    /** Inline icon choices for one workspace. */
    function renderIconPicker(card, chooseIcon, t) {
      return h('div', {
        className: 'dshj-icon-row',
        onClick: (event) => event.stopPropagation(),
      },
        ICON_CHOICES.map((choice) => h('button', {
          type: 'button',
          key: choice.id,
          className: 'dshj-icon-choice',
          tabIndex: -1,
          title: t(choice.labelKey),
          'aria-label': t(choice.labelKey),
          onClick: (event) => {
            event.stopPropagation();
            chooseIcon(card.id, choice.id);
          },
        }, choice.char)),
      );
    }

    /** One workspace's full conversation list. */
    function renderDetail({ card, entries, query, activeConv, setActiveConv, iconPickerId, iconPrefs, t, backToGrid, chooseSession, chooseIcon, setIconPickerId, startNew, focusInput }) {
      const icon = iconFor(iconPrefs, card.id);
      const filtering = query.trim() !== '';
      return h('div', { className: 'dshj-detail' },
        h('div', { className: 'dshj-detail-head' },
          h('button', {
            type: 'button',
            className: 'dshj-back',
            tabIndex: -1,
            title: t('back'),
            'aria-label': t('back'),
            onClick: () => backToGrid(),
          }, iconChevronLeft()),
          h('button', {
            type: 'button',
            className: 'dshj-detail-icon',
            tabIndex: -1,
            title: t('changeIcon'),
            'aria-label': `${t('changeIcon')}: ${card.title}`,
            onClick: () => {
              setIconPickerId(iconPickerId === card.id ? null : card.id);
              focusInput();
            },
          }, icon.char),
          h('div', { className: 'dshj-detail-titles' },
            h('div', { className: 'dshj-detail-title' }, card.title),
            card.path === '' ? null : h('div', { className: 'dshj-detail-path' }, card.path),
          ),
          h('div', { className: 'dshj-detail-meta' },
            card.signal === undefined ? null : h('span', { className: 'dshj-card-signal', 'data-state': card.signal }),
            h('span', { className: 'dshj-detail-active' }, countLabel(card.activeCount, 'activeCountOne', 'activeCount', t)),
          ),
          card.workspace === null ? null : h('button', {
            type: 'button',
            className: 'dshj-detail-new',
            tabIndex: -1,
            onClick: () => startNew(card.id),
          }, iconPlus(11), t('newSession')),
        ),
        iconPickerId === card.id ? renderIconPicker(card, chooseIcon, t) : null,
        h('div', { className: 'dshj-detail-section' },
          h('span', null, filtering ? t('results') : t('allConversations')),
          h('span', { className: 'dshj-detail-count' }, entries.length),
        ),
        entries.length === 0
          ? h('div', {
            className: 'dshj-empty dshj-empty-detail',
            id: 'dshj-detail-list',
            role: 'listbox',
            'aria-label': t('allConversations'),
          },
            h('div', { className: 'dshj-empty-title' }, filtering ? t('noMatches') : t('noConversations')),
            filtering ? h('div', null, t('noResultsHint')) : null,
          )
          : h('div', {
            className: 'dshj-detail-list',
            id: 'dshj-detail-list',
            role: 'listbox',
            'aria-label': t('allConversations'),
          }, entries.map((entry, index) => renderDetailRow(entry, index, index === activeConv, setActiveConv, chooseSession, t))),
      );
    }

    /** One row in a workspace's full conversation list. */
    function renderDetailRow(entry, index, active, setActiveConv, chooseSession, t) {
      const showState = entry.state === 'waiting' || entry.state === 'done' || entry.state === 'error';
      const meta = [relativeTime(entry.interactedAt, t)];
      if (entry.subagents !== null && entry.subagents !== undefined && entry.subagents.running > 0) {
        meta.push(countLabel(entry.subagents.running, 'subagentsRunningOne', 'subagentsRunning', t));
      }
      return h('button', {
        type: 'button',
        key: entry.id,
        id: `dshj-conv-${index}`,
        className: 'dshj-row dshj-detail-row',
        role: 'option',
        'aria-selected': active,
        'data-active': active ? 'true' : 'false',
        'data-active-item': active ? 'true' : undefined,
        tabIndex: -1,
        onMouseEnter: () => setActiveConv(index),
        onClick: () => chooseSession(entry.id),
      },
        h('span', { className: 'dshj-dot', 'data-state': entry.state }),
        h('span', { className: 'dshj-title' }, entry.displayTitle),
        entry.current ? h('span', { className: 'dshj-chip' }, t('current')) : null,
        showState
          ? h('span', {
            className: 'dshj-chip',
            'data-tone': entry.state === 'waiting' ? 'active' : undefined,
          }, stateLabel(entry.state, entry.pending, t))
          : null,
        h('span', { className: 'dshj-meta' }, meta.filter((part) => part !== '').join(' · ')),
      );
    }

    /** Status strip: current state plus other sessions that need attention. */
    function JumpStatusStrip(props) {
      return h(SilentBoundary, null, h(JumpStatusStripBody, props));
    }

    function JumpStatusStripBody(props) {
      const {
        store, t, sessionId, useSessions, useSessionStatus, useSession, useProjection,
      } = props;
      const list = useSessions((value) => value) ?? EMPTY_LIST;
      const statuses = useSessionStatus((value) => value) ?? EMPTY_STATUSES;
      const snapshot = useSession((value) => value);
      const catalog = useProjection('subagentCatalog');
      const row = list?.byId?.[sessionId];
      const status = statuses?.get?.(sessionId);
      const state = sessionState(status, row, snapshot);

      let otherRunning = 0;
      let otherWaiting = 0;
      let otherDone = 0;
      for (const id of list.ids ?? []) {
        if (id === sessionId) continue;
        const other = list?.byId?.[id];
        if (!navigable(other)) continue;
        const otherStatus = statuses?.get?.(id);
        if (otherStatus?.pendingInteraction !== undefined) otherWaiting += 1;
        else if ((otherStatus?.running ?? other.running) === true) otherRunning += 1;
        else if (otherStatus?.completionUnread === true) otherDone += 1;
      }

      let runningChildren = 0;
      if (Array.isArray(catalog)) {
        for (const child of catalog) {
          const childStatus = statuses?.get?.(child.id);
          const childRow = list?.byId?.[child.id];
          if ((childStatus?.running ?? childRow?.running) === true) runningChildren += 1;
        }
      }

      const label = stateLabel(state, status?.pendingInteraction, t);
      const tone = state === 'waiting' || otherWaiting > 0
        ? 'warning'
        : state === 'error'
          ? 'error'
          : state === 'done' || otherDone > 0
            ? 'success'
            : undefined;
      const details = [];
      if (runningChildren > 0) details.push(countLabel(runningChildren, 'subagentsRunningOne', 'subagentsRunning', t));
      if (otherWaiting > 0) details.push(countLabel(otherWaiting, 'otherWaitingOne', 'otherWaiting', t));
      if (otherDone > 0) details.push(countLabel(otherDone, 'otherDoneOne', 'otherDone', t));
      if (otherRunning > 0) details.push(countLabel(otherRunning, 'otherRunningOne', 'otherRunning', t));

      const aria = [t('statusAria'), label, ...details].join(' · ');
      const attention = tone === undefined ? {} : { 'data-attention': tone };

      return h('button', {
        type: 'button',
        className: 'dshj-status',
        title: `${aria} — ${t('statusOpen')} (${hotkeyLabel()})`,
        'aria-label': `${aria}. ${t('statusOpen')} (${hotkeyLabel()})`,
        'aria-keyshortcuts': hotkeyAria(),
        ...attention,
        onClick: () => store.open(),
      },
        h('span', { className: 'dshj-dot', 'data-state': state }),
        h('span', { className: 'dshj-status-label' }, label),
        runningChildren > 0 ? h('span', { className: 'dshj-status-detail' },
          countLabel(runningChildren, 'subagentsRunningOne', 'subagentsRunning', t)) : null,
        otherWaiting > 0 || otherDone > 0 || otherRunning > 0 ? h('span', { className: 'dshj-status-sep' }) : null,
        otherWaiting > 0 ? h('span', { className: 'dshj-status-detail dshj-warn' },
          countLabel(otherWaiting, 'otherWaitingOne', 'otherWaiting', t)) : null,
        otherDone > 0 ? h('span', { className: 'dshj-status-detail dshj-done' },
          countLabel(otherDone, 'otherDoneOne', 'otherDone', t)) : null,
        otherRunning > 0 ? h('span', { className: 'dshj-status-detail' },
          countLabel(otherRunning, 'otherRunningOne', 'otherRunning', t)) : null,
        h('span', { className: 'dshj-status-icon' }, iconSearch(11)),
      );
    }

    return {
      inject: ['slots', 'locale', 'uiWorkspace'],
      apply(ctx) {
        const store = createJumpStore();
        const t = ctx.locale.bind(NS);
        const openSession = (sessionId) => ctx.uiWorkspace.openSession(sessionId);
        const startSession = (workspaceId) => ctx.uiWorkspace.startSession(workspaceId);

        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'jump-to: dictionaries');
        ctx.effect(() => installStyles(), 'jump-to: styles');

        ctx.effect(() => {
          if (typeof window === 'undefined') return undefined;
          const onKeyDown = (event) => {
            if (event.defaultPrevented === true || event.isComposing === true || event.repeat === true) return;
            const mac = isMacPlatform();
            const primary = mac ? event.metaKey : event.ctrlKey;
            const secondary = mac ? event.ctrlKey : event.metaKey;
            if (primary !== true || secondary === true || event.altKey === true || event.shiftKey !== true) return;
            if (event.code !== 'KeyE' && String(event.key).toLowerCase() !== 'e') return;
            const target = event.target;
            if (typeof Element !== 'undefined' && target instanceof Element) {
              if (target.closest('.xterm') !== null || target.closest('[data-terminal]') !== null) return;
              const modal = target.closest('[aria-modal="true"]');
              if (modal !== null && modal.closest('.dshj-panel') !== modal) return;
            }
            event.preventDefault();
            event.stopPropagation();
            const state = store.getSnapshot();
            if (state.open) store.close();
            else store.open();
          };
          window.addEventListener('keydown', onKeyDown, true);
          return () => window.removeEventListener('keydown', onKeyDown, true);
        }, 'jump-to: toggle hotkey');

        ctx.slots.inject('conversation.session.header.actions', () =>
          ctx.slots.register({
            name: 'conversation.session.header.actions',
            id: 'jump-to',
            order: 30,
            locale: NS,
            inject: () => ({ store }),
          }, JumpHeaderAction),
        );

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({
            name: 'conversation.composer.dock',
            id: 'jump-status',
            order: 2,
            locale: NS,
            inject: () => ({ store }),
          }, JumpStatusStrip),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({
            name: 'shell.overlay',
            id: 'jump-to',
            order: 50,
            locale: NS,
            inject: () => ({ store, openSession, startSession }),
          }, JumpOverlayHost),
        );
      },
    };
  },
});
