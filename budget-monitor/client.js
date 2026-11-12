/**
 * Browser half of the DeepSeek usage monitor.
 *
 * Renders Settings → Usage (remaining balance, spend charts, a configurable
 * usage budget and average daily rates) and a compact meter at the sidebar
 * foot that tracks the same budget.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-budget-monitor',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useState, useSyncExternalStore } = React

    const NS = 'settings.usage'
    const STYLE_KEY = '@local/dsh-budget-monitor/usage.css'
    const SERIES_ROUTE = '/api/usage.series'
    const SETTINGS_ROUTE = '/api/usage.settings'
    const RANGE_DAYS = 14
    /** Translate function bound in `apply`, used when a slot omits `t`. */
    let boundTranslate = (key) => key

    const en = {
      nav: 'Usage',
      title: 'Remaining balance',
      bonusIncluded: 'Includes {value} bonus credit',
      updated: 'Updated {time}',
      waiting: 'Waiting for the first balance sample…',
      sampling: 'Sampled every {seconds}s while Harness runs',
      sourceApi: 'Source: DeepSeek API balance',
      sourceAccount: 'Source: DeepSeek account wallet',
      insufficient: 'Balance is not sufficient for API calls.',
      tabsMinute: 'Minutes',
      tabsHour: 'Hours',
      tabsDay: 'Days',
      spendTitle: 'Usage spend',
      spendSub: 'Balance decrease per bucket',
      remainingTitle: 'Remaining balance',
      remainingSub: 'Balance at the end of each bucket',
      lastHour: 'Last 60 min',
      today: 'Today',
      trackedSince: 'Tracked since',
      refresh: 'Refresh',
      avgHour: 'Avg / hour today',
      avgMinute: 'Avg / minute today',
      avgNote: 'Averaged over the tracked time today',
      budgetTitle: 'Usage budget',
      budgetHelp: 'Set how much you intend to spend per period.',
      amount: 'Amount',
      period: 'Period',
      currency: 'Currency',
      perDay: 'Per day',
      perHour: 'Per hour',
      perMinute: 'Per minute',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      clear: 'Clear',
      invalidAmount: 'Enter an amount of zero or more.',
      saveFailed: 'Could not save the budget.',
      spentDay: 'Spent today',
      spentHour: 'Spent this hour',
      spentMinute: 'Spent this minute',
      leftDay: 'left today',
      leftHour: 'left this hour',
      leftMinute: 'left this minute',
      overPeriod: 'over',
      resetDay: 'Resets at midnight',
      resetHour: 'Resets at the top of the hour',
      resetMinute: 'Resets every minute',
      setBudget: 'Set a budget to see how close you are.',
      budgetUnset: 'No budget set',
      periodToday: 'today',
      periodHour: 'this hour',
      periodMinute: 'this minute',
      perHourShort: 'per hour',
      perMinuteShort: 'per minute',
      avgPerHourShort: 'avg/h',
      avgPerMinuteShort: 'avg/min',
      topUp: 'Top-up',
      bonusShort: 'bonus',
      topUpOpen: 'Open the DeepSeek top-up page',
      signedOutTitle: 'No balance source found',
      signedOutBody:
        'Add a DeepSeek API key under Settings → Models, or sign in under Settings → Account, then come back.',
      unavailableTitle: 'No balance source configured',
      unavailableBody:
        'Set a DeepSeek API key in the launching environment or under Settings → Models to read your balance.',
      errorTitle: 'Could not read your balance',
      errorBody: 'The last balance request failed. Samples already collected are still shown below.',
      noSamples: 'No balance samples yet. Keep Harness running; the first sample appears within a minute.',
      noSpend: 'No spend in this window.',
      stale: 'Showing saved samples; the latest refresh failed.',
      foot: 'Spend is derived from balance decreases between samples; top-ups and bonus credits are not counted. The budget resets at the start of its period.',
      retry: 'Try again',
      loadFailed: 'Unable to load usage data.',
      chartSpend: 'Spend per {bucket}',
      chartRemaining: 'Remaining balance per {bucket}',
      bucketMinute: 'minute',
      bucketHour: 'hour',
      bucketDay: 'day',
      usedPercent: '{percent}% used',
      overBudget: 'Over budget',
      underBudget: 'Within budget',
      sidebarTitle: 'Usage',
      tokensTitle: "Today's tokens",
      tokensSub: 'Tracked consumption today',
      tokensUnavailable: 'Token data is unavailable. Mount the token meter and reload this page.',
      tokensNone: 'No token usage recorded today yet.',
      tokensInput: 'Input',
      tokensOutput: 'Output',
      tokensCacheRead: 'Cache read',
      tokensCacheWrite: 'Cache write',
      tokensContext: 'Context',
      tokensMore: '+{count} more',
      tokensTotal: '{value} today',
      offPeak: 'Off-peak · 50% off',
      peak: 'Peak pricing',
      offPeakShort: '50% off',
      peakShort: 'Full price',
      offPeakUntil: 'until {time}',
      peakUntil: 'until {time}',
    }

    const zh = {
      nav: '用量',
      title: '剩余余额',
      bonusIncluded: '含 {value} 赠送额度',
      updated: '更新于 {time}',
      waiting: '正在等待第一个余额采样…',
      sampling: 'Harness 运行期间每 {seconds} 秒采样一次',
      sourceApi: '来源：DeepSeek API 余额',
      sourceAccount: '来源：DeepSeek 账户钱包',
      insufficient: '余额不足以继续调用 API。',
      tabsMinute: '分钟',
      tabsHour: '小时',
      tabsDay: '天',
      spendTitle: '用量消耗',
      spendSub: '每个时间桶内的余额减少',
      remainingTitle: '剩余余额',
      remainingSub: '每个时间桶结束时的余额',
      lastHour: '最近 60 分钟',
      today: '今天',
      trackedSince: '开始记录',
      refresh: '刷新',
      avgHour: '今日平均/小时',
      avgMinute: '今日平均/分钟',
      avgNote: '按今日已记录时长平均',
      budgetTitle: '用量预算',
      budgetHelp: '设置你希望在每个周期内使用的金额。',
      amount: '金额',
      period: '周期',
      currency: '币种',
      perDay: '每天',
      perHour: '每小时',
      perMinute: '每分钟',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      clear: '清除',
      invalidAmount: '请输入大于等于 0 的金额。',
      saveFailed: '无法保存预算。',
      spentDay: '今日已用',
      spentHour: '本小时已用',
      spentMinute: '本分钟已用',
      leftDay: '今日剩余',
      leftHour: '本小时剩余',
      leftMinute: '本分钟剩余',
      overPeriod: '超出',
      resetDay: '每天 0 点重置',
      resetHour: '整点重置',
      resetMinute: '每分钟重置',
      setBudget: '设置预算后即可查看接近程度。',
      budgetUnset: '尚未设置预算',
      periodToday: '今天',
      periodHour: '本小时',
      periodMinute: '本分钟',
      perHourShort: '每小时',
      perMinuteShort: '每分钟',
      avgPerHourShort: '均/时',
      avgPerMinuteShort: '均/分',
      topUp: '充值',
      bonusShort: '赠送',
      topUpOpen: '打开 DeepSeek 充值页面',
      signedOutTitle: '未找到余额来源',
      signedOutBody: '请先在 设置 → 模型 中配置 DeepSeek API Key，或在 设置 → 账户 中登录。',
      unavailableTitle: '未配置余额来源',
      unavailableBody: '请在启动环境或 设置 → 模型 中配置 DeepSeek API Key，以读取余额。',
      errorTitle: '无法读取余额',
      errorBody: '最近一次余额请求失败，下方仍会显示已采集的采样。',
      noSamples: '还没有余额采样。请保持 Harness 运行，一分钟内会出现第一条采样。',
      noSpend: '该时间范围内没有消耗。',
      stale: '正在显示已保存的采样；最近一次刷新失败。',
      foot: '消耗由采样之间的余额减少推算；充值与赠送额度不计入。预算按所选周期开始时重置。',
      retry: '重试',
      loadFailed: '无法加载用量数据。',
      chartSpend: '每{bucket}消耗',
      chartRemaining: '每{bucket}剩余余额',
      bucketMinute: '分钟',
      bucketHour: '小时',
      bucketDay: '天',
      usedPercent: '{percent}% 已用',
      overBudget: '已超预算',
      underBudget: '预算内',
      sidebarTitle: '用量',
      tokensTitle: '今日 Token',
      tokensSub: '今日已记录的消耗',
      tokensUnavailable: '暂无 Token 数据。请确认 Token Meter 已加载后刷新。',
      tokensNone: '今天还没有 Token 消耗记录。',
      tokensInput: '输入',
      tokensOutput: '输出',
      tokensCacheRead: '缓存读取',
      tokensCacheWrite: '缓存写入',
      tokensContext: '上下文',
      tokensMore: '还有 {count} 个',
      tokensTotal: '今日 {value}',
      offPeak: '错峰 · 5 折',
      peak: '高峰价格',
      offPeakShort: '5 折',
      peakShort: '全价',
      offPeakUntil: '至 {time}',
      peakUntil: '至 {time}',
    }

    const RANGES = {
      minute: { size: 60 * 1000, count: 60 },
      hour: { size: 60 * 60 * 1000, count: 48 },
      day: { size: 24 * 60 * 60 * 1000, count: 30 },
    }

    const css = `
.dsu-root{display:flex;flex-direction:column;gap:16px;padding:8px 0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dsu-card{border:.5px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);padding:16px}
.dsu-hero{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px}
.dsu-kicker{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsu-amount{margin-top:2px;font-size:30px;line-height:38px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.dsu-amount small{margin-left:6px;color:var(--dsw-alias-label-secondary);font-size:14px;font-weight:400;letter-spacing:0}
.dsu-meta{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsu-stats{display:grid;grid-template-columns:repeat(3,minmax(84px,1fr));gap:12px;flex:1 1 300px;max-width:440px}
.dsu-stat{border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:10px 12px;min-width:0}
.dsu-stat-label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsu-stat-value{margin-top:2px;font-size:16px;line-height:24px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsu-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.dsu-card-title{font-size:13px;line-height:20px;font-weight:500}
.dsu-card-sub{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsu-tabs{display:inline-flex;gap:2px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:2px}
.dsu-tab{border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;padding:4px 10px;cursor:pointer}
.dsu-tab[aria-pressed=true]{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 0 0 .5px var(--dsw-alias-border-l1)}
.dsu-tab:focus-visible,.dsu-btn:focus-visible,.dsu-input:focus-visible,.dsu-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsu-chart{margin-top:12px;min-width:0}
.dsu-chart svg{display:block;width:100%;height:auto}
.dsu-banner{margin:0 0 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:10px 12px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsu-banner-error{color:var(--dsw-alias-state-error-primary)}
.dsu-empty{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:20px 0}
.dsu-empty-title{font-size:14px;line-height:22px;font-weight:500}
.dsu-empty-body{margin:0;max-width:560px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
.dsu-btn{border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;padding:5px 12px;cursor:pointer}
.dsu-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dsu-btn:disabled{color:var(--dsw-alias-label-secondary);cursor:default}
.dsu-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-label-primary-foreground);font-weight:500}
.dsu-btn-primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);opacity:.9}
.dsu-input,.dsu-select{box-sizing:border-box;height:32px;border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:0 10px}
.dsu-input{width:120px;font-variant-numeric:tabular-nums}
.dsu-editor{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}
.dsu-field{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px}
.dsu-progress{margin-top:12px}
.dsu-progress-label{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;font-size:12px;line-height:18px}
.dsu-progress-strong{font-size:14px;line-height:22px;font-weight:500;font-variant-numeric:tabular-nums}
.dsu-progress-track{height:8px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;margin-top:8px}
.dsu-progress-fill{height:100%;border-radius:4px;background:var(--dsw-alias-brand-primary);transition:width .2s}
.dsu-progress-fill-warn{background:var(--dsw-alias-state-warn-primary)}
.dsu-progress-fill-over{background:var(--dsw-alias-state-error-primary)}
.dsu-progress-foot{margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}
.dsu-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.dsu-foot{margin:0;padding:0 4px 8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsu-skeleton{height:14px;border-radius:7px;background:var(--dsw-alias-bg-layer-2);margin:6px 0}
.dsu-skeleton-wide{width:60%}
.dsu-skeleton-short{width:35%}
.dsu-meter{box-sizing:border-box;display:flex;flex-direction:column;gap:6px;width:100%;padding:2px 8px 10px;color:var(--dsw-alias-label-primary);font-size:11px;line-height:15px}
.dsu-meter-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.dsu-meter-title{font-size:12px;line-height:16px;font-weight:500}
.dsu-meter-pct{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dsu-meter-track{height:5px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.dsu-meter-fill{height:100%;border-radius:3px;background:var(--dsw-alias-brand-primary)}
.dsu-meter-fill-warn{background:var(--dsw-alias-state-warn-primary)}
.dsu-meter-fill-over{background:var(--dsw-alias-state-error-primary)}
.dsu-meter-line{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
.dsu-meter-line strong{color:var(--dsw-alias-label-primary);font-weight:500}
.dsu-meter-empty{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.dsu-rail{position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;margin:2px auto 6px}
.dsu-rail-dot{position:absolute;top:1px;right:1px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);border:1.5px solid var(--dsw-alias-bg-base)}
.dsu-rail-dot-off{background:var(--dsw-alias-state-success-primary)}
.dsu-statusline{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px}
.dsu-pill{display:inline-flex;align-items:center;gap:6px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 9px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;white-space:nowrap}
.dsu-pill-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);flex:none}
.dsu-pill-off{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dsu-pill-off .dsu-pill-dot{background:var(--dsw-alias-state-success-primary)}
.dsu-status-note{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;white-space:nowrap}
.dsu-price-chip{margin-left:6px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 5px;color:var(--dsw-alias-label-secondary);font-size:9px;line-height:14px;font-weight:400;vertical-align:1px}
.dsu-price-chip-off{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dsu-topup-link{display:inline-flex;align-items:baseline;gap:4px;border-radius:4px;color:inherit;text-decoration:none}
.dsu-topup-link:hover strong{text-decoration:underline;text-underline-offset:2px}
.dsu-topup-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsu-token-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
.dsu-token-cell{border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:8px 10px;min-width:0}
.dsu-token-label{color:var(--dsw-alias-label-secondary);font-size:10px;letter-spacing:.04em;text-transform:uppercase}
.dsu-token-value{color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600;line-height:22px;font-variant-numeric:tabular-nums}
.dsu-token-list{display:flex;flex-direction:column;gap:2px;margin-top:10px}
.dsu-token-row{display:flex;align-items:center;gap:8px;border-radius:6px;padding:5px 6px;font-size:12px}
.dsu-token-row:hover{background:var(--dsw-alias-bg-layer-2)}
.dsu-token-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsu-token-context{flex:none;color:var(--dsw-alias-label-secondary);font-size:10px;text-align:right;min-width:64px}
.dsu-token-amount{flex:none;color:var(--dsw-alias-label-primary);font-size:11px;font-variant-numeric:tabular-nums;text-align:right;min-width:54px}
.dsu-token-foot{color:var(--dsw-alias-label-secondary);font-size:11px;margin-top:6px}
@media (max-width:520px){.dsu-token-summary{grid-template-columns:1fr 1fr}.dsu-stats{grid-template-columns:1fr 1fr;max-width:none}.dsu-amount{font-size:26px;line-height:34px}}
`

    /** Install the shared stylesheet once for every slot this plugin fills. */
    function installStyles() {
      if (typeof document === 'undefined') return () => {}
      for (const stale of document.querySelectorAll(
        `style[data-plugin-css="${STYLE_KEY}"]`,
      )) {
        stale.remove()
      }
      const tag = document.createElement('style')
      tag.dataset.plugin = '@local/dsh-budget-monitor'
      tag.dataset.pluginCss = STYLE_KEY
      tag.textContent = css
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    // ---------------------------------------------------------------- helpers

    /** Current locale used for dates and numbers. */
    function pageLocale() {
      return document.documentElement.lang || navigator.language || 'en'
    }

    /** Format a currency amount with the account currency. */
    function money(value, currency) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      try {
        return new Intl.NumberFormat(pageLocale(), {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(number)
      } catch {
        return `${currency} ${number.toFixed(2)}`
      }
    }

    /** Format a rate with enough precision for per-minute spend. */
    function rate(value, currency) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      try {
        return new Intl.NumberFormat(pageLocale(), {
          style: 'currency',
          currency,
          minimumFractionDigits: number < 0.1 ? 3 : 2,
          maximumFractionDigits: number < 0.1 ? 3 : 2,
        }).format(number)
      } catch {
        return `${currency} ${number.toFixed(3)}`
      }
    }

    /** Format a timestamp in the page locale. */
    function timeLabel(timestamp) {
      if (typeof timestamp !== 'number') return '—'
      return new Date(timestamp).toLocaleTimeString(pageLocale(), {
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    /** Compact token count. */
    function tokenCount(value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '0'
      if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`
      if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k`
      return String(Math.round(number))
    }

    /** Sum the four durable token buckets. */
    function tokenTotalOf(buckets) {
      if (!buckets) return 0
      return (
        (Number(buckets.uncachedInputTokens) || 0) +
        (Number(buckets.outputTokens) || 0) +
        (Number(buckets.cacheReadTokens) || 0) +
        (Number(buckets.cacheWriteTokens) || 0)
      )
    }

    /** Context percentage, or pressure tokens when no window is declared. */
    function contextLabel(context) {
      const window = Number(context?.contextWindow)
      const used = Number(context?.projectedTokens ?? context?.pressureTokens)
      if (Number.isFinite(window) && window > 0 && Number.isFinite(used)) {
        return `${Math.min(999, Math.round((used / window) * 100))}%`
      }
      if (Number.isFinite(used) && used > 0) return tokenCount(used)
      return '—'
    }

    /** Format a bucket edge according to the active granularity. */
    function bucketLabel(timestamp, granularity) {
      const date = new Date(timestamp)
      if (granularity === 'day') {
        return date.toLocaleDateString(pageLocale(), { month: 'short', day: 'numeric' })
      }
      return date.toLocaleTimeString(pageLocale(), { hour: '2-digit', minute: '2-digit' })
    }

    /** Total of the recharge and bonus wallets of one currency in one sample. */
    function totalOf(wallets, currency) {
      const entry = wallets?.[currency]
      if (!entry) return null
      return (Number(entry.n) || 0) + (Number(entry.b) || 0)
    }

    /** Currency list of the latest balances. */
    function currenciesOf(data) {
      return (data?.wallets ?? []).map((wallet) => wallet.currency)
    }

    /** Local start of the current budget period. */
    function periodStart(period, now) {
      const date = new Date(now)
      if (period === 'minute') {
        date.setSeconds(0, 0)
        return date.getTime()
      }
      if (period === 'hour') {
        date.setMinutes(0, 0, 0)
        return date.getTime()
      }
      date.setHours(0, 0, 0, 0)
      return date.getTime()
    }

    /** Spend between two instants derived from consecutive samples. */
    function spendBetween(samples, currency, from, to) {
      let spend = 0
      if (!Array.isArray(samples)) return 0
      for (let index = 1; index < samples.length; index += 1) {
        const later = samples[index]
        if (later.t <= from || later.t > to) continue
        if (samples[index - 1].s !== later.s) continue
        const before = totalOf(samples[index - 1].w, currency)
        const after = totalOf(later.w, currency)
        if (before === null || after === null) continue
        const delta = after - before
        if (delta < -1e-9) spend -= delta
      }
      return spend
    }

    /**
     * Build the bucketed spend and remaining series.
     * @param data - Host snapshot.
     * @param granularity - minute, hour, or day.
     * @param currency - currency to project.
     * @param now - window end.
     */
    function buildSeries(data, granularity, currency, now) {
      const spec = RANGES[granularity]
      const start = now - spec.size * spec.count
      const samples = Array.isArray(data?.samples)
        ? data.samples
            .filter((sample) => sample && typeof sample.t === 'number' && sample.w)
            .slice()
            .sort((a, b) => a.t - b.t)
        : []
      const buckets = Array.from({ length: spec.count }, (_, index) => ({
        start: start + index * spec.size,
        end: start + (index + 1) * spec.size,
        spend: 0,
        credit: 0,
        remaining: null,
      }))

      let previous = null
      for (const sample of samples) {
        if (previous) {
          const before = totalOf(previous.w, currency)
          const after = totalOf(sample.w, currency)
          const index = Math.floor((sample.t - start) / spec.size)
          if (
            previous.s === sample.s &&
            before !== null &&
            after !== null &&
            index >= 0 &&
            index < spec.count
          ) {
            const delta = after - before
            if (delta < -1e-9) buckets[index].spend -= delta
            else if (delta > 1e-9) buckets[index].credit += delta
          }
        }
        previous = sample
      }

      let cursor = -1
      let current = null
      for (const sample of samples) {
        if (sample.t < start) {
          current = totalOf(sample.w, currency)
          continue
        }
        while (cursor + 1 < spec.count && buckets[cursor + 1].end <= sample.t) {
          cursor += 1
          buckets[cursor].remaining = current
        }
        current = totalOf(sample.w, currency)
      }
      while (cursor + 1 < spec.count) {
        cursor += 1
        buckets[cursor].remaining = current
      }

      return buckets.map((bucket) => ({
        ...bucket,
        label: bucketLabel(bucket.end, granularity),
      }))
    }

    /** Sum of the buckets. */
    function sumSpend(buckets) {
      return buckets.reduce((total, bucket) => total + bucket.spend, 0)
    }

    /** Largest single-bucket spend. */
    function maxSpend(buckets) {
      return buckets.reduce((max, bucket) => Math.max(max, bucket.spend), 0)
    }

    /** Pick at most five evenly spaced bucket indices for the x axis. */
    function labelTicks(count) {
      if (count <= 1) return [0]
      const wanted = Math.min(5, count)
      const indexes = []
      for (let step = 0; step < wanted; step += 1) {
        const index = Math.round((step * (count - 1)) / (wanted - 1))
        if (!indexes.includes(index)) indexes.push(index)
      }
      return indexes
    }

    /** Budget settings with the period spend and progress. */
    function budgetSummary(data, now) {
      const settings = data?.settings ?? { amount: 0, period: 'day', currency: 'CNY' }
      const amount = Number(settings.amount) || 0
      const period = settings.period || 'day'
      const currency = settings.currency || 'CNY'
      const spent = spendBetween(data?.samples, currency, periodStart(period, now), now)
      return {
        amount,
        period,
        currency,
        spent,
        ratio: amount > 0 ? spent / amount : 0,
        remaining: amount - spent,
      }
    }

    /**
     * Time today covered by adjacent samples. Gaps longer than 15 minutes mean
     * Harness was not running, so overnight and closed-app time is not counted
     * against the average.
     */
    function observedTodayMs(samples, now) {
      if (!Array.isArray(samples)) return 0
      const midnight = periodStart('day', now)
      let observed = 0
      for (let index = 1; index < samples.length; index += 1) {
        const before = samples[index - 1]
        const after = samples[index]
        if (after.t <= midnight || before.t >= now) continue
        if (before.s !== after.s) continue
        const gap = after.t - before.t
        if (gap <= 0 || gap > 15 * 60 * 1000) continue
        const from = Math.max(before.t, midnight)
        const to = Math.min(after.t, now)
        if (to > from) observed += to - from
      }
      return observed
    }

    /** Average spend rate today, over the tracked (active) portion of the day. */
    function todayRates(data, currency, now) {
      const midnight = periodStart('day', now)
      const start = Math.max(midnight, data?.trackingSince ?? midnight)
      const observed = observedTodayMs(data?.samples, now)
      const elapsed = observed > 0 ? observed : Math.max(60 * 1000, now - start)
      const spent = spendBetween(data?.samples, currency, start, now)
      return {
        spent,
        perHour: (spent / elapsed) * 60 * 60 * 1000,
        perMinute: (spent / elapsed) * 60 * 1000,
        since: start,
        observed,
      }
    }

    /** Period-scoped copy helpers. */
    function periodCopy(tr, period, kind) {
      if (kind === 'spent') {
        return tr(period === 'minute' ? 'spentMinute' : period === 'hour' ? 'spentHour' : 'spentDay')
      }
      if (kind === 'left') {
        return tr(period === 'minute' ? 'leftMinute' : period === 'hour' ? 'leftHour' : 'leftDay')
      }
      if (kind === 'reset') {
        return tr(period === 'minute' ? 'resetMinute' : period === 'hour' ? 'resetHour' : 'resetDay')
      }
      return tr(period === 'minute' ? 'periodMinute' : period === 'hour' ? 'periodHour' : 'periodToday')
    }

    /** Chinese calendar date of an instant, as YYYY-MM-DD. */
    function chinaDate(timestamp) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(timestamp))
    }

    /**
     * DeepSeek peak pricing: 01:00-04:00 and 06:00-10:00 UTC on weekdays,
     * excluding Chinese public holidays; every other instant is off-peak and
     * billed at half the peak rate.
     */
    function pricingAt(timestamp, holidays) {
      const date = new Date(timestamp)
      const weekday = date.getUTCDay() >= 1 && date.getUTCDay() <= 5
      const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
      const holiday = Array.isArray(holidays) && holidays.includes(chinaDate(timestamp))
      const peak =
        weekday && !holiday && ((minutes >= 60 && minutes < 240) || (minutes >= 360 && minutes < 600))
      return { offPeak: !peak, holiday }
    }

    /** First instant after now whose peak/off-peak state differs. */
    function nextPricingChange(now, holidays) {
      const current = pricingAt(now, holidays).offPeak
      const date = new Date(now)
      const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      const candidates = []
      for (let offset = -1; offset <= 8; offset += 1) {
        for (const minutes of [0, 60, 240, 360, 600, 960]) {
          candidates.push(base + offset * 86400000 + minutes * 60000)
        }
      }
      candidates.sort((a, b) => a - b)
      for (const at of candidates) {
        if (at <= now) continue
        if (pricingAt(at, holidays).offPeak !== current) return at
      }
      return null
    }

    /** Local wall-clock label of a pricing transition. */
    function transitionLabel(at) {
      if (!at) return ''
      const date = new Date(at)
      const sameDay = new Date().toDateString() === date.toDateString()
      return date.toLocaleString(
        pageLocale(),
        sameDay
          ? { hour: '2-digit', minute: '2-digit' }
          : { weekday: 'short', hour: '2-digit', minute: '2-digit' },
      )
    }

    /** Currency shown first: the configured budget currency, then CNY. */
    function defaultCurrency(data) {
      const currencies = currenciesOf(data)
      const configured = data?.settings?.currency
      if (configured && currencies.includes(configured)) return configured
      if (currencies.includes('CNY')) return 'CNY'
      return currencies[0] ?? configured ?? 'CNY'
    }

    // ------------------------------------------------------------------ store

    /** Shared snapshot so the page and sidebar meter poll once. */
    function createUsageStore() {
      let state = { data: null, failure: null, loading: true }
      const listeners = new Set()
      let timer = null
      let inflight = null
      let subscribers = 0

      const emit = () => {
        for (const listener of listeners) listener()
      }
      const publish = (next) => {
        state = next
        emit()
      }
      const load = (force) => {
        if (inflight) return inflight
        inflight = (async () => {
          try {
            const response = await fetch(
              `${SERIES_ROUTE}?days=${RANGE_DAYS}${force ? '&refresh=1' : ''}`,
              { headers: { accept: 'application/json' }, credentials: 'same-origin' },
            )
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            publish({ data, failure: null, loading: false })
          } catch (error) {
            publish({ ...state, failure: error?.message ?? 'request failed', loading: false })
          } finally {
            inflight = null
          }
        })()
        return inflight
      }
      const start = () => {
        if (timer !== null) return
        void load(true)
        timer = setInterval(() => {
          void load(false)
        }, 30000)
      }
      const stop = () => {
        if (timer === null) return
        clearInterval(timer)
        timer = null
      }

      return {
        subscribe(listener) {
          listeners.add(listener)
          subscribers += 1
          start()
          return () => {
            listeners.delete(listener)
            subscribers -= 1
            if (subscribers <= 0) {
              subscribers = 0
              stop()
            }
          }
        },
        getSnapshot() {
          return state
        },
        refresh() {
          return load(true)
        },
        async saveBudget(input) {
          const response = await fetch(SETTINGS_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(input),
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          await load(true)
        },
      }
    }

    const usageStore = createUsageStore()

    /** Subscribe to the shared usage snapshot. */
    function useUsage() {
      return useSyncExternalStore(
        usageStore.subscribe,
        usageStore.getSnapshot,
        usageStore.getSnapshot,
      )
    }

    // ----------------------------------------------------------------- charts

    /** Render one bar chart of spend per bucket. */
    function SpendChart({ buckets, currency, ariaLabel }) {
      const width = 640
      const height = 170
      const left = 8
      const right = 8
      const top = 12
      const bottom = 22
      const plotWidth = width - left - right
      const plotHeight = height - top - bottom
      const slot = plotWidth / Math.max(1, buckets.length)
      const barWidth = Math.max(1, Math.min(28, slot - 2))
      const max = Math.max(0, ...buckets.map((bucket) => bucket.spend))
      const ticks = labelTicks(buckets.length)
      return h(
        'svg',
        {
          viewBox: `0 0 ${width} ${height}`,
          role: 'img',
          'aria-label': ariaLabel,
          preserveAspectRatio: 'xMidYMid meet',
        },
        h('line', {
          x1: left,
          y1: top + plotHeight,
          x2: width - right,
          y2: top + plotHeight,
          stroke: 'var(--dsw-alias-border-l1)',
          strokeWidth: 1,
        }),
        buckets.map((bucket, index) => {
          const ratio = max > 0 ? bucket.spend / max : 0
          const barHeight = Math.max(bucket.spend > 0 ? 1.5 : 0, ratio * plotHeight)
          const x = left + index * slot + (slot - barWidth) / 2
          const y = top + plotHeight - barHeight
          return h(
            'rect',
            {
              key: index,
              x,
              y,
              width: barWidth,
              height: barHeight,
              rx: Math.min(2, barWidth / 2),
              fill: 'var(--dsw-alias-brand-primary)',
              opacity: bucket.spend > 0 ? 0.9 : 0,
            },
            h('title', null, `${bucket.label} · ${money(bucket.spend, currency)}`),
          )
        }),
        ticks.map((index) =>
          h(
            'text',
            {
              key: `label-${index}`,
              x: left + index * slot + slot / 2,
              y: height - 6,
              textAnchor: index === 0 ? 'start' : index === buckets.length - 1 ? 'end' : 'middle',
              fontSize: 10,
              fill: 'var(--dsw-alias-label-secondary)',
            },
            buckets[index]?.label ?? '',
          ),
        ),
        h(
          'text',
          {
            x: left,
            y: top - 1,
            fontSize: 10,
            fill: 'var(--dsw-alias-label-secondary)',
          },
          money(max, currency),
        ),
      )
    }

    /** Render the remaining balance line. */
    function RemainingChart({ buckets, currency, tr, ariaLabel }) {
      const width = 640
      const height = 170
      const left = 8
      const right = 8
      const top = 14
      const bottom = 22
      const plotWidth = width - left - right
      const plotHeight = height - top - bottom
      const slot = plotWidth / Math.max(1, buckets.length)
      const values = buckets
        .map((bucket) => bucket.remaining)
        .filter((value) => typeof value === 'number' && Number.isFinite(value))
      const ticks = labelTicks(buckets.length)
      const empty = values.length === 0
      let min = empty ? 0 : Math.min(...values)
      let max = empty ? 1 : Math.max(...values)
      if (max - min < 1e-6) {
        const padding = Math.max(0.5, max * 0.05)
        min -= padding
        max += padding
      } else {
        const padding = (max - min) * 0.08
        min -= padding
        max += padding
      }
      const xOf = (index) => left + index * slot + slot / 2
      const yOf = (value) => top + plotHeight - ((value - min) / (max - min)) * plotHeight
      const points = []
      buckets.forEach((bucket, index) => {
        if (typeof bucket.remaining === 'number' && Number.isFinite(bucket.remaining)) {
          points.push([xOf(index), yOf(bucket.remaining)])
        }
      })
      const line = points
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ')
      const area =
        points.length > 1
          ? `${line} L${points[points.length - 1][0].toFixed(2)},${top + plotHeight} L${points[0][0].toFixed(2)},${top + plotHeight} Z`
          : ''
      return h(
        'svg',
        {
          viewBox: `0 0 ${width} ${height}`,
          role: 'img',
          'aria-label': ariaLabel,
          preserveAspectRatio: 'xMidYMid meet',
        },
        h('line', {
          x1: left,
          y1: top + plotHeight,
          x2: width - right,
          y2: top + plotHeight,
          stroke: 'var(--dsw-alias-border-l1)',
          strokeWidth: 1,
        }),
        area ? h('path', { d: area, fill: 'var(--dsw-alias-brand-primary)', opacity: 0.1 }) : null,
        line
          ? h('path', {
              d: line,
              fill: 'none',
              stroke: 'var(--dsw-alias-brand-primary)',
              strokeWidth: 2,
              strokeLinejoin: 'round',
              strokeLinecap: 'round',
            })
          : null,
        empty
          ? h(
              'text',
              {
                x: width / 2,
                y: top + plotHeight / 2,
                textAnchor: 'middle',
                fontSize: 12,
                fill: 'var(--dsw-alias-label-secondary)',
              },
              tr('noSamples'),
            )
          : null,
        ticks.map((index) =>
          h(
            'text',
            {
              key: `label-${index}`,
              x: left + index * slot + slot / 2,
              y: height - 6,
              textAnchor: index === 0 ? 'start' : index === buckets.length - 1 ? 'end' : 'middle',
              fontSize: 10,
              fill: 'var(--dsw-alias-label-secondary)',
            },
            buckets[index]?.label ?? '',
          ),
        ),
        h(
          'text',
          {
            x: left,
            y: top - 2,
            fontSize: 10,
            fill: 'var(--dsw-alias-label-secondary)',
          },
          money(max, currency),
        ),
      )
    }

    /** Fill class for a ratio bar. */
    function fillClass(ratio, prefix) {
      if (ratio >= 1) return `${prefix}-over`
      if (ratio >= 0.8) return `${prefix}-warn`
      return ''
    }

    // --------------------------------------------------------------- fragments

    /** Render a compact skeleton while the first sample arrives. */
    function Skeleton({ tr }) {
      return h(
        'div',
        { className: 'dsu-root' },
        h(
          'div',
          { className: 'dsu-card' },
          h('div', { className: 'dsu-skeleton dsu-skeleton-short' }),
          h('div', { className: 'dsu-skeleton dsu-skeleton-wide', style: { height: 30 } }),
          h('div', { className: 'dsu-skeleton' }),
          h('p', { className: 'dsu-meta' }, tr('waiting')),
        ),
      )
    }

    /** Render the state card used when there is nothing to chart. */
    function EmptyState({ tr, title, body, retry }) {
      return h(
        'div',
        { className: 'dsu-card' },
        h(
          'div',
          { className: 'dsu-empty' },
          h('div', { className: 'dsu-empty-title' }, tr(title)),
          h('p', { className: 'dsu-empty-body' }, tr(body)),
          retry
            ? h(
                'button',
                { type: 'button', className: 'dsu-btn', onClick: retry },
                tr('retry'),
              )
            : null,
        ),
      )
    }

    /** Render the budget progress bar with spent/remaining copy. */
    function BudgetProgress({ budget, tr }) {
      const ratio = budget.amount > 0 ? budget.spent / budget.amount : 0
      const percent = Math.round(ratio * 100)
      const clamped = Math.max(0, Math.min(1, ratio))
      return h(
        'div',
        { className: 'dsu-progress' },
        h(
          'div',
          { className: 'dsu-progress-label' },
          h('span', { className: 'dsu-progress-strong' }, periodCopy(tr, budget.period, 'spent')),
          h(
            'span',
            null,
            budget.amount > 0
              ? `${money(budget.spent, budget.currency)} / ${money(budget.amount, budget.currency)} · ${tr('usedPercent', { percent })}`
              : tr('budgetUnset'),
          ),
        ),
        h(
          'div',
          {
            className: 'dsu-progress-track',
            role: 'meter',
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.min(100, percent),
          },
          h('div', {
            className: `dsu-progress-fill${fillClass(ratio, ' dsu-progress-fill')}`,
            style: { width: `${clamped * 100}%` },
          }),
        ),
        h(
          'div',
          { className: 'dsu-progress-foot' },
          budget.amount > 0
            ? h(
                'span',
                null,
                budget.remaining >= 0
                  ? `${money(budget.remaining, budget.currency)} ${periodCopy(tr, budget.period, 'left')}`
                  : `${money(-budget.remaining, budget.currency)} ${tr('overPeriod')}`,
              )
            : h('span', null, tr('setBudget')),
          h('span', null, periodCopy(tr, budget.period, 'reset')),
        ),
      )
    }

    /** Render the budget editor and current progress. */
    function BudgetCard({ data, tr }) {
      const settings = data?.settings ?? {}
      const settingsKey = `${settings.amount}|${settings.period}|${settings.currency}`
      const [amount, setAmount] = useState('')
      const [period, setPeriod] = useState('day')
      const [currency, setCurrency] = useState('CNY')
      const [saving, setSaving] = useState(false)
      const [error, setError] = useState(null)
      const [saved, setSaved] = useState(false)

      useEffect(() => {
        setAmount(settings.amount > 0 ? String(settings.amount) : '')
        setPeriod(settings.period || 'day')
        setCurrency(settings.currency || 'CNY')
      }, [settingsKey])

      const now = Date.now()
      const budget = budgetSummary(data, now)
      const currencies = currenciesOf(data)
      const options = currencies.includes('CNY') ? currencies : ['CNY', ...currencies]
      if (!options.includes(currency)) options.push(currency)

      const submit = async () => {
        const value = amount.trim() === '' ? 0 : Number(amount)
        if (!Number.isFinite(value) || value < 0) {
          setError('invalidAmount')
          return
        }
        setSaving(true)
        setError(null)
        try {
          await usageStore.saveBudget({ amount: value, period, currency })
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch {
          setError('saveFailed')
        } finally {
          setSaving(false)
        }
      }

      return h(
        'section',
        { className: 'dsu-card' },
        h(
          'div',
          { className: 'dsu-row' },
          h(
            'div',
            null,
            h('div', { className: 'dsu-card-title' }, tr('budgetTitle')),
            h('div', { className: 'dsu-card-sub' }, tr('budgetHelp')),
          ),
          saved ? h('span', { className: 'dsu-card-sub' }, tr('saved')) : null,
        ),
        h(
          'div',
          { className: 'dsu-editor' },
          h(
            'label',
            { className: 'dsu-field' },
            tr('amount'),
            h('input', {
              type: 'number',
              min: '0',
              step: '0.01',
              inputMode: 'decimal',
              className: 'dsu-input',
              value: amount,
              placeholder: '0.00',
              'aria-label': tr('amount'),
              onChange: (event) => setAmount(event.target.value),
            }),
          ),
          h(
            'label',
            { className: 'dsu-field' },
            tr('period'),
            h(
              'select',
              {
                className: 'dsu-select',
                value: period,
                'aria-label': tr('period'),
                onChange: (event) => setPeriod(event.target.value),
              },
              ['day', 'hour', 'minute'].map((value) =>
                h(
                  'option',
                  { key: value, value },
                  tr(value === 'day' ? 'perDay' : value === 'hour' ? 'perHour' : 'perMinute'),
                ),
              ),
            ),
          ),
          h(
            'label',
            { className: 'dsu-field' },
            tr('currency'),
            h(
              'select',
              {
                className: 'dsu-select',
                value: currency,
                'aria-label': tr('currency'),
                onChange: (event) => setCurrency(event.target.value),
              },
              options.map((value) => h('option', { key: value, value }, value)),
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsu-btn dsu-btn-primary',
              onClick: submit,
              disabled: saving,
            },
            saving ? tr('saving') : tr('save'),
          ),
        ),
        error ? h('p', { className: 'dsu-error', role: 'alert' }, tr(error)) : null,
        h(BudgetProgress, { budget, tr }),
      )
    }

    /** Today's token totals and per-agent context. */
    function TokensCard({ tokens, sessions, tr }) {
      if (!tokens) {
        return h(
          'section',
          { className: 'dsu-card' },
          h(
            'div',
            null,
            h('div', { className: 'dsu-card-title' }, tr('tokensTitle')),
            h('div', { className: 'dsu-card-sub' }, tr('tokensUnavailable')),
          ),
        )
      }
      const rows = Object.entries(tokens.sessions ?? {})
        .map(([id, entry]) => ({
          id,
          name: sessions?.byId?.[id]?.displayTitle ?? id.slice(0, 12),
          today: entry?.today ?? {},
          context: entry?.context ?? null,
        }))
        .sort((left, right) => tokenTotalOf(right.today) - tokenTotalOf(left.today) || left.name.localeCompare(right.name))
      const visibleRows = rows.slice(0, 8)
      const remainingRows = Math.max(0, rows.length - visibleRows.length)
      const total = tokenTotalOf(tokens.today)
      const cell = (label, value) =>
        h(
          'div',
          { className: 'dsu-token-cell' },
          h('div', { className: 'dsu-token-label' }, label),
          h('div', { className: 'dsu-token-value' }, tokenCount(value)),
        )
      return h(
        'section',
        { className: 'dsu-card' },
        h(
          'div',
          { className: 'dsu-row' },
          h(
            'div',
            null,
            h('div', { className: 'dsu-card-title' }, tr('tokensTitle')),
            h('div', { className: 'dsu-card-sub' }, tr('tokensSub')),
          ),
          tokens.trackedSince
            ? h('span', { className: 'dsu-meta' }, `${tr('trackedSince')} ${timeLabel(tokens.trackedSince)}`)
            : null,
        ),
        h(
          'div',
          { className: 'dsu-token-summary' },
          cell(tr('tokensInput'), tokens.today?.uncachedInputTokens),
          cell(tr('tokensOutput'), tokens.today?.outputTokens),
          cell(tr('tokensCacheRead'), tokens.today?.cacheReadTokens),
          cell(tr('tokensCacheWrite'), tokens.today?.cacheWriteTokens),
        ),
        h(
          'div',
          { className: 'dsu-token-foot' },
          tr('tokensTotal', { value: tokenCount(total) }),
        ),
        visibleRows.length > 0
          ? h(
              'div',
              { className: 'dsu-token-list' },
              visibleRows.map((row) =>
                h(
                  'div',
                  { className: 'dsu-token-row', key: row.id },
                  h('span', { className: 'dsu-token-name', title: row.name }, row.name),
                  h(
                    'span',
                    { className: 'dsu-token-context' },
                    `${tr('tokensContext')} ${contextLabel(row.context)}`,
                  ),
                  h('span', { className: 'dsu-token-amount' }, tokenCount(tokenTotalOf(row.today))),
                ),
              ),
              remainingRows > 0
                ? h('div', { className: 'dsu-token-foot' }, tr('tokensMore', { count: remainingRows }))
                : null,
            )
          : h('p', { className: 'dsu-empty-body' }, tr('tokensNone')),
      )
    }

    // ------------------------------------------------------------------- page

    /** Render the Settings → Usage section. */
    function UsageSection(props) {
      const tr = props.t || boundTranslate
      const usage = useUsage()
      const data = usage.data
      const sessions = props.useSessions((value) => value)
      const [granularity, setGranularity] = useState('hour')
      const [currency, setCurrency] = useState(null)
      const [refreshing, setRefreshing] = useState(false)
      const now = Date.now()

      const wallets = data?.wallets ?? []
      const currencies = currenciesOf(data)
      const configured = defaultCurrency(data)
      const activeCurrency = currency && currencies.includes(currency) ? currency : configured
      const wallet =
        wallets.find((entry) => entry.currency === activeCurrency) ?? { normal: 0, bonus: 0 }
      const remaining = (wallet.normal || 0) + (wallet.bonus || 0)
      const samples = data?.samples ?? []
      const buckets = useMemo(
        () => buildSeries(data, granularity, activeCurrency, now),
        [data, granularity, activeCurrency, now],
      )
      const totalSpend = sumSpend(buckets)
      const budget = budgetSummary(data, now)
      const rates = todayRates(data, activeCurrency, now)
      const unit = tr(
        granularity === 'minute'
          ? 'bucketMinute'
          : granularity === 'hour'
            ? 'bucketHour'
            : 'bucketDay',
      )
      const signedOut = data?.status === 'signed-out'
      const unavailable = data?.status === 'unavailable'
      const broken = data?.status === 'error'
      const failure = usage.failure
      const pricing = pricingAt(now, data?.offPeakHolidays)
      const nextChange = nextPricingChange(now, data?.offPeakHolidays)
      const pricingNote = nextChange
        ? tr(pricing.offPeak ? 'offPeakUntil' : 'peakUntil', {
            time: transitionLabel(nextChange),
          })
        : ''

      const tabs = h(
        'div',
        { className: 'dsu-tabs', role: 'group', 'aria-label': tr('spendTitle') },
        ['minute', 'hour', 'day'].map((value) =>
          h(
            'button',
            {
              key: value,
              type: 'button',
              className: 'dsu-tab',
              'aria-pressed': granularity === value,
              onClick: () => setGranularity(value),
            },
            tr(value === 'minute' ? 'tabsMinute' : value === 'hour' ? 'tabsHour' : 'tabsDay'),
          ),
        ),
      )

      const refresh = h(
        'button',
        {
          type: 'button',
          className: 'dsu-btn',
          disabled: refreshing,
          onClick: async () => {
            setRefreshing(true)
            try {
              await usageStore.refresh()
            } finally {
              setRefreshing(false)
            }
          },
        },
        tr('refresh'),
      )

      if (!data && usage.loading) return h(Skeleton, { tr })
      if (!data && failure) {
        return h(
          'div',
          { className: 'dsu-root' },
          h(EmptyState, {
            tr,
            title: 'errorTitle',
            body: 'errorBody',
            retry: () => {
              void usageStore.refresh()
            },
          }),
          data ? h(TokensCard, { tokens: data.tokens, sessions, tr }) : null,
          h('p', { className: 'dsu-foot' }, `${tr('loadFailed')} ${failure}`),
        )
      }
      if (!data) return h(Skeleton, { tr })

      if ((signedOut || unavailable || broken) && samples.length === 0) {
        return h(
          'div',
          { className: 'dsu-root' },
          h(EmptyState, {
            tr,
            title: signedOut
              ? 'signedOutTitle'
              : unavailable
                ? 'unavailableTitle'
                : 'errorTitle',
            body: signedOut ? 'signedOutBody' : unavailable ? 'unavailableBody' : 'errorBody',
            retry: () => {
              void usageStore.refresh()
            },
          }),
          h(TokensCard, { tokens: data.tokens, sessions, tr }),
          h('p', { className: 'dsu-foot' }, tr('foot')),
        )
      }

      const metadata = []
      if (data.updatedAt) metadata.push(tr('updated', { time: timeLabel(data.updatedAt) }))
      if (data.trackingSince)
        metadata.push(`${tr('trackedSince')} ${timeLabel(data.trackingSince)}`)
      if (data.source === 'api-key') metadata.push(tr('sourceApi'))
      else if (data.source === 'account') metadata.push(tr('sourceAccount'))

      const banner =
        data.available === false
          ? tr('insufficient')
          : signedOut
            ? tr('signedOutBody')
            : unavailable
              ? tr('unavailableBody')
              : failure
                ? tr('stale')
                : broken
                  ? tr('errorBody')
                  : null
      const bannerError = data.available === false || broken || Boolean(failure)

      return h(
        'div',
        { className: 'dsu-root' },
        banner &&
          h(
            'div',
            {
              className: `dsu-banner${bannerError ? ' dsu-banner-error' : ''}`,
              role: 'status',
            },
            banner,
          ),
        h(
          'section',
          { className: 'dsu-card dsu-hero' },
          h(
            'div',
            null,
            h('div', { className: 'dsu-kicker' }, tr('title')),
            h(
              'div',
              { className: 'dsu-amount' },
              money(remaining, activeCurrency),
              wallet.bonus > 0
                ? h(
                    'small',
                    null,
                    tr('bonusIncluded', { value: money(wallet.bonus, activeCurrency) }),
                  )
                : null,
            ),
            h('div', { className: 'dsu-meta' }, metadata.join(' · ') || tr('waiting')),
            h(
              'div',
              { className: 'dsu-meta' },
              tr('sampling', { seconds: data.intervalSeconds ?? 60 }),
            ),
            h(
              'div',
              { className: 'dsu-statusline' },
              h(
                'span',
                {
                  className: `dsu-pill${pricing.offPeak ? ' dsu-pill-off' : ''}`,
                  title: pricingNote || null,
                },
                h('span', { className: 'dsu-pill-dot' }),
                tr(pricing.offPeak ? 'offPeak' : 'peak'),
              ),
              pricingNote
                ? h('span', { className: 'dsu-status-note' }, pricingNote)
                : null,
            ),
          ),
          h(
            'div',
            { className: 'dsu-stats' },
            h(
              'div',
              { className: 'dsu-stat' },
              h('div', { className: 'dsu-stat-label' }, tr('avgHour')),
              h('div', { className: 'dsu-stat-value' }, rate(rates.perHour, activeCurrency)),
            ),
            h(
              'div',
              { className: 'dsu-stat' },
              h('div', { className: 'dsu-stat-label' }, tr('avgMinute')),
              h('div', { className: 'dsu-stat-value' }, rate(rates.perMinute, activeCurrency)),
            ),
            h(
              'div',
              { className: 'dsu-stat' },
              h('div', { className: 'dsu-stat-label' }, tr('lastHour')),
              h(
                'div',
                { className: 'dsu-stat-value' },
                money(
                  spendBetween(samples, activeCurrency, now - 60 * 60 * 1000, now),
                  activeCurrency,
                ),
              ),
            ),
          ),
        ),
        h(BudgetCard, { data, tr }),
        h(TokensCard, { tokens: data.tokens, sessions, tr }),
        h(
          'section',
          { className: 'dsu-card' },
          h(
            'div',
            { className: 'dsu-row' },
            h(
              'div',
              null,
              h('div', { className: 'dsu-card-title' }, tr('spendTitle')),
              h('div', { className: 'dsu-card-sub' }, tr('spendSub')),
            ),
            h(
              'div',
              { className: 'dsu-row', style: { gap: 8 } },
              currencies.length > 1
                ? h(
                    'select',
                    {
                      value: activeCurrency,
                      onChange: (event) => setCurrency(event.target.value),
                      className: 'dsu-btn',
                      'aria-label': tr('currency'),
                    },
                    currencies.map((value) => h('option', { key: value, value }, value)),
                  )
                : null,
              tabs,
              refresh,
            ),
          ),
          h(
            'div',
            { className: 'dsu-chart' },
            maxSpend(buckets) > 0
              ? h(SpendChart, {
                  buckets,
                  currency: activeCurrency,
                  ariaLabel: tr('chartSpend', { bucket: unit }),
                })
              : h(
                  'p',
                  { className: 'dsu-empty-body', style: { margin: '8px 0 4px' } },
                  tr('noSpend'),
                ),
          ),
          h(
            'div',
            { className: 'dsu-progress-foot' },
            h('span', null, `${tr('spendTitle')} · ${unit}`),
            h('span', null, money(totalSpend, activeCurrency)),
          ),
        ),
        h(
          'section',
          { className: 'dsu-card' },
          h(
            'div',
            null,
            h('div', { className: 'dsu-card-title' }, tr('remainingTitle')),
            h('div', { className: 'dsu-card-sub' }, tr('remainingSub')),
          ),
          h(
            'div',
            { className: 'dsu-chart' },
            h(RemainingChart, {
              buckets,
              currency: activeCurrency,
              tr,
              ariaLabel: tr('chartRemaining', { bucket: unit }),
            }),
          ),
        ),
        h('p', { className: 'dsu-foot' }, `${tr('foot')} ${tr('avgNote')}.`),
      )
    }

    // ----------------------------------------------------------- sidebar meter

    /** Render the sidebar-foot usage meter. */
    function UsageMeter(props) {
      const tr = props.t || boundTranslate
      const usage = useUsage()
      const data = usage.data
      const wide = props.wide !== false
      if (!data) return null
      if (!Array.isArray(data.samples) || data.samples.length === 0) return null
      const currency = defaultCurrency(data)
      const wallet =
        (data.wallets ?? []).find((entry) => entry.currency === currency) ?? {
          normal: 0,
          bonus: 0,
        }
      const topUp = Number(wallet.normal) || 0
      const bonusCredit = Number(wallet.bonus) || 0
      const topUpUrl =
        typeof data.topUpUrl === 'string' && /^https?:\/\//u.test(data.topUpUrl)
          ? data.topUpUrl
          : null
      const now = Date.now()
      const budget = budgetSummary(data, now)
      const rates = todayRates(data, currency, now)
      const ratio = budget.amount > 0 ? budget.spent / budget.amount : 0
      const percent = Math.min(999, Math.round(ratio * 100))
      const pricing = pricingAt(now, data.offPeakHolidays)
      const nextChange = nextPricingChange(now, data.offPeakHolidays)
      const priceLabel = tr(pricing.offPeak ? 'offPeakShort' : 'peakShort')
      const priceDetail = nextChange
        ? `${priceLabel} ${tr(pricing.offPeak ? 'offPeakUntil' : 'peakUntil', {
            time: transitionLabel(nextChange),
          })}`
        : priceLabel

      const creditLine = `${tr('topUp')} ${money(topUp, currency)}${
        bonusCredit > 0 ? ` + ${money(bonusCredit, currency)} ${tr('bonusShort')}` : ''
      }`

      const tooltip =
        `${creditLine}\n` +
        (budget.amount > 0
          ? `${tr('sidebarTitle')} · ${tr('usedPercent', { percent })}\n${money(budget.spent, currency)} / ${money(budget.amount, currency)} ${periodCopy(tr, budget.period, 'period')}\n${money(rates.perHour, currency)} / ${tr('perHourShort')} · ${rate(rates.perMinute, currency)} / ${tr('perMinuteShort')}`
          : `${tr('sidebarTitle')} · ${tr('budgetUnset')}`) +
        `\n${priceDetail}`

      if (!wide) {
        const radius = 15
        const circumference = 2 * Math.PI * radius
        const clamped = Math.max(0, Math.min(1, ratio))
        const offset = circumference * (1 - clamped)
        return h(
          'div',
          { className: 'dsu-rail', title: tooltip, 'aria-label': tooltip },
          h('span', {
            className: `dsu-rail-dot${pricing.offPeak ? ' dsu-rail-dot-off' : ''}`,
          }),
          h(
            'svg',
            { width: 36, height: 36, viewBox: '0 0 36 36', role: 'img', 'aria-hidden': true },
            h('circle', {
              cx: 18,
              cy: 18,
              r: radius,
              fill: 'none',
              stroke: 'var(--dsw-alias-bg-layer-2)',
              strokeWidth: 3,
            }),
            budget.amount > 0
              ? h('circle', {
                  cx: 18,
                  cy: 18,
                  r: radius,
                  fill: 'none',
                  stroke:
                    ratio >= 1
                      ? 'var(--dsw-alias-state-error-primary)'
                      : ratio >= 0.8
                        ? 'var(--dsw-alias-state-warn-primary)'
                        : 'var(--dsw-alias-brand-primary)',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                  strokeDasharray: `${circumference}`,
                  strokeDashoffset: `${offset}`,
                  transform: 'rotate(-90 18 18)',
                })
              : null,
            h(
              'text',
              {
                x: 18,
                y: 21.5,
                textAnchor: 'middle',
                fontSize: budget.amount > 0 ? 9 : 10,
                fill: 'var(--dsw-alias-label-primary)',
              },
              budget.amount > 0 ? `${percent}%` : '—',
            ),
          ),
        )
      }

      const barClass = `dsu-meter-fill${fillClass(ratio, '')}`
      return h(
        'div',
        { className: 'dsu-meter', title: tooltip },
        h(
          'div',
          { className: 'dsu-meter-head' },
          h(
            'span',
            { className: 'dsu-meter-title' },
            tr('sidebarTitle'),
            h(
              'span',
              {
                className: `dsu-price-chip${pricing.offPeak ? ' dsu-price-chip-off' : ''}`,
                title: priceDetail,
              },
              priceLabel,
            ),
          ),
          h(
            'span',
            { className: 'dsu-meter-pct' },
            budget.amount > 0 ? tr('usedPercent', { percent }) : tr('budgetUnset'),
          ),
        ),
        h(
          'div',
          { className: 'dsu-meter-line' },
          topUpUrl
            ? h(
                'a',
                {
                  className: 'dsu-topup-link',
                  href: topUpUrl,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  title: tr('topUpOpen'),
                  'aria-label': tr('topUpOpen'),
                },
                tr('topUp'),
                ' ',
                h('strong', null, money(topUp, currency)),
              )
            : h('span', null, tr('topUp'), ' ', h('strong', null, money(topUp, currency))),
          bonusCredit > 0
            ? h('span', null, `+ ${money(bonusCredit, currency)} ${tr('bonusShort')}`)
            : null,
        ),
        budget.amount > 0
          ? h(
              'div',
              { className: 'dsu-meter-track' },
              h('div', {
                className: barClass,
                style: { width: `${Math.max(0, Math.min(1, ratio)) * 100}%` },
              }),
            )
          : null,
        budget.amount > 0
          ? h(
              'div',
              { className: 'dsu-meter-line' },
              h(
                'span',
                null,
                h('strong', null, money(budget.spent, currency)),
                ` / ${money(budget.amount, currency)} ${periodCopy(tr, budget.period, 'period')}`,
              ),
              h(
                'span',
                null,
                budget.remaining >= 0
                  ? `${money(budget.remaining, currency)} ${periodCopy(tr, budget.period, 'left')}`
                  : `${money(-budget.remaining, currency)} ${tr('overPeriod')}`,
              ),
            )
          : null,
        h(
          'div',
          { className: 'dsu-meter-line' },
          h(
            'span',
            null,
            tr('avgPerHourShort'),
            ' ',
            h('strong', null, money(rates.perHour, currency)),
            ' · ',
            tr('avgPerMinuteShort'),
            ' ',
            h('strong', null, rate(rates.perMinute, currency)),
          ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        boundTranslate = t
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'usage-monitor: dictionaries')
        ctx.effect(() => installStyles(), 'usage-monitor: styles')
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'usage',
              order: 5,
              label: () => t('nav'),
              locale: NS,
            },
            UsageSection,
          ),
        )
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: 'usage-meter',
              order: 0,
              label: () => t('sidebarTitle'),
              locale: NS,
            },
            UsageMeter,
          ),
        )
      },
    }
  },
})
