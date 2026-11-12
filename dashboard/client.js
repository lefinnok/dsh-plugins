/**
 * Browser half of the Agent Dashboard (`@local/dsh-dashboard`).
 *
 * A root `main` panel beside Plugins and Schedules. It joins live Session,
 * Workspace, and status snapshots with the dashboard host activity route and the
 * usage monitor's token/context/cost route. No business state is persisted here
 * except the four browser-local agent pins.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-dashboard',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    const NS = 'dashboard'
    const PANEL_ID = 'dashboard'
    const STYLE_KEY = 'dsh-dashboard'
    const ACTIVITY_ROUTE = '/api/dashboard.activity'
    const USAGE_ROUTE = '/api/usage.series?days=14'
    const PINS_KEY = 'dsh-dashboard.pins.v1'
    const MAX_PINS = 4
    const ACTIVITY_POLL_MS = 2000
    const USAGE_POLL_MS = 10000

    const EMPTY_LIST = { ids: [], byId: {}, phase: 'pending', projectionsBySession: {} }
    const EMPTY_WORKSPACES = {
      items: [],
      archivedSessionIds: [],
      pinnedSessionIds: [],
      state: 'idle',
      phase: 'pending',
      error: null,
    }
    const EMPTY_STATUSES = new Map()

    const en = {
      nav: 'Dashboard',
      title: 'Dashboard',
      subtitle: 'Today at a glance',
      refresh: 'Refresh',
      refreshNow: 'Refresh usage and activity',
      updated: 'Updated {time}',
      waitingData: 'Waiting for data',
      stale: 'Showing last data; refresh failed.',
      usage: 'Usage',
      today: 'Today',
      sessionTotals: 'Session totals',
      tokensInput: 'Input',
      tokensOutput: 'Output',
      tokensCacheRead: 'Cache read',
      tokensCacheWrite: 'Cache write',
      tokensTracked: 'Tracked since {time}',
      context: 'Context',
      noWorkspace: 'No workspace',
      costToday: 'Cost today',
      hottest: 'Hottest agent',
      spendToday: 'Spend today',
      remaining: 'Remaining',
      budget: 'Budget',
      budgetUsed: '{percent}% of budget',
      noUsage: 'Usage data is unavailable.',
      costUnavailable: 'Cost data is unavailable.',
      activeAgents: 'Active agents',
      slots: '4 slots',
      noActiveAgent: 'No active agent',
      noActiveHint: 'Pin one from the list or wait for new work.',
      pin: 'Pin',
      unpin: 'Unpin',
      pinAgent: 'Pin {title}',
      unpinAgent: 'Unpin {title}',
      pinLimit: 'Four pinned agents is the limit. Unpin one first.',
      pinned: 'Pinned',
      noPins: 'Pin an agent from a card or the list to keep it here.',
      attention: 'Attention',
      nothingNeedsAttention: 'Nothing needs attention.',
      waitingApproval: 'Waiting for approval',
      planReview: 'Plan awaiting review',
      waitingAnswer: 'Waiting for answer',
      failed: 'Last turn failed',
      done: 'Done',
      idle: 'Idle',
      working: 'Working',
      subagentWorking: 'Subagent working',
      allAgents: 'All agents',
      activeGroup: 'Active',
      todayGroup: 'Today',
      noAgents: 'No agents today.',
      current: 'Current',
      noRecentActivity: 'No recent activity yet.',
      lastPrompt: 'Last prompt {time}',
      tokensToday: 'Tokens today',
      tokensShort: 'Tokens',
      subagentsShort: 'Subagents',
      lastActivity: 'Last activity',
      you: 'You',
      promptSent: 'Prompt sent',
      assistantResponded: 'Assistant responded',
      toolFailed: '{name} failed',
      toolFallback: 'Tool',
      turnStart: 'Turn started',
      turnCompleted: 'Turn completed',
      turnFailed: 'Turn failed',
      turnStopped: 'Turn stopped',
      turnBlocked: 'Turn blocked',
      turnMaxTokens: 'Turn hit max tokens',
      turnEnded: 'Turn ended',
      subagentStart: 'Subagent started',
      subagentFinish: 'Subagent finished',
      activityUnavailable: 'Activity feed unavailable.',
      renderFailed: 'Dashboard failed to render. Refresh the page.',
      openAgent: 'Open {title}',
      justNow: 'just now',
      minutesAgo: '{count}m ago',
      hoursAgo: '{count}h ago',
      daysAgo: '{count}d ago',
    }

    const zh = {
      nav: '仪表盘',
      title: '仪表盘',
      subtitle: '今日概览',
      refresh: '刷新',
      refreshNow: '刷新用量与活动',
      updated: '更新于 {time}',
      waitingData: '正在等待数据',
      stale: '显示上次数据，刷新失败。',
      usage: '用量',
      today: '今天',
      sessionTotals: '会话总量',
      tokensInput: '输入',
      tokensOutput: '输出',
      tokensCacheRead: '缓存读取',
      tokensCacheWrite: '缓存写入',
      tokensTracked: '开始记录 {time}',
      context: '上下文',
      noWorkspace: '无工作区',
      costToday: '今日花费',
      hottest: '最活跃代理',
      spendToday: '今日花费',
      remaining: '剩余',
      budget: '预算',
      budgetUsed: '已用预算 {percent}%',
      noUsage: '暂无用量数据。',
      costUnavailable: '暂无费用数据。',
      activeAgents: '活跃代理',
      slots: '4 个位置',
      noActiveAgent: '暂无活跃代理',
      noActiveHint: '可从列表中固定一个，或等待新任务。',
      pin: '固定',
      unpin: '取消固定',
      pinAgent: '固定 {title}',
      unpinAgent: '取消固定 {title}',
      pinLimit: '最多固定 4 个代理，请先取消一个。',
      pinned: '已固定',
      noPins: '从卡片或列表中固定代理，让它留在这里。',
      attention: '待处理',
      nothingNeedsAttention: '没有需要处理的事项。',
      waitingApproval: '等待批准',
      planReview: '计划待审',
      waitingAnswer: '等待回答',
      failed: '上轮失败',
      done: '已完成',
      idle: '空闲',
      working: '运行中',
      subagentWorking: '子代理运行中',
      allAgents: '全部代理',
      activeGroup: '活跃',
      todayGroup: '今天',
      noAgents: '今天还没有代理。',
      current: '当前',
      noRecentActivity: '暂无最近活动。',
      lastPrompt: '上次输入 {time}',
      tokensToday: '今日 Token',
      tokensShort: 'Token',
      subagentsShort: '子代理',
      lastActivity: '最近活动',
      you: '你',
      promptSent: '已发送输入',
      assistantResponded: '助手已回复',
      toolFailed: '{name} 失败',
      toolFallback: '工具',
      turnStart: '回合开始',
      turnCompleted: '回合完成',
      turnFailed: '回合失败',
      turnStopped: '回合已停止',
      turnBlocked: '回合被阻止',
      turnMaxTokens: '回合达到 Token 上限',
      turnEnded: '回合结束',
      subagentStart: '子代理启动',
      subagentFinish: '子代理结束',
      activityUnavailable: '活动流不可用。',
      renderFailed: '仪表盘渲染失败，请刷新页面。',
      openAgent: '打开 {title}',
      justNow: '刚刚',
      minutesAgo: '{count} 分钟前',
      hoursAgo: '{count} 小时前',
      daysAgo: '{count} 天前',
    }

    const CSS = `
.dsd-root{display:flex;flex-direction:column;gap:14px;min-height:100%;height:100%;box-sizing:border-box;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:22px 24px 26px;font-size:13px}
.dsd-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:none}
.dsd-title{font-size:24px;font-weight:600;line-height:32px;letter-spacing:-.01em}
.dsd-sub{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsd-header-actions{display:flex;align-items:center;gap:8px;flex:none}
.dsd-stale{color:var(--dsw-alias-state-warn-primary);font-size:11px;line-height:16px}
.dsd-refresh{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.dsd-refresh:hover{background:var(--dsw-alias-bg-layer-2)}
.dsd-refresh:disabled{opacity:.55;cursor:default}
.dsd-body{display:grid;grid-template-columns:minmax(0,2fr) minmax(300px,.95fr);gap:16px;align-items:start;min-height:0;flex:1}
.dsd-left{display:flex;flex-direction:column;gap:14px;min-width:0}
.dsd-right{display:flex;flex-direction:column;gap:12px;min-width:0}
.dsd-panel{border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);min-width:0;overflow:hidden}
.dsd-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dsd-panel-title{font-size:12px;font-weight:600;line-height:18px;letter-spacing:.01em}
.dsd-panel-sub{color:var(--dsw-alias-label-secondary);font-size:10px;line-height:15px}
.dsd-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:17px;padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:17px}
.dsd-usage-body{padding:12px 14px 14px}
.dsd-token-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.dsd-token-cell{border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);padding:8px 9px;min-width:0}
.dsd-token-label{display:flex;align-items:center;gap:4px;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:9px;line-height:13px;letter-spacing:.04em;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}
.dsd-token-swatch{flex:none;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-label-secondary)}
.dsd-token-swatch[data-tone=input]{background:var(--dsw-alias-brand-primary)}
.dsd-token-swatch[data-tone=output]{background:var(--dsw-alias-state-success-primary)}
.dsd-token-swatch[data-tone=cacheRead]{background:var(--dsw-alias-state-warn-primary)}
.dsd-token-swatch[data-tone=cacheWrite]{background:var(--dsw-alias-label-secondary)}
.dsd-token-value{overflow:hidden;margin-top:1px;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600;line-height:21px;text-overflow:ellipsis;font-variant-numeric:tabular-nums;white-space:nowrap}
.dsd-cost-summary{display:flex;align-items:center;gap:14px;padding:10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}
.dsd-cost-ring-block{display:flex;flex-direction:column;align-items:center;gap:2px;flex:none}
.dsd-ring{--dsd-deg:0deg;position:relative;display:grid;place-items:center;flex:none;width:58px;height:58px;border-radius:50%;background:conic-gradient(var(--dsw-alias-brand-primary) var(--dsd-deg),var(--dsw-alias-bg-layer-1) 0)}
.dsd-ring[data-high=true]{background:conic-gradient(var(--dsw-alias-state-warn-primary) var(--dsd-deg),var(--dsw-alias-bg-layer-1) 0)}
.dsd-ring-inner{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:16px}
.dsd-cost-ring-value{max-width:42px;overflow:hidden;font-size:9px;line-height:12px;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}
.dsd-cost-ring-label{max-width:100%;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:9px;line-height:13px;text-overflow:ellipsis;white-space:nowrap}
.dsd-cost-detail{display:flex;flex-direction:column;gap:5px;flex:1;min-width:0}
.dsd-cost-empty{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.dsd-token-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:12px 0 6px}
.dsd-token-head-label{color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:600;letter-spacing:.04em;line-height:14px;text-transform:uppercase}
.dsd-token-head-value{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:20px;font-variant-numeric:tabular-nums}
.dsd-cost-line{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:11px;line-height:16px}
.dsd-cost-label{color:var(--dsw-alias-label-secondary)}
.dsd-cost-value{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.dsd-budget-track{height:5px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}
.dsd-budget-fill{height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary)}
.dsd-budget-fill[data-over=true]{background:var(--dsw-alias-state-error-primary)}
.dsd-usage-foot{margin-top:9px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:15px}
.dsd-inline-error{margin-top:8px;color:var(--dsw-alias-state-warn-primary);font-size:11px;line-height:16px}
.dsd-agents-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px 14px 14px}
.dsd-card{position:relative;display:flex;flex-direction:column;gap:9px;min-width:0;min-height:196px;padding:12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;transition:border-color .12s ease,background-color .12s ease}
.dsd-card:hover{border-color:var(--dsw-alias-border-l2)}
.dsd-card-open{position:absolute;inset:0;z-index:1;padding:0;border:0;border-radius:12px;background:transparent;cursor:pointer}
.dsd-card-open:focus-visible{outline:none}
.dsd-card-status,.dsd-card-head,.dsd-card-activity,.dsd-card-bottom{position:relative;z-index:2;pointer-events:none}
.dsd-card .dsd-pin{position:relative;z-index:3;pointer-events:auto}
.dsd-card:focus-within{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsd-card[data-state=waiting]{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,var(--dsw-alias-border-l1))}
.dsd-card[data-state=error]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,var(--dsw-alias-border-l1))}
.dsd-card-status{display:flex;align-items:center;gap:6px;margin:-12px -12px 0;padding:5px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1);border-radius:12px 12px 0 0;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);min-width:0}
.dsd-card-status[data-state=running]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-brand-primary)}
.dsd-card-status[data-state=waiting]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-warn-primary)}
.dsd-card-status[data-state=error]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-error-primary)}
.dsd-card-status[data-state=done]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-success-primary)}
.dsd-card-status-dot{flex:none;width:5px;height:5px;border-radius:50%;background:currentColor}
.dsd-card-status-label{overflow:hidden;font-size:9px;font-weight:600;letter-spacing:.06em;line-height:13px;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}
.dsd-card-head{display:flex;align-items:flex-start;gap:8px;min-width:0}
.dsd-state-dot{flex:none;width:7px;height:7px;margin-top:5px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
.dsd-state-dot[data-state=running]{background:var(--dsw-alias-brand-primary)}
.dsd-state-dot[data-state=waiting]{background:var(--dsw-alias-state-warn-primary)}
.dsd-state-dot[data-state=done]{background:var(--dsw-alias-state-success-primary)}
.dsd-state-dot[data-state=error]{background:var(--dsw-alias-state-error-primary)}
.dsd-card-titleblock{flex:1;min-width:0}
.dsd-card-title{overflow:hidden;font-size:13px;font-weight:600;line-height:18px;text-overflow:ellipsis;white-space:nowrap}
.dsd-card-workspace{overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:15px;text-overflow:ellipsis;white-space:nowrap}
.dsd-pin{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsd-pin:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsd-pin[data-pinned=true]{color:var(--dsw-alias-brand-primary)}
.dsd-card-activity{display:flex;flex-direction:column;gap:3px;min-height:78px;padding:7px 8px;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.dsd-activity-row{display:flex;align-items:center;gap:6px;min-width:0;line-height:17px}
.dsd-activity-dot{flex:none;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-label-secondary)}
.dsd-activity-dot[data-kind=input]{background:var(--dsw-alias-brand-primary)}
.dsd-activity-dot[data-kind=output]{background:var(--dsw-alias-state-success-primary)}
.dsd-activity-dot[data-kind=tool]{background:var(--dsw-alias-label-secondary)}
.dsd-activity-dot[data-kind=error]{background:var(--dsw-alias-state-error-primary)}
.dsd-activity-dot[data-kind=waiting]{background:var(--dsw-alias-state-warn-primary)}
.dsd-activity-dot[data-kind=subagent]{background:var(--dsw-alias-state-warn-primary)}
.dsd-activity-text{flex:1;min-width:0;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:11px;line-height:17px;text-overflow:ellipsis;white-space:nowrap}
.dsd-activity-time{flex:none;color:var(--dsw-alias-label-secondary);font-size:9px;line-height:14px}
.dsd-activity-empty{padding:2px 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.dsd-card-bottom{display:flex;align-items:center;gap:8px;margin-top:auto}
.dsd-card-context{display:flex;flex-direction:column;align-items:center;gap:2px;flex:none}
.dsd-card-ring{--dsd-deg:0deg;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:conic-gradient(var(--dsw-alias-brand-primary) var(--dsd-deg),var(--dsw-alias-bg-layer-2) 0)}
.dsd-card-ring[data-high=true]{background:conic-gradient(var(--dsw-alias-state-warn-primary) var(--dsd-deg),var(--dsw-alias-bg-layer-2) 0)}
.dsd-card-ring-inner{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:9px;font-weight:600;line-height:12px;font-variant-numeric:tabular-nums}
.dsd-card-context-label{color:var(--dsw-alias-label-secondary);font-size:8px;line-height:11px;letter-spacing:.04em;text-transform:uppercase}
.dsd-card-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;flex:1;min-width:0}
.dsd-card-stat{min-width:0;padding:4px 6px;border-radius:6px;background:var(--dsw-alias-bg-layer-2)}
.dsd-card-stat-label{overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:9px;line-height:12px;text-overflow:ellipsis;white-space:nowrap}
.dsd-card-stat-value{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:11px;font-weight:500;line-height:16px;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}
.dsd-empty-card{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;min-height:196px;border:.5px dashed var(--dsw-alias-border-l2);border-radius:12px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;text-align:center;padding:16px}
.dsd-empty-card-title{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:500;line-height:17px}
.dsd-pin-list{display:flex;flex-direction:column;gap:2px;padding:6px 8px 8px}
.dsd-pin-row{display:flex;align-items:center;gap:2px;min-width:0}
.dsd-pin-open{display:flex;align-items:center;gap:7px;flex:1;min-width:0;height:30px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.dsd-pin-open:hover{background:var(--dsw-alias-bg-layer-2)}
.dsd-pin-open-title{flex:1;min-width:0;overflow:hidden;font-size:12px;line-height:17px;text-overflow:ellipsis;white-space:nowrap}
.dsd-pin-open-ws{flex:none;max-width:36%;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:9px;line-height:14px;text-overflow:ellipsis;white-space:nowrap}
.dsd-pin-empty{padding:9px 10px 11px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.dsd-pin-notice{padding:0 12px 9px;color:var(--dsw-alias-state-warn-primary);font-size:10px;line-height:15px}
.dsd-attention-list{display:flex;flex-direction:column;gap:1px;max-height:238px;overflow:auto;padding:6px 8px 8px}
.dsd-attention-row{display:flex;align-items:flex-start;gap:8px;width:100%;min-width:0;padding:6px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.dsd-attention-row:hover{background:var(--dsw-alias-bg-layer-2)}
.dsd-attention-copy{flex:1;min-width:0}
.dsd-attention-top{display:flex;align-items:center;gap:6px;min-width:0}
.dsd-attention-title{flex:1;min-width:0;overflow:hidden;font-size:12px;line-height:17px;text-overflow:ellipsis;white-space:nowrap}
.dsd-attention-kind{flex:none;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-primary);font-size:9px;line-height:15px;white-space:nowrap}
.dsd-attention-kind[data-kind=done]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);color:var(--dsw-alias-state-success-primary)}
.dsd-attention-kind[data-kind=failed]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary)}
.dsd-attention-meta{overflow:hidden;margin-top:1px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:15px;text-overflow:ellipsis;white-space:nowrap}
.dsd-attention-empty{padding:12px 14px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.dsd-agent-panel{display:flex;flex-direction:column;min-height:260px}
.dsd-agent-body{min-height:0;max-height:44vh;overflow:auto;padding:4px 8px 10px}
.dsd-group-label{padding:8px 6px 3px;color:var(--dsw-alias-label-secondary);font-size:9px;font-weight:600;letter-spacing:.06em;line-height:13px;text-transform:uppercase}
.dsd-agent-row{display:flex;align-items:center;gap:2px;min-width:0;border-radius:7px}
.dsd-agent-row:hover{background:var(--dsw-alias-bg-layer-2)}
.dsd-agent-main{display:flex;align-items:center;gap:7px;flex:1;min-width:0;padding:5px 6px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;overflow:hidden;text-align:left;cursor:pointer}
.dsd-agent-copy{display:flex;flex-direction:column;flex:1;min-width:0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,#000 0%,#000 calc(100% - 18px),transparent 100%);mask-image:linear-gradient(90deg,#000 0%,#000 calc(100% - 18px),transparent 100%);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}
.dsd-agent-title{display:block;max-width:100%;overflow:hidden;font-size:12px;line-height:17px;text-overflow:ellipsis;white-space:nowrap}
.dsd-agent-meta{display:block;max-width:100%;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:9px;line-height:14px;text-overflow:ellipsis;white-space:nowrap}
.dsd-agent-empty{padding:16px 12px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px;text-align:center}
.dsd-nav-icon{display:inline-flex;align-items:center;justify-content:center;color:currentColor}
.dsd-header-button{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:.5px solid transparent;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsd-header-button:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsd-refresh:focus-visible,.dsd-pin:focus-visible,.dsd-pin-open:focus-visible,.dsd-attention-row:focus-visible,.dsd-agent-main:focus-visible,.dsd-header-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
@media (max-width:1180px){.dsd-body{grid-template-columns:1fr}.dsd-right{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.dsd-agent-panel{grid-column:1/-1}.dsd-agent-body{max-height:none;overflow:visible}}
@media (max-width:760px){.dsd-root{padding:16px}.dsd-token-row{grid-template-columns:repeat(2,minmax(0,1fr))}.dsd-agents-grid{grid-template-columns:1fr}.dsd-right{grid-template-columns:1fr}.dsd-card-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (prefers-reduced-motion:no-preference){.dsd-state-dot[data-state=running]{animation:dsd-pulse 1.6s ease-in-out infinite}}
@keyframes dsd-pulse{0%,100%{opacity:1}50%{opacity:.35}}
`

    /** Install the dashboard stylesheet once per document. */
    function installStyles() {
      const stale = document.querySelectorAll(`style[data-plugin-css="${STYLE_KEY}"]`)
      for (const node of stale) node.remove()
      const tag = document.createElement('style')
      tag.dataset.pluginCss = STYLE_KEY
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        if (tag.isConnected) tag.remove()
      }
    }

    /** First path segment, for a workspace without a title. */
    function workspaceTitle(workspace) {
      if (!workspace) return ''
      const title = String(workspace.title ?? '').trim()
      if (title !== '') return title
      const path = String(workspace.path ?? '').replace(/[\\/]+$/u, '')
      const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
      return slash >= 0 ? path.slice(slash + 1) : path
    }

    /** The main view retains the selected Session. */
    function isCurrent(row) {
      const retained = row?.retainedBy?.mainView
      return typeof retained === 'number' && retained > 0
    }

    /** Local midnight in milliseconds. */
    function startOfTodayMs() {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      return start.getTime()
    }

    /** Compact token count. */
    function formatToken(value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '0'
      if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`
      if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k`
      return String(Math.round(number))
    }

    /** Sum the four durable token buckets. */
    function tokenTotal(buckets) {
      if (!buckets) return 0
      return (
        (Number(buckets.uncachedInputTokens) || 0) +
        (Number(buckets.outputTokens) || 0) +
        (Number(buckets.cacheReadTokens) || 0) +
        (Number(buckets.cacheWriteTokens) || 0)
      )
    }

    /** Sum several token buckets. */
    function addTokens(target, source) {
      if (!source) return target
      for (const key of ['uncachedInputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']) {
        target[key] += Number(source[key]) || 0
      }
      return target
    }

    /** Zero token buckets. */
    function zeroTokens() {
      return { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    }

    /** Context percentage from projected or pressure tokens. */
    function contextPercent(context) {
      const window = Number(context?.contextWindow)
      const used = Number(context?.projectedTokens ?? context?.pressureTokens)
      if (!Number.isFinite(window) || window <= 0 || !Number.isFinite(used)) return null
      return Math.min(100, Math.round((used / window) * 100))
    }

    /** Relative age. */
    function relativeTime(time, now, t) {
      if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0) return ''
      const minutes = Math.floor(Math.max(0, now - time) / 60000)
      if (minutes < 1) return t('justNow')
      if (minutes < 60) return t('minutesAgo', { count: minutes })
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return t('hoursAgo', { count: hours })
      return t('daysAgo', { count: Math.floor(hours / 24) })
    }

    /** Whether the page runs on a macOS-family platform. */
    function isMacPlatform() {
      if (typeof navigator === 'undefined') return false
      const platform = navigator.userAgentData?.platform ?? navigator.platform ?? ''
      return /mac|iphone|ipad|ipod/i.test(platform)
    }

    /** Dashboard toggle label. */
    function hotkeyLabel() {
      return isMacPlatform() ? '⌘E' : 'Ctrl+E'
    }

    /** Dashboard toggle ARIA spelling. */
    function hotkeyAria() {
      return isMacPlatform() ? 'Meta+E' : 'Control+E'
    }

    /** Long local date for the header. */
    function formatDay(now) {
      try {
        return new Intl.DateTimeFormat(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        }).format(new Date(now))
      } catch {
        return new Date(now).toDateString()
      }
    }

    /** Currency amount. */
    function formatMoney(value, currency) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(number)
      } catch {
        return `${currency} ${number.toFixed(2)}`
      }
    }

    /** State label for a dot / row. */
    function stateLabel(state, pending, t) {
      if (state === 'waiting') {
        switch (pending?.kind) {
          case 'approval':
            return t('waitingApproval')
          case 'plan-review':
            return t('planReview')
          case 'question':
            return t('waitingAnswer')
          default:
            return t('waitingAnswer')
        }
      }
      if (state === 'running') return t('working')
      if (state === 'error') return t('failed')
      if (state === 'done') return t('done')
      return t('idle')
    }

    /** State label, distinguishing a child-only running parent. */
    function agentStatusLabel(agent, t) {
      if (agent.state === 'running' && agent.subagentOnlyRunning === true) {
        return t('subagentWorking')
      }
      return stateLabel(agent.state, agent.pending, t)
    }

    /** Locale key for a pending interaction. */
    function pendingKey(pending) {
      switch (pending?.kind) {
        case 'approval':
          return 'waitingApproval'
        case 'plan-review':
          return 'planReview'
        default:
          return 'waitingAnswer'
      }
    }

    /** Read up to four browser-local pins. */
    function readPins() {
      try {
        if (typeof localStorage === 'undefined') return []
        const parsed = JSON.parse(localStorage.getItem(PINS_KEY) ?? '[]')
        if (!Array.isArray(parsed)) return []
        const seen = new Set()
        const out = []
        for (const value of parsed) {
          if (typeof value !== 'string' || value === '' || seen.has(value)) continue
          seen.add(value)
          out.push(value)
          if (out.length === MAX_PINS) break
        }
        return out
      } catch {
        return []
      }
    }

    /** Persist the pin list. */
    function writePins(pins) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(PINS_KEY, JSON.stringify(pins))
      } catch {
        /* storage can be unavailable */
      }
    }

    /** Translate a structured host activity item. */
    function activityLine(item, t) {
      const variant = item?.variant ?? item?.kind ?? 'text'
      switch (variant) {
        case 'input':
          return item.text === '' ? t('promptSent') : `${t('you')}: ${item.text}`
        case 'output':
          return item.text === '' ? t('assistantResponded') : item.text
        case 'tool':
          return item.detail ? `${item.text}: ${item.detail}` : item.text || '—'
        case 'tool-failed':
          return t('toolFailed', { name: item.text || t('toolFallback') })
        case 'waiting-answer':
          return t('waitingAnswer')
        case 'turn-start':
          return t('turnStart')
        case 'turn-completed':
          return t('turnCompleted')
        case 'turn-failed':
          return t('turnFailed')
        case 'turn-stopped':
          return t('turnStopped')
        case 'turn-blocked':
          return t('turnBlocked')
        case 'turn-max-tokens':
          return t('turnMaxTokens')
        case 'turn-ended':
          return t('turnEnded')
        case 'subagent-start':
          return t('subagentStart')
        case 'subagent-finish':
          return t('subagentFinish')
        default:
          return item?.text || ''
      }
    }

    /** Build the dashboard model from live snapshots and both host routes. */
    function buildModel({ list, workspaces, statuses, activity, usage, pins }) {
      const archived = new Set(workspaces?.archivedSessionIds ?? [])
      const byWorkspaceSession = new Map()
      for (const workspace of workspaces?.items ?? []) {
        for (const id of workspace.sessionIds ?? []) byWorkspaceSession.set(id, workspace)
      }
      const usageSessions = usage?.tokens?.sessions ?? {}
      const todayStart = startOfTodayMs()
      const agents = []
      for (const id of list?.ids ?? []) {
        const row = list?.byId?.[id]
        if (!row || row.blank === true || row.origin === 'subagent' || archived.has(id)) continue
        const status = statuses?.get?.(id)
        const feed = activity?.sessions?.[id]
        const projection = list?.projectionsBySession?.[id]?.values ?? {}
        const lastPromptAt = Number(projection.sessionListMetadata?.lastPromptAt) || 0
        const feedAt = Number(feed?.lastActivityAt) || 0
        const lastActivityAt =
          feedAt > 0 ? feedAt : Math.max(lastPromptAt, Number(row.updatedAt) || 0)
        const parentRunning = (status?.running ?? row.running) === true
        const pending = status?.pendingInteraction
        const completed = status?.completionUnread === true
        const failed = feed?.failed === true
        const pinned = pins.includes(id)
        const subagents = projection.subagentCatalog
        let subagentsTotal = 0
        let subagentsRunning = 0
        if (Array.isArray(subagents)) {
          subagentsTotal = subagents.length
          for (const child of subagents) {
            const childStatus = statuses?.get?.(child.id)
            const childRow = list?.byId?.[child.id]
            if ((childStatus?.running ?? childRow?.running) === true) subagentsRunning += 1
          }
        }
        const running = parentRunning || subagentsRunning > 0
        const subagentOnlyRunning = subagentsRunning > 0 && !parentRunning
        const relevant =
          lastActivityAt >= todayStart || running || pending !== undefined || completed || pinned
        if (!relevant) continue
        const state =
          pending !== undefined
            ? 'waiting'
            : running
              ? 'running'
              : failed
                ? 'error'
                : completed
                  ? 'done'
                  : 'idle'
        const context = usageSessions[id]?.context ?? projection.contextPressure ?? null
        const tokensToday = usageSessions[id]?.today ?? null
        const tokensTotals = usageSessions[id]?.totals ?? projection.tokenUsage ?? null
        const tokensDisplay = tokensToday ?? tokensTotals
        const tokensFallback = tokensToday === null && tokensTotals !== null
        const workspace = byWorkspaceSession.get(id)
        agents.push({
          id,
          row,
          title: row.displayTitle || id,
          workspace,
          workspaceTitle: workspaceTitle(workspace),
          state,
          pending,
          failed,
          completed,
          running,
          parentRunning,
          subagentOnlyRunning,
          lastActivityAt,
          lastPromptAt,
          rankAt: lastActivityAt,
          items: Array.isArray(feed?.items) ? feed.items : [],
          tokensToday,
          tokensTotals,
          tokensDisplay,
          tokensFallback,
          context,
          contextPercent: contextPercent(context),
          subagentsRunning,
          subagentsTotal,
          current: isCurrent(row),
          pinned,
        })
      }
      agents.sort(
        (left, right) =>
          right.rankAt - left.rankAt || left.title.localeCompare(right.title),
      )
      const byAgentId = new Map(agents.map((agent) => [agent.id, agent]))
      const pinnedAgents = pins.map((id) => byAgentId.get(id)).filter(Boolean)
      const cards = []
      for (const agent of pinnedAgents) if (cards.length < 4) cards.push(agent)
      for (const agent of agents) {
        if (cards.length >= 4) break
        if (!agent.pinned) cards.push(agent)
      }

      const attention = []
      for (const agent of agents) {
        let priority = -1
        let labelKey = null
        let kind = 'pending'
        if (agent.pending !== undefined) {
          priority = 0
          labelKey = pendingKey(agent.pending)
          kind = 'pending'
        } else if (agent.failed && !agent.running) {
          priority = 1
          labelKey = 'failed'
          kind = 'failed'
        } else if (agent.completed) {
          priority = 2
          labelKey = 'done'
          kind = 'done'
        }
        if (priority < 0) continue
        attention.push({ agent, priority, labelKey, kind, at: agent.lastActivityAt })
      }
      attention.sort(
        (left, right) =>
          left.priority - right.priority ||
          (left.priority === 0 ? left.at - right.at : right.at - left.at) ||
          left.agent.title.localeCompare(right.agent.title),
      )

      let fallbackTokens = zeroTokens()
      for (const agent of agents) fallbackTokens = addTokens(fallbackTokens, agent.tokensTotals)
      const routeTokens = usage?.tokens ?? null
      const tokens = routeTokens
        ? { today: routeTokens.today, trackedSince: routeTokens.trackedSince, fallback: false }
        : { today: fallbackTokens, trackedSince: null, fallback: true }

      return {
        agents,
        pinnedAgents,
        cards,
        attention,
        activeAgents: agents.filter(
          (agent) => !agent.pinned && (agent.running || agent.pending !== undefined),
        ),
        todayAgents: agents.filter(
          (agent) => !agent.pinned && !(agent.running || agent.pending !== undefined),
        ),
        hottest: agents.slice().sort((left, right) => right.rankAt - left.rankAt)[0] ?? null,
        tokens,
        cost: usage?.cost ?? null,
        updatedAt: Math.max(Number(activity?.updatedAt) || 0, Number(usage?.updatedAt) || 0),
      }
    }

    /** Dashboard grid mark. */
    function iconGrid(size = 18) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          'aria-hidden': true,
        },
        h('rect', { x: 2, y: 2, width: 5, height: 5, rx: 1 }),
        h('rect', { x: 9, y: 2, width: 5, height: 5, rx: 1 }),
        h('rect', { x: 2, y: 9, width: 5, height: 5, rx: 1 }),
        h('rect', { x: 9, y: 9, width: 5, height: 5, rx: 1 }),
      )
    }

    /** Bookmark/pin mark. */
    function iconPin(size = 14, filled = false) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: filled ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M4 2.5h8v11l-4-2.8-4 2.8z' }),
      )
    }

    /** Refresh mark. */
    function iconRefresh(size = 13) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M13 7a5 5 0 1 0-.5 3' }),
        h('path', { d: 'M13 3.5V7H9.5' }),
      )
    }

    /** Sidebar panellist mark. */
    function DashboardIcon({ size = 18, active = false }) {
      return h(
        'span',
        { className: 'dsd-nav-icon', 'data-active': active ? 'true' : undefined },
        iconGrid(size),
      )
    }

    /** Conversation-header return button. */
    function DashboardHeaderAction({ t, openDashboard }) {
      return h(
        'button',
        {
          type: 'button',
          className: 'dsd-header-button',
          title: `${t('nav')} (${hotkeyLabel()})`,
          'aria-label': `${t('nav')} (${hotkeyLabel()})`,
          'aria-keyshortcuts': hotkeyAria(),
          onClick: openDashboard,
        },
        iconGrid(14),
      )
    }

    /** One panel heading. */
    function panelHead(title, count, extra) {
      return h(
        'div',
        { className: 'dsd-panel-head' },
        h('div', { className: 'dsd-panel-title' }, title),
        count === undefined || count === null
          ? null
          : h('span', { className: 'dsd-count' }, String(count)),
        extra ?? null,
      )
    }

    /** The dashboard page. */
    function DashboardPanel(props) {
      const { t, useSessions, useWorkspaces, useSessionStatus, usePanelInfo, openSession } = props
      const list = useSessions((value) => value) ?? EMPTY_LIST
      const workspaces = useWorkspaces((value) => value) ?? EMPTY_WORKSPACES
      const statuses = useSessionStatus((value) => value) ?? EMPTY_STATUSES
      const panel = usePanelInfo((value) => value)
      const active = panel === null || panel === undefined ? true : panel.activePanelId === PANEL_ID

      const [activity, setActivity] = useState(null)
      const [usage, setUsage] = useState(null)
      const [activityError, setActivityError] = useState(null)
      const [usageError, setUsageError] = useState(null)
      const [pins, setPins] = useState(readPins)
      const [pinNotice, setPinNotice] = useState(null)
      const [now, setNow] = useState(() => Date.now())
      const [refreshing, setRefreshing] = useState(false)
      const aliveRef = useRef(true)
      const activityPromise = useRef(null)
      const usagePromise = useRef(null)

      const fetchActivity = async (force = false) => {
        if (activityPromise.current !== null) {
          if (!force) return activityPromise.current
          await activityPromise.current.catch(() => undefined)
        }
        const run = (async () => {
          try {
            const response = await fetch(ACTIVITY_ROUTE, {
              headers: { accept: 'application/json' },
              cache: 'no-store',
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            if (aliveRef.current) {
              setActivity(data)
              setActivityError(null)
            }
          } catch (error) {
            if (aliveRef.current) setActivityError(error instanceof Error ? error.message : String(error))
          }
        })()
        activityPromise.current = run
        try {
          await run
        } finally {
          if (activityPromise.current === run) activityPromise.current = null
        }
      }

      const fetchUsage = async (force = false) => {
        if (usagePromise.current !== null) {
          if (!force) return usagePromise.current
          await usagePromise.current.catch(() => undefined)
        }
        const run = (async () => {
          try {
            const response = await fetch(force ? `${USAGE_ROUTE}&refresh=1` : USAGE_ROUTE, {
              headers: { accept: 'application/json' },
              cache: 'no-store',
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            if (aliveRef.current) {
              setUsage(data)
              setUsageError(null)
            }
          } catch (error) {
            if (aliveRef.current) setUsageError(error instanceof Error ? error.message : String(error))
          }
        })()
        usagePromise.current = run
        try {
          await run
        } finally {
          if (usagePromise.current === run) usagePromise.current = null
        }
      }

      useEffect(() => {
        aliveRef.current = true
        return () => {
          aliveRef.current = false
        }
      }, [])

      useEffect(() => {
        if (!active) return
        void fetchActivity()
        void fetchUsage(false)
        const activityTimer = setInterval(() => {
          void fetchActivity()
        }, ACTIVITY_POLL_MS)
        const usageTimer = setInterval(() => {
          void fetchUsage(false)
        }, USAGE_POLL_MS)
        return () => {
          clearInterval(activityTimer)
          clearInterval(usageTimer)
        }
      }, [active])

      useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000)
        return () => clearInterval(timer)
      }, [])

      useEffect(() => {
        if (pinNotice === null) return
        const timer = setTimeout(() => setPinNotice(null), 4000)
        return () => clearTimeout(timer)
      }, [pinNotice])

      useEffect(() => {
        // Never treat a pending/partial snapshot as evidence that a pinned
        // Session was removed. Doing so would erase stored pins on every
        // early Dashboard mount or reconnect.
        if (list?.phase !== 'ready' || workspaces?.phase !== 'ready') return
        const archived = new Set(workspaces?.archivedSessionIds ?? [])
        const valid = pins.filter((id) => {
          const row = list?.byId?.[id]
          return row && row.blank !== true && row.origin !== 'subagent' && !archived.has(id)
        })
        if (valid.length !== pins.length) {
          setPins(valid)
          writePins(valid)
        }
      }, [pins, list, workspaces])

      const model = useMemo(
        () => buildModel({ list, workspaces, statuses, activity, usage, pins }),
        [list, workspaces, statuses, activity, usage, pins],
      )
      const stale = activityError !== null || usageError !== null

      const togglePin = (sessionId) => {
        if (pins.includes(sessionId)) {
          const next = pins.filter((id) => id !== sessionId)
          setPins(next)
          writePins(next)
          setPinNotice(null)
          return
        }
        if (pins.length >= MAX_PINS) {
          setPinNotice(t('pinLimit'))
          return
        }
        const next = [...pins, sessionId]
        setPins(next)
        writePins(next)
        setPinNotice(null)
      }

      const refreshAll = async () => {
        setRefreshing(true)
        try {
          await Promise.all([fetchActivity(false), fetchUsage(true)])
        } finally {
          setRefreshing(false)
        }
      }

      const open = (sessionId) => {
        openSession(sessionId)
      }

      const updated = model.updatedAt
        ? t('updated', { time: relativeTime(model.updatedAt, now, t) })
        : t('waitingData')

      return h(
        'div',
        { className: 'dsd-root' },
        h(
          'header',
          { className: 'dsd-header' },
          h(
            'div',
            null,
            h('div', { className: 'dsd-title' }, t('title')),
            h(
              'div',
              { className: 'dsd-sub' },
              `${formatDay(now)} · ${updated} · ${t('subtitle')}`,
            ),
          ),
          h(
            'div',
            { className: 'dsd-header-actions' },
            stale ? h('span', { className: 'dsd-stale' }, t('stale')) : null,
            h(
              'button',
              {
                type: 'button',
                className: 'dsd-refresh',
                title: t('refreshNow'),
                disabled: refreshing,
                onClick: () => {
                  void refreshAll()
                },
              },
              iconRefresh(),
              t('refresh'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dsd-body' },
          h(
            'div',
            { className: 'dsd-left' },
            h(UsagePanel, { model, now, t, usageError }),
            h(
              'section',
              { className: 'dsd-panel' },
              panelHead(t('activeAgents'), `${model.cards.length}/4`),
              h(
                'div',
                { className: 'dsd-agents-grid' },
                model.cards.map((agent) =>
                  h(AgentCard, {
                    key: agent.id,
                    agent,
                    now,
                    t,
                    onOpen: open,
                    onPin: togglePin,
                  }),
                ),
                Array.from({ length: Math.max(0, 4 - model.cards.length) }, (_, index) =>
                  h(EmptyCard, { key: `empty-${index}`, t }),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dsd-right' },
            h(PinnedPanel, {
              agents: model.pinnedAgents,
              notice: pinNotice,
              t,
              onOpen: open,
              onPin: togglePin,
            }),
            h(AttentionPanel, { items: model.attention, now, t, onOpen: open }),
            h(AgentListPanel, {
              model,
              now,
              t,
              onOpen: open,
              onPin: togglePin,
              activityError,
            }),
          ),
        ),
      )
    }

    /** Cost ring plus the budget row, then today's token total and buckets. */
    function UsagePanel({ model, now, t, usageError }) {
      const tokens = model.tokens
      const cost = model.cost
      const budget = cost?.budget?.amount > 0 ? cost.budget : null
      const currency = cost?.currency ?? budget?.currency ?? cost?.remaining?.[0]?.currency
      const fallbackSpent = currency
        ? cost?.today?.find((entry) => entry.currency === currency)?.spent ?? 0
        : 0
      const spend =
        cost === null || cost === undefined || cost.available === false
          ? null
          : typeof cost.spentToday === 'number'
            ? cost.spentToday
            : fallbackSpent
      const remaining = currency
        ? cost?.remaining?.find((entry) => entry.currency === currency) ?? null
        : null
      const budgetPercent = budget
        ? typeof budget.spent === 'number'
          ? Math.min(999, Math.round((budget.spent / budget.amount) * 100))
          : spend !== null
            ? Math.min(999, Math.round((spend / budget.amount) * 100))
            : null
        : null
      const totalTokens = tokenTotal(tokens.today)
      const costPct =
        budget && budgetPercent !== null ? Math.min(100, budgetPercent) : 0
      const costHigh = budgetPercent !== null && budgetPercent >= 80
      const cell = (label, value, tone) =>
        h(
          'div',
          { className: 'dsd-token-cell' },
          h(
            'div',
            { className: 'dsd-token-label' },
            h('span', { className: 'dsd-token-swatch', 'data-tone': tone }),
            label,
          ),
          h('div', { className: 'dsd-token-value' }, formatToken(value)),
        )
      return h(
        'section',
        { className: 'dsd-panel' },
        panelHead(
          t('usage'),
          null,
          h(
            'span',
            { className: 'dsd-panel-sub' },
            tokens.fallback ? t('sessionTotals') : t('today'),
          ),
        ),
        h(
          'div',
          { className: 'dsd-usage-body' },
          h(
            'div',
            { className: 'dsd-cost-summary' },
            h(
              'div',
              { className: 'dsd-cost-ring-block' },
              h(
                'div',
                {
                  className: 'dsd-ring dsd-cost-ring',
                  'data-high': costHigh ? 'true' : undefined,
                  style: { '--dsd-deg': `${costPct * 3.6}deg` },
                },
                h(
                  'div',
                  { className: 'dsd-ring-inner dsd-cost-ring-value' },
                  spend === null ? '—' : formatMoney(spend, currency),
                ),
              ),
              h('div', { className: 'dsd-cost-ring-label' }, t('costToday')),
            ),
            h(
              'div',
              { className: 'dsd-cost-detail' },
              spend === null
                ? h('div', { className: 'dsd-cost-empty' }, t('costUnavailable'))
                : h(
                    React.Fragment,
                    null,
                    remaining
                      ? h(
                          'div',
                          { className: 'dsd-cost-line' },
                          h('span', { className: 'dsd-cost-label' }, t('remaining')),
                          h(
                            'span',
                            { className: 'dsd-cost-value' },
                            formatMoney(
                              (Number(remaining.normal) || 0) + (Number(remaining.bonus) || 0),
                              currency,
                            ),
                          ),
                        )
                      : null,
                    budget && budgetPercent !== null
                      ? h(
                          React.Fragment,
                          null,
                          h(
                            'div',
                            { className: 'dsd-cost-line' },
                            h('span', { className: 'dsd-cost-label' }, t('budget')),
                            h(
                              'span',
                              { className: 'dsd-cost-value' },
                              t('budgetUsed', { percent: budgetPercent }),
                            ),
                          ),
                          h(
                            'div',
                            { className: 'dsd-budget-track' },
                            h('div', {
                              className: 'dsd-budget-fill',
                              'data-over': budgetPercent > 100 ? 'true' : undefined,
                              style: { width: `${Math.min(100, budgetPercent)}%` },
                            }),
                          ),
                        )
                      : null,
                    !remaining && !budget
                      ? h('div', { className: 'dsd-cost-empty' }, t('costUnavailable'))
                      : null,
                  ),
            ),
          ),
          h(
            'div',
            { className: 'dsd-token-head' },
            h('span', { className: 'dsd-token-head-label' }, t('tokensToday')),
            h('span', { className: 'dsd-token-head-value' }, formatToken(totalTokens)),
          ),
          h(
            'div',
            { className: 'dsd-token-row' },
            cell(t('tokensInput'), tokens.today?.uncachedInputTokens, 'input'),
            cell(t('tokensOutput'), tokens.today?.outputTokens, 'output'),
            cell(t('tokensCacheRead'), tokens.today?.cacheReadTokens, 'cacheRead'),
            cell(t('tokensCacheWrite'), tokens.today?.cacheWriteTokens, 'cacheWrite'),
          ),
          tokens.trackedSince
            ? h(
                'div',
                { className: 'dsd-usage-foot' },
                t('tokensTracked', { time: relativeTime(tokens.trackedSince, now, t) }),
              )
            : null,
          usageError ? h('div', { className: 'dsd-inline-error' }, t('noUsage')) : null,
        ),
      )
    }

    /** One of the four agent cards. */
    function AgentCard({ agent, now, t, onOpen, onPin }) {
      const items = agent.items.slice(-3).reverse()
      const lastPrompt = agent.lastPromptAt > 0 ? relativeTime(agent.lastPromptAt, now, t) : ''
      const statusLabel = agentStatusLabel(agent, t)
      const latest = items[0] ? activityLine(items[0], t) : ''
      const contextPct =
        agent.contextPercent === null
          ? null
          : Math.min(100, Math.max(0, agent.contextPercent))
      const contextHigh = contextPct !== null && contextPct >= 80
      return h(
        'article',
        {
          className: 'dsd-card',
          'data-state': agent.state,
        },
        h('button', {
          type: 'button',
          className: 'dsd-card-open',
          'aria-label': `${t('openAgent', { title: agent.title })} — ${statusLabel}`,
          title: `${t('openAgent', { title: agent.title })} · ${statusLabel}${
            latest === '' ? '' : ` · ${latest}`
          }`,
          onClick: () => onOpen(agent.id),
        }),
        h(
          'div',
          { className: 'dsd-card-status', 'data-state': agent.state },
          h('span', { className: 'dsd-card-status-dot' }),
          h('span', { className: 'dsd-card-status-label' }, statusLabel),
        ),
        h(
          'div',
          { className: 'dsd-card-head' },
          h(
            'div',
            { className: 'dsd-card-titleblock' },
            h('div', { className: 'dsd-card-title', title: agent.title }, agent.title),
            h(
              'div',
              { className: 'dsd-card-workspace' },
              agent.workspaceTitle === '' ? t('noWorkspace') : agent.workspaceTitle,
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsd-pin',
              'data-pinned': agent.pinned ? 'true' : undefined,
              'aria-pressed': agent.pinned,
              title: agent.pinned ? t('unpinAgent', { title: agent.title }) : t('pinAgent', { title: agent.title }),
              'aria-label': agent.pinned
                ? t('unpinAgent', { title: agent.title })
                : t('pinAgent', { title: agent.title }),
              onClick: (event) => {
                event.stopPropagation()
                onPin(agent.id)
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
              },
            },
            iconPin(14, agent.pinned),
          ),
        ),
        h(
          'div',
          { className: 'dsd-card-activity' },
          items.length > 0
            ? items.map((item, index) =>
                h(
                  'div',
                  { className: 'dsd-activity-row', key: `${item.seq}-${index}` },
                  h('span', { className: 'dsd-activity-dot', 'data-kind': item.kind }),
                  h(
                    'span',
                    { className: 'dsd-activity-text', title: activityLine(item, t) },
                    activityLine(item, t),
                  ),
                  h(
                    'span',
                    { className: 'dsd-activity-time' },
                    relativeTime(item.time, now, t),
                  ),
                ),
              )
            : h(
                'div',
                { className: 'dsd-activity-empty' },
                lastPrompt === ''
                  ? t('noRecentActivity')
                  : t('lastPrompt', { time: lastPrompt }),
              ),
        ),
        h(
          'div',
          { className: 'dsd-card-bottom' },
          h(
            'div',
            { className: 'dsd-card-context' },
            h(
              'div',
              {
                className: 'dsd-card-ring',
                'data-high': contextHigh ? 'true' : undefined,
                style: { '--dsd-deg': `${(contextPct ?? 0) * 3.6}deg` },
              },
              h(
                'div',
                { className: 'dsd-card-ring-inner' },
                contextPct === null ? '—' : `${contextPct}%`,
              ),
            ),
            h('div', { className: 'dsd-card-context-label' }, t('context')),
          ),
          h(
            'div',
            { className: 'dsd-card-stats' },
            h(
              'div',
              {
                className: 'dsd-card-stat',
                title: agent.tokensFallback ? t('sessionTotals') : undefined,
              },
              h('div', { className: 'dsd-card-stat-label' }, t('tokensShort')),
              h(
                'div',
                { className: 'dsd-card-stat-value' },
                agent.tokensDisplay ? formatToken(tokenTotal(agent.tokensDisplay)) : '—',
              ),
            ),
            h(
              'div',
              { className: 'dsd-card-stat' },
              h('div', { className: 'dsd-card-stat-label' }, t('subagentsShort')),
              h(
                'div',
                { className: 'dsd-card-stat-value' },
                agent.subagentsTotal === 0
                  ? '0'
                  : `${agent.subagentsRunning}/${agent.subagentsTotal}`,
              ),
            ),
            h(
              'div',
              { className: 'dsd-card-stat' },
              h('div', { className: 'dsd-card-stat-label' }, t('lastActivity')),
              h(
                'div',
                { className: 'dsd-card-stat-value' },
                relativeTime(agent.lastActivityAt, now, t) || '—',
              ),
            ),
          ),
        ),
      )
    }

    /** Empty slot in the 2x2 grid. */
    function EmptyCard({ t }) {
      return h(
        'div',
        { className: 'dsd-empty-card' },
        h('div', { className: 'dsd-empty-card-title' }, t('noActiveAgent')),
        h('div', null, t('noActiveHint')),
      )
    }

    /** Pinned agent strip. */
    function PinnedPanel({ agents, notice, t, onOpen, onPin }) {
      return h(
        'section',
        { className: 'dsd-panel' },
        panelHead(t('pinned'), agents.length),
        agents.length === 0
          ? h('div', { className: 'dsd-pin-empty' }, t('noPins'))
          : h(
              'div',
              { className: 'dsd-pin-list' },
              agents.map((agent) =>
                h(
                  'div',
                  { className: 'dsd-pin-row', key: agent.id },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsd-pin-open',
                      onClick: () => onOpen(agent.id),
                      title: `${t('openAgent', { title: agent.title })} — ${agentStatusLabel(
                        agent,
                        t,
                      )}`,
                      'aria-label': `${t('openAgent', { title: agent.title })} — ${agentStatusLabel(
                        agent,
                        t,
                      )}`,
                    },
                    h('span', {
                      className: 'dsd-state-dot',
                      'data-state': agent.state,
                      'aria-hidden': 'true',
                    }),
                    h('span', { className: 'dsd-pin-open-title' }, agent.title),
                    h(
                      'span',
                      { className: 'dsd-pin-open-ws' },
                      agent.workspaceTitle || t('noWorkspace'),
                    ),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsd-pin',
                      'data-pinned': 'true',
                      'aria-pressed': 'true',
                      'aria-label': t('unpinAgent', { title: agent.title }),
                      title: t('unpin'),
                      onClick: () => onPin(agent.id),
                    },
                    iconPin(13, true),
                  ),
                ),
              ),
            ),
        notice ? h('div', { className: 'dsd-pin-notice', role: 'status' }, notice) : null,
      )
    }

    /** Attention rows. */
    function AttentionPanel({ items, now, t, onOpen }) {
      return h(
        'section',
        { className: 'dsd-panel' },
        panelHead(t('attention'), items.length),
        items.length === 0
          ? h('div', { className: 'dsd-attention-empty' }, t('nothingNeedsAttention'))
          : h(
              'div',
              { className: 'dsd-attention-list' },
              items.map((item) =>
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsd-attention-row',
                    key: item.agent.id,
                    onClick: () => onOpen(item.agent.id),
                    title: t('openAgent', { title: item.agent.title }),
                  },
                  h('span', { className: 'dsd-state-dot', 'data-state': item.agent.state }),
                  h(
                    'span',
                    { className: 'dsd-attention-copy' },
                    h(
                      'span',
                      { className: 'dsd-attention-top' },
                      h('span', { className: 'dsd-attention-title' }, item.agent.title),
                      h('span', { className: 'dsd-attention-kind', 'data-kind': item.kind }, t(item.labelKey)),
                    ),
                    h(
                      'span',
                      { className: 'dsd-attention-meta' },
                      `${item.agent.workspaceTitle || t('noWorkspace')} · ${
                        relativeTime(item.at, now, t) || t('justNow')
                      }`,
                    ),
                  ),
                ),
              ),
            ),
      )
    }

    /** Full today's agent list. */
    function AgentListPanel({ model, now, t, onOpen, onPin, activityError }) {
      const groups = [
        { key: 'pinned', label: t('pinned'), items: model.pinnedAgents },
        { key: 'active', label: t('activeGroup'), items: model.activeAgents },
        { key: 'today', label: t('todayGroup'), items: model.todayAgents },
      ].filter((group) => group.items.length > 0)
      const row = (agent) =>
        h(
          'div',
          { className: 'dsd-agent-row', key: agent.id },
          h(
            'button',
            {
              type: 'button',
              className: 'dsd-agent-main',
              onClick: () => onOpen(agent.id),
              title: `${t('openAgent', { title: agent.title })} — ${agentStatusLabel(
                agent,
                t,
              )}`,
              'aria-label': `${t('openAgent', { title: agent.title })} — ${agentStatusLabel(
                agent,
                t,
              )}`,
            },
            h('span', {
              className: 'dsd-state-dot',
              'data-state': agent.state,
              'aria-hidden': 'true',
            }),
            h(
              'span',
              { className: 'dsd-agent-copy' },
              h('span', { className: 'dsd-agent-title' }, agent.title),
              h(
                'span',
                {
                  className: 'dsd-agent-meta',
                  title: `${agent.workspaceTitle || t('noWorkspace')} · ${
                    relativeTime(agent.lastActivityAt, now, t) || t('justNow')
                  } · ${agent.tokensDisplay ? formatToken(tokenTotal(agent.tokensDisplay)) : '—'} ${t('tokensShort')} · ${
                    agent.subagentsRunning
                  }/${agent.subagentsTotal} ${t('subagentsShort')} · ${t('context')} ${
                    agent.contextPercent === null ? '—' : `${agent.contextPercent}%`
                  }`,
                },
                `${agent.workspaceTitle || t('noWorkspace')} · ${
                  relativeTime(agent.lastActivityAt, now, t) || t('justNow')
                } · ${agent.tokensDisplay ? formatToken(tokenTotal(agent.tokensDisplay)) : '—'} ${t('tokensShort')} · ${
                  agent.subagentsRunning
                }/${agent.subagentsTotal} ${t('subagentsShort')} · ${t('context')} ${
                  agent.contextPercent === null ? '—' : `${agent.contextPercent}%`
                }`,
              ),
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsd-pin',
              'data-pinned': agent.pinned ? 'true' : undefined,
              'aria-pressed': agent.pinned,
              title: agent.pinned ? t('unpinAgent', { title: agent.title }) : t('pinAgent', { title: agent.title }),
              'aria-label': agent.pinned
                ? t('unpinAgent', { title: agent.title })
                : t('pinAgent', { title: agent.title }),
              onClick: () => onPin(agent.id),
            },
            iconPin(13, agent.pinned),
          ),
        )
      return h(
        'section',
        { className: 'dsd-panel dsd-agent-panel' },
        panelHead(
          t('allAgents'),
          model.agents.length,
          activityError ? h('span', { className: 'dsd-panel-sub' }, t('activityUnavailable')) : null,
        ),
        h(
          'div',
          { className: 'dsd-agent-body' },
          groups.length === 0
            ? h('div', { className: 'dsd-agent-empty' }, t('noAgents'))
            : groups.map((group) =>
                h(
                  'div',
                  { key: group.key },
                  h('div', { className: 'dsd-group-label' }, group.label),
                  group.items.map(row),
                ),
              ),
        ),
      )
    }

    /** Contain a render failure to the dashboard surface. */
    class DashboardBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      componentDidCatch() {}
      render() {
        if (this.state.failed) {
          return h(
            'div',
            { className: 'dsd-root' },
            h(
              'div',
              { className: 'dsd-empty-card' },
              this.props.t ? this.props.t('renderFailed') : 'Dashboard failed to render. Refresh the page.',
            ),
          )
        }
        return this.props.children
      }
    }

    function DashboardRoot(props) {
      return h(DashboardBoundary, { t: props.t }, h(DashboardPanel, props))
    }

    return {
      inject: ['slots', 'locale', 'layout', 'uiWorkspace'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        const openSession = (sessionId) => ctx.uiWorkspace.openSession(sessionId)
        const openDashboard = () => ctx.layout.selectPanel(PANEL_ID)

        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dashboard: dictionaries')
        ctx.effect(() => installStyles(), 'dashboard: styles')

        ctx.effect(() => {
          if (typeof window === 'undefined') return undefined
          const onKeyDown = (event) => {
            if (event.defaultPrevented === true || event.isComposing === true || event.repeat === true) return
            const mac = isMacPlatform()
            const primary = mac ? event.metaKey : event.ctrlKey
            const secondary = mac ? event.ctrlKey : event.metaKey
            if (primary !== true || secondary === true || event.altKey === true || event.shiftKey === true) return
            if (event.code !== 'KeyE' && String(event.key).toLowerCase() !== 'e') return
            const target = event.target
            if (typeof Element !== 'undefined' && target instanceof Element) {
              if (target.closest('.xterm') !== null || target.closest('[data-terminal]') !== null) return
              if (target.closest('[aria-modal="true"]') !== null) return
            }
            event.preventDefault()
            event.stopPropagation()
            const active = ctx.layout.panelInfo.getSnapshot().activePanelId
            if (active === PANEL_ID) ctx.layout.selectPanel(null)
            else ctx.layout.selectPanel(PANEL_ID)
          }
          window.addEventListener('keydown', onKeyDown, true)
          return () => window.removeEventListener('keydown', onKeyDown, true)
        }, 'dashboard: Ctrl+E')

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({ openSession }),
            },
            DashboardRoot,
          ),
        )
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: -10,
              locale: NS,
              label: () => t('nav'),
            },
            DashboardIcon,
          ),
        )
        ctx.slots.inject('conversation.session.header.actions', () =>
          ctx.slots.register(
            {
              name: 'conversation.session.header.actions',
              id: 'dashboard',
              order: 40,
              locale: NS,
              inject: () => ({ openDashboard }),
            },
            DashboardHeaderAction,
          ),
        )
      },
    }
  },
})
