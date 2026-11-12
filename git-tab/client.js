window.__ModuleLoader__.load({
  id: '@local/dsh-git',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState } = React

    /* ------------------------------------------------------------------ *
     * Per-Session store. One entry per Session the composer renders; the    *
     * host derives it from the working tree, this half only caches it.      *
     * ------------------------------------------------------------------ */
    const entries = new Map()
    const listeners = new Set()
    const POLL_MS = 12000

    let translate = (key) => key

    function entryFor(sessionId) {
      let entry = entries.get(sessionId)
      if (entry === undefined) {
        entry = { data: undefined, error: undefined, loading: false, open: false, initializing: false }
        entries.set(sessionId, entry)
      }
      return entry
    }

    function publish() {
      for (const listener of listeners) listener()
    }

    async function load(sessionId) {
      const entry = entryFor(sessionId)
      if (entry.loading) return
      entry.loading = true
      publish()
      try {
        const response = await fetch(`/api/git.status?session=${encodeURIComponent(sessionId)}`, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => undefined)
        if (!response.ok) {
          entry.error = payload?.error ?? `HTTP ${response.status}`
        } else if (payload === undefined) {
          entry.error = 'Malformed response'
        } else {
          entry.data = payload
          entry.error = undefined
        }
      } catch (error) {
        entry.error = String(error?.message ?? error)
      } finally {
        entry.loading = false
        publish()
      }
    }

    async function initialize(sessionId) {
      const entry = entryFor(sessionId)
      if (entry.initializing) return
      entry.initializing = true
      publish()
      try {
        const response = await fetch(`/api/git.init?session=${encodeURIComponent(sessionId)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
        const payload = await response.json().catch(() => undefined)
        if (payload?.status !== undefined) entry.data = payload.status
        if (payload?.init === 'failed') entry.error = payload.error ?? 'git init failed'
        else if (payload?.error !== undefined && payload?.status === undefined) entry.error = payload.error
        else if (payload?.init === 'created' || payload?.init === 'already') entry.error = undefined
      } catch (error) {
        entry.error = String(error?.message ?? error)
      } finally {
        entry.initializing = false
        publish()
      }
    }

    function toggle(sessionId) {
      const entry = entryFor(sessionId)
      entry.open = !entry.open
      publish()
      if (entry.open && entry.data === undefined) void load(sessionId)
    }

    /** Subscribe this component to every store change. */
    function useEntry(sessionId) {
      const [, bump] = useState(0)
      useEffect(() => {
        const listener = () => bump((value) => value + 1)
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      }, [])
      return entryFor(sessionId)
    }

    /** Refresh on mount, on tab focus, and on a slow interval while visible. */
    function useLiveStatus(sessionId) {
      useEffect(() => {
        let live = true
        const run = () => {
          if (live && document.visibilityState !== 'hidden') void load(sessionId)
        }
        run()
        const timer = window.setInterval(run, POLL_MS)
        window.addEventListener('focus', run)
        return () => {
          live = false
          window.clearInterval(timer)
          window.removeEventListener('focus', run)
        }
      }, [sessionId])
    }

    /* ------------------------------------------------------------------ *
     * Shared presentation. Token-only colors, so the panel follows the      *
     * active theme and any skin that rewrites the alias tokens.            *
     * ------------------------------------------------------------------ */
    const T = {
      border: 'var(--dsw-alias-border-l1)',
      borderStrong: 'var(--dsw-alias-border-l2)',
      label: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      surface: 'var(--dsw-alias-bg-layer-1)',
      surfaceNested: 'var(--dsw-alias-bg-layer-2)',
      accent: 'var(--dsw-alias-brand-primary)',
      danger: 'var(--dsw-alias-state-error-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      success: 'var(--dsw-alias-state-success-primary)',
      idle: 'var(--dsw-alias-state-idle-primary)',
    }

    const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

    function BranchGlyph({ size = 12 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': true,
          style: { flex: '0 0 auto', display: 'block' },
        },
        h('path', { d: 'M4 3.9v6.2', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
        h('circle', { cx: 4, cy: 2.6, r: 1.45, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('circle', { cx: 4, cy: 11.5, r: 1.45, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', {
          d: 'M4 6.6c0 1.9 1.4 2.8 3.3 2.8h2.4',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
        }),
        h('circle', { cx: 11.4, cy: 9.4, r: 1.45, stroke: 'currentColor', strokeWidth: 1.3 }),
      )
    }

    /** Compact, non-authoritative summary used by the tool-row chip. */
    function summarize(data, error) {
      if (data === undefined) return { label: error === undefined ? '…' : 'git error', tone: 'muted', detail: error ?? '' }
      if (data.state === 'no-repo') return { label: translate('noRepo'), tone: 'idle', detail: translate('noRepoHint') }
      if (data.state === 'git-missing') {
        return { label: translate('gitMissing'), tone: 'danger', detail: data.error ?? '' }
      }
      if (data.state === 'error') return { label: translate('error'), tone: 'danger', detail: data.error ?? '' }

      const branch = data.branch ?? {}
      const label = branch.detached
        ? `${translate('detached')} ${String(branch.oid ?? '').slice(0, 7)}`
        : branch.name ?? translate('unknownBranch')
      const changes = data.changes?.total ?? 0
      const parts = [label]
      if (changes > 0) parts.push(translate('changedCount').replace('{count}', String(changes)))
      if ((branch.ahead ?? 0) > 0) parts.push(`↑${branch.ahead}`)
      if ((branch.behind ?? 0) > 0) parts.push(`↓${branch.behind}`)
      if (data.repo?.worktree) parts.push(translate('worktree'))
      if ((data.stash ?? 0) > 0) parts.push(`stash ${data.stash}`)
      return { label, tone: 'muted', detail: parts.join(' · '), changes }
    }

    /* ------------------------------------------------------------------ *
     * Chip in the composer tool row.                                       *
     * ------------------------------------------------------------------ */
    function GitChip({ sessionId }) {
      useLiveStatus(sessionId)
      const entry = useEntry(sessionId)
      const summary = summarize(entry.data, entry.error)
      const changes = summary.changes ?? 0

      const color =
        summary.tone === 'danger' ? T.danger : summary.tone === 'idle' ? T.idle : T.muted

      return h(
        'button',
        {
          type: 'button',
          onClick: () => toggle(sessionId),
          title: summary.detail === '' ? summary.label : summary.detail,
          'aria-label': `${translate('title')}: ${summary.detail === '' ? summary.label : summary.detail}`,
          'aria-expanded': entry.open,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 26,
            maxWidth: 220,
            minWidth: 0,
            padding: '0 8px',
            border: `1px solid ${entry.open ? T.borderStrong : T.border}`,
            borderRadius: 7,
            background: entry.open ? T.surfaceNested : 'transparent',
            color,
            font: 'inherit',
            fontSize: 11.5,
            lineHeight: 1,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          },
        },
        h(BranchGlyph),
        h(
          'span',
          {
            style: {
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: mono,
              letterSpacing: '-0.01em',
            },
          },
          summary.label,
        ),
        changes > 0
          ? h(
              'span',
              {
                style: {
                  flex: '0 0 auto',
                  minWidth: 16,
                  padding: '1px 4px',
                  borderRadius: 5,
                  background: T.surfaceNested,
                  color: T.warn,
                  fontFamily: mono,
                  fontSize: 10,
                  textAlign: 'center',
                },
              },
              String(changes),
            )
          : null,
        entry.data?.repo?.worktree
          ? h(
              'span',
              {
                style: {
                  flex: '0 0 auto',
                  padding: '1px 4px',
                  borderRadius: 5,
                  border: `1px solid ${T.border}`,
                  color: T.muted,
                  fontSize: 9.5,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                },
              },
              'wt',
            )
          : null,
        entry.error !== undefined && entry.data?.state === 'ok'
          ? h('span', { style: { color: T.danger } }, '!')
          : null,
      )
    }

    /* ------------------------------------------------------------------ *
     * Detail panel under the composer.                                     *
     * ------------------------------------------------------------------ */
    function GhostButton({ children, onClick, disabled, tone }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          disabled,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            height: 22,
            padding: '0 8px',
            border: `1px solid ${tone === 'accent' ? T.accent : T.border}`,
            borderRadius: 6,
            background: tone === 'accent' ? T.accent : 'transparent',
            color: tone === 'accent' ? T.surface : T.muted,
            font: 'inherit',
            fontSize: 11,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            whiteSpace: 'nowrap',
          },
        },
        children,
      )
    }

    function StatCell({ count, label }) {
      const emphasis = count > 0
      return h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 64,
            padding: '6px 9px',
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            background: T.surface,
          },
        },
        h(
          'span',
          {
            style: {
              fontFamily: mono,
              fontSize: 14,
              lineHeight: 1,
              color: emphasis ? T.label : T.idle,
            },
          },
          String(count),
        ),
        h('span', { style: { fontSize: 10.5, color: T.muted, whiteSpace: 'nowrap' } }, label),
      )
    }

    function MetaRow({ label, children }) {
      return h(
        'div',
        { style: { display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 } },
        h('span', { style: { flex: '0 0 62px', fontSize: 10.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em' } }, label),
        h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: T.label } }, children),
      )
    }

    function FileRow({ file }) {
      const letters = file.kind === 'untracked' ? '??' : `${file.index}${file.worktree}`.replace(/\./gu, '·')
      const color =
        file.kind === 'conflict' ? T.danger : file.kind === 'untracked' ? T.warn : file.kind === 'staged' ? T.success : T.muted
      return h(
        'div',
        {
          style: {
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            minWidth: 0,
            padding: '2px 0',
          },
        },
        h(
          'span',
          {
            style: {
              flex: '0 0 auto',
              width: 20,
              fontFamily: mono,
              fontSize: 10.5,
              color,
              letterSpacing: '0.02em',
            },
          },
          letters,
        ),
        h(
          'span',
          {
            title: file.original === undefined ? file.path : `${file.original} → ${file.path}`,
            style: {
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: mono,
              fontSize: 11.5,
              color: T.label,
            },
          },
          file.path,
        ),
        file.original === undefined
          ? null
          : h(
              'span',
              {
                style: {
                  flex: '0 0 auto',
                  fontSize: 10.5,
                  color: T.muted,
                },
              },
              `← ${file.original}`,
            ),
      )
    }

    function NoRepo({ sessionId, entry }) {
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' } },
        h('div', { style: { fontSize: 12, color: T.label } }, translate('noRepoHint')),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h(
            GhostButton,
            {
              tone: 'accent',
              onClick: () => void initialize(sessionId),
              disabled: entry.initializing,
            },
            entry.initializing ? translate('initializing') : translate('init'),
          ),
          h(
            'span',
            { style: { fontFamily: mono, fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            entry.data?.cwd ?? '',
          ),
        ),
      )
    }

    function GitPanel({ sessionId }) {
      const entry = useEntry(sessionId)
      if (!entry.open) return null

      const data = entry.data
      const changes = data?.changes
      const files = changes?.files ?? []
      const shown = files.slice(0, 14)
      const hiddenCount = (changes?.total ?? 0) - shown.length

      return h(
        'div',
        {
          style: {
            margin: '0 0 10px',
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            background: T.surfaceNested,
            color: T.label,
            fontSize: 12,
            overflow: 'hidden',
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              padding: '7px 10px',
              borderBottom: `1px solid ${T.border}`,
              background: T.surface,
            },
          },
          h(BranchGlyph, { size: 13 }),
          h(
            'span',
            { style: { fontFamily: mono, fontSize: 12, color: T.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            data?.state === 'ok'
              ? data.branch?.detached
                ? `${translate('detached')} ${String(data.branch?.oid ?? '').slice(0, 10)}`
                : data.branch?.name ?? translate('unknownBranch')
              : translate('title'),
          ),
          data?.repo?.worktree
            ? h(
                'span',
                {
                  style: {
                    flex: '0 0 auto',
                    padding: '1px 5px',
                    borderRadius: 5,
                    border: `1px solid ${T.borderStrong}`,
                    color: T.muted,
                    fontSize: 9.5,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  },
                },
                translate('worktree'),
              )
            : null,
          data?.repo?.name === undefined
            ? null
            : h(
                'span',
                {
                  title: data.repo.root,
                  style: {
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                    color: T.muted,
                  },
                },
                data.repo.name,
              ),
          h('span', { style: { flex: '1 1 auto' } }),
          h(
            GhostButton,
            { onClick: () => void load(sessionId), disabled: entry.loading },
            entry.loading ? translate('refreshing') : translate('refresh'),
          ),
          h(GhostButton, { onClick: () => toggle(sessionId) }, translate('close')),
        ),

        entry.error !== undefined && (data === undefined || data.state !== 'ok')
          ? h('div', { style: { padding: '10px 12px', color: T.danger, fontSize: 11.5 } }, entry.error)
          : null,

        data === undefined
          ? h('div', { style: { padding: '10px 12px', color: T.muted, fontSize: 11.5 } }, translate('loading'))
          : data.state === 'no-repo'
            ? h(NoRepo, { sessionId, entry })
            : data.state === 'git-missing'
              ? h(
                  'div',
                  { style: { padding: '10px 12px', color: T.danger, fontSize: 11.5 } },
                  translate('gitMissingHint'),
                )
              : data.state === 'error'
                ? h('div', { style: { padding: '10px 12px', color: T.danger, fontSize: 11.5 } }, data.error ?? translate('error'))
                : h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px' } },
                    h(
                      'div',
                      { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
                      data.head === undefined
                        ? h(MetaRow, { label: translate('head') }, translate('noCommits'))
                        : h(
                            MetaRow,
                            { label: translate('head') },
                            h('span', { style: { fontFamily: mono, color: T.accent } }, data.head.sha),
                            '  ',
                            data.head.subject,
                          ),
                      data.branch?.upstream === null || data.branch?.upstream === undefined
                        ? h(MetaRow, { label: translate('upstream') }, translate('noUpstream'))
                        : h(
                            MetaRow,
                            { label: translate('upstream') },
                            data.branch.upstream,
                            data.branch.ahead > 0 ? ` · ↑${data.branch.ahead}` : '',
                            data.branch.behind > 0 ? ` · ↓${data.branch.behind}` : '',
                          ),
                      h(MetaRow, { label: translate('cwd') }, data.cwd ?? ''),
                      (data.stash ?? 0) > 0
                        ? h(MetaRow, { label: translate('stash') }, String(data.stash))
                        : null,
                      h(MetaRow, { label: translate('root') }, data.repo?.root ?? ''),
                    ),
                    h(
                      'div',
                      { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                      h(StatCell, { count: changes?.staged ?? 0, label: translate('staged') }),
                      h(StatCell, { count: changes?.unstaged ?? 0, label: translate('unstaged') }),
                      h(StatCell, { count: changes?.untracked ?? 0, label: translate('untracked') }),
                      h(StatCell, { count: changes?.conflicted ?? 0, label: translate('conflicted') }),
                    ),
                    files.length === 0
                      ? h('div', { style: { fontSize: 11.5, color: T.success } }, translate('clean'))
                      : h(
                          'div',
                          {
                            style: {
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '4px 8px',
                              border: `1px solid ${T.border}`,
                              borderRadius: 7,
                              background: T.surface,
                              maxHeight: 190,
                              overflowY: 'auto',
                            },
                          },
                          ...shown.map((file, index) =>
                            h(FileRow, { key: `${file.path}:${index}`, file }),
                          ),
                          hiddenCount > 0
                            ? h(
                                'div',
                                { style: { padding: '3px 0 2px', fontSize: 10.5, color: T.muted } },
                                translate('moreFiles').replace('{count}', String(hiddenCount)),
                              )
                            : null,
                        ),
                  ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        translate = ctx.locale.bind('dsh-git')

        ctx.locale.register('dsh-git', 'en', {
          title: 'Git status',
          noRepo: 'No repository',
          noRepoHint: 'This workspace is not a Git repository. Nothing here has a commit history, a branch, or a diff to compare against.',
          init: 'Initialize repository',
          initializing: 'Initializing…',
          gitMissing: 'No git',
          gitMissingHint: 'Git is not installed or not on PATH for this workspace, so its state cannot be read.',
          detached: 'detached',
          unknownBranch: 'HEAD',
          worktree: 'worktree',
          head: 'HEAD',
          noCommits: 'No commits yet',
          upstream: 'Upstream',
          noUpstream: 'Not pushed',
          cwd: 'Cwd',
          root: 'Root',
          stash: 'Stash',
          staged: 'Staged',
          unstaged: 'Unstaged',
          untracked: 'Untracked',
          conflicted: 'Conflicts',
          clean: 'Working tree clean — everything is committed.',
          changedCount: '{count} changed',
          moreFiles: '{count} more…',
          refresh: 'Refresh',
          refreshing: 'Reading…',
          close: 'Hide',
          loading: 'Reading Git state…',
          error: 'Git error',
        })

        ctx.locale.register('dsh-git', 'zh', {
          title: 'Git 状态',
          noRepo: '无仓库',
          noRepoHint: '此工作区不是 Git 仓库：这里没有提交历史、分支，也没有可比较的差异。',
          init: '初始化仓库',
          initializing: '初始化中…',
          gitMissing: '无 git',
          gitMissingHint: '未安装 Git，或当前工作区的 PATH 中找不到 git，因此无法读取状态。',
          detached: '分离头指针',
          unknownBranch: 'HEAD',
          worktree: '工作树',
          head: 'HEAD',
          noCommits: '尚无提交',
          upstream: '上游',
          noUpstream: '未推送',
          cwd: '目录',
          root: '根目录',
          stash: '贮藏',
          staged: '已暂存',
          unstaged: '未暂存',
          untracked: '未跟踪',
          conflicted: '冲突',
          clean: '工作区干净——全部已提交。',
          changedCount: '{count} 项变更',
          moreFiles: '还有 {count} 项…',
          refresh: '刷新',
          refreshing: '读取中…',
          close: '收起',
          loading: '正在读取 Git 状态…',
          error: 'Git 错误',
        })

        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register(
            { name: 'conversation.input.left', id: 'git-status-chip', order: 40 },
            GitChip,
          ),
        )

        // The detail panel is a full-width strip: `conversation.composer.dock`
        // lays its entries out in a row beside the activity and usage cells.
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            { name: 'conversation.input.dock', id: 'git-status-panel', order: 10 },
            GitPanel,
          ),
        )
      },
    }
  },
})
