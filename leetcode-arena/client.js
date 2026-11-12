/**
 * Browser half of the LeetCode Arena (`@local/dsh-leetcode`).
 *
 * One root `main` panel: a searchable LeetCode catalog, a statement/diagram
 * reader, a small code editor with syntax highlighting, a bounded local
 * runner, and a coach whose ceiling is visible at all times.
 *
 * Styling uses only `--dsw-alias-*` theme tokens; no Harness Client package is
 * imported. The panel is deliberately self-contained so a Client-only reload
 * never leaves a half-rendered slot.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-leetcode',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React;

    const NS = 'leetcode';
    const PANEL_ID = 'leetcode';
    const LANGS = [
      { id: 'python', label: 'Python' },
      { id: 'javascript', label: 'JavaScript' },
      { id: 'cpp', label: 'C++' },
    ];
    const EMPTY_RESULT = { data: null, extra: [], running: false, error: null };
    const EMPTY_COACH = {
      thread: [],
      live: '',
      busy: false,
      error: null,
      tests: [],
      testsVerified: false,
      testsDropped: 0,
      job: null,
    };
    const EMPTY_CATALOG = {
      items: [],
      total: 0,
      page: 0,
      limit: 60,
      hasMore: false,
      offline: false,
      error: null,
      localOnly: false,
    };

    const en = {
      nav: 'LeetCode Arena',
      title: 'LeetCode Arena',
      subtitle: 'Practice deliberately',
      catalog: 'Catalog',
      coach: 'Coach',
      all: 'All',
      curated: 'Curated',
      imported: 'Imported',
      searchPlaceholder: 'Search problems',
      importPlaceholder: 'Paste a LeetCode URL or slug',
      importAction: 'Import',
      importing: 'Importing…',
      importHint: 'Free problems with a simple function signature work best. Design problems open read-only.',
      importDone: 'Imported {title}.',
      importProblem: 'Import a problem',
      filterAll: 'All levels',
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      offline: 'LeetCode is unreachable. Curated problems and saved drafts still work.',
      retry: 'Retry',
      clear: 'Clear',
      loadMore: 'Load more',
      showing: 'Showing {n}',
      noResults: 'No problems match that search.',
      welcomeTitle: 'Pick a problem. Keep the struggle.',
      welcomeLead:
        'The arena runs your code locally, checks trusted cases, and keeps the coach behind a ceiling you control.',
      statSolved: 'Solved',
      statClean: 'Clean',
      statAttempted: 'In progress',
      statImported: 'Imported',
      startHere: 'Start with a pattern',
      openCatalog: 'Browse the catalog',
      howCoach: 'How the coach works',
      howCoachLead:
        'L0 gives syntax only. Each level adds help. Syntax questions are always allowed, at every level.',
      statement: 'Problem',
      examples: 'Examples',
      constraints: 'Constraints',
      hints: 'Hints',
      hintsLocked: 'Hints start at L2. Syntax help is always available in the Coach.',
      hintNext: 'Raise to L{level} for the next hint',
      input: 'Input',
      output: 'Output',
      explanation: 'Explanation',
      run: 'Run',
      submit: 'Submit',
      checkExamples: 'Check examples',
      running: 'Running…',
      resetCode: 'Reset',
      resetConfirm: 'Reset the saved code for this problem?',
      copy: 'Copy',
      copied: 'Copied',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      saveFailed: 'Not saved',
      language: 'Language',
      results: 'Results',
      passed: 'Passed',
      failed: 'Failed',
      casesPassed: '{passed} / {total} passed',
      buildError: 'Build error',
      caseLabel: 'Case {n}',
      hidden: 'hidden',
      visible: 'visible',
      expected: 'Expected',
      actual: 'Actual',
      error: 'Error',
      lastRun: 'Last run: {passed}/{total}',
      noRun: 'Run the cases to see results.',
      noCode: 'Write a solution, then run it.',
      notRunnable: 'This problem has no runnable tests yet.',
      designNotice: 'Design problems are readable here, but the runner does not execute class interfaces yet.',
      examplesOnly: 'Imported problems expose only their visible examples; hidden tests are not public.',
      level: 'Help ceiling',
      levelHint: 'The coach cannot go above this level.',
      syntax: 'Syntax',
      clarify: 'Clarify',
      nudge: 'Nudge',
      outline: 'Outline',
      pseudocode: 'Pseudocode',
      solution: 'Reveal solution',
      complexity: 'Complexity',
      review: 'Review',
      tests: 'Edge cases',
      concept: 'Concept',
      ask: 'Ask',
      coachEmpty: 'Ask a syntax question, or raise the ceiling when you want a nudge.',
      coachPlaceholder: 'Ask about syntax, an error, or your approach…',
      coachThinking: 'Thinking…',
      coachNoModel: 'No default model is configured. Set one in Settings → Models.',
      noModelShort: 'No model',
      clearChat: 'Clear',
      clearConfirm: 'Clear this coach thread?',
      testsCard: 'Coach tests',
      testsVerified: 'verified against the reference',
      testsUnverified: 'unverified — check them yourself',
      runCoachTests: 'Run these cases',
      testsDropped: '{n} case(s) dropped: the reference disagreed.',
      testsAttached: 'Generated cases are attached below. Use the run button to check them.',
      coachError: 'Coach error',
      raiseCeiling: 'Raise ceiling',
      lockedAt: 'Needs L{level}',
      openExternal: 'Open on LeetCode',
      selectProblem: 'Select a problem',
      solvedChip: 'Solved',
      attemptedChip: 'In progress',
      cleanChip: 'Clean solve',
      runtime: 'Runtime',
      progressLabel: '{done} / {total} curated',
      editorPlaceholder: 'Write your solution here…',
      unsaved: 'Unsaved',
      importLink: 'Import a LeetCode URL',
      catalogError: 'Could not load the catalog.',
      bootFailed: 'The arena could not read its state.',
      bootRetry: 'Try again',
      loading: 'Loading arena…',
      tags: 'Tags',
      pattern: 'Pattern',
      examplesCount: '{n} examples',
      hiddenCount: '{n} hidden',
      visibleCount: '{n} visible',
      solvedToast: 'Solved. Nice work.',
      languageUnsupported: 'This language is not supported for this signature.',
      noCoachTests: 'Ask the coach for edge cases first.',
      clearDone: 'Coach thread cleared.',
      codeReset: 'Code reset to the starter.',
      level0: 'Syntax only',
      level1: 'Clarify',
      level2: 'Nudge',
      level3: 'Outline',
      level4: 'Pseudocode',
      level5: 'Full solution',
      level0Desc: 'Language syntax, stdlib APIs, and error messages. No logic help.',
      level1Desc: 'Restate the task, contract, constraints, and edge cases. No approach.',
      level2Desc: 'Name the algorithm family, target complexity, and one invariant.',
      level3Desc: 'Ordered approach, invariants, and edge cases. No code.',
      level4Desc: 'Detailed pseudocode. Still no compilable solution.',
      level5Desc: 'Approach, complete code, complexity, and pitfalls.',
      emptyTestCase: 'No arguments',
      noTags: 'No tags',
      lastRunShort: 'Last run',
      compileHint: 'Read the first error line, then fix one thing at a time.',
      coachIntro: 'The ceiling applies to the coach. Static hints below are separate and also gated by level.',
      problemLoading: 'Loading problem…',
      allProblems: 'All free problems',
      curatedOnly: 'Curated ladder',
      importedOnly: 'Your imports',
      searchEmptyTitle: 'Nothing here yet',
      searchEmptyBody: 'Try a different search, or import a LeetCode URL.',
      openCatalogHint: 'Pick from the catalog on the left.',
    };

    const zh = {
      nav: 'LeetCode 练习场',
      title: 'LeetCode 练习场',
      subtitle: '刻意练习',
      catalog: '题库',
      coach: '教练',
      all: '全部',
      curated: '精选',
      imported: '已导入',
      searchPlaceholder: '搜索题目',
      importPlaceholder: '粘贴 LeetCode 链接或 slug',
      importAction: '导入',
      importing: '导入中…',
      importHint: '支持函数签名简单的免费题目；设计类题目只能阅读。',
      importDone: '已导入 {title}。',
      importProblem: '导入题目',
      filterAll: '全部难度',
      easy: '简单',
      medium: '中等',
      hard: '困难',
      offline: '无法连接 LeetCode。精选题目和已保存草稿仍可用。',
      retry: '重试',
      clear: '清除',
      loadMore: '加载更多',
      showing: '已显示 {n} 道',
      noResults: '没有匹配的题目。',
      welcomeTitle: '选一道题，保留思考的难度。',
      welcomeLead: '练习场在本机运行代码、检查可信用例，教练的提示上限由你控制。',
      statSolved: '已解决',
      statClean: '无提示通过',
      statAttempted: '进行中',
      statImported: '已导入',
      startHere: '从一种模式开始',
      openCatalog: '浏览题库',
      howCoach: '教练如何工作',
      howCoachLead: 'L0 只讲语法。每升一级多给一点帮助。任何等级都可以问纯语法问题。',
      statement: '题目',
      examples: '示例',
      constraints: '约束',
      hints: '提示',
      hintsLocked: '静态提示从 L2 开始。语法问题随时可以问教练。',
      hintNext: '提升到 L{level} 查看下一条提示',
      input: '输入',
      output: '输出',
      explanation: '解释',
      run: '运行',
      submit: '提交',
      checkExamples: '检查示例',
      running: '运行中…',
      resetCode: '重置',
      resetConfirm: '重置这道题已保存的代码？',
      copy: '复制',
      copied: '已复制',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      saveFailed: '未保存',
      language: '语言',
      results: '结果',
      passed: '通过',
      failed: '失败',
      casesPassed: '通过 {passed} / {total}',
      buildError: '编译错误',
      caseLabel: '用例 {n}',
      hidden: '隐藏',
      visible: '可见',
      expected: '期望',
      actual: '实际',
      error: '错误',
      lastRun: '上次运行：{passed}/{total}',
      noRun: '运行用例后在这里查看结果。',
      noCode: '先写代码，再运行。',
      notRunnable: '这道题暂时没有可运行的测试。',
      designNotice: '设计类题目可以阅读，但运行器暂不支持类接口。',
      examplesOnly: '导入题目只公开示例用例；隐藏测试不可见。',
      level: '帮助上限',
      levelHint: '教练不能超过这个等级。',
      syntax: '语法',
      clarify: '澄清',
      nudge: '点拨',
      outline: '思路',
      pseudocode: '伪代码',
      solution: '查看题解',
      complexity: '复杂度',
      review: '审查',
      tests: '边界用例',
      concept: '概念',
      ask: '提问',
      coachEmpty: '问一个语法问题，或者提升上限获取点拨。',
      coachPlaceholder: '问语法、报错，或你的思路…',
      coachThinking: '思考中…',
      coachNoModel: '尚未配置默认模型。请在“设置 → 模型”中设置。',
      noModelShort: '无模型',
      clearChat: '清空',
      clearConfirm: '清空这个教练会话？',
      testsCard: '教练用例',
      testsVerified: '已用参考解验证',
      testsUnverified: '未验证——请自行判断',
      runCoachTests: '运行这些用例',
      testsDropped: '丢弃 {n} 个用例：参考解不一致。',
      testsAttached: '生成的用例附在下方，点击运行按钮检查。',
      coachError: '教练错误',
      raiseCeiling: '提升上限',
      lockedAt: '需要 L{level}',
      openExternal: '在 LeetCode 打开',
      selectProblem: '选择题目',
      solvedChip: '已解决',
      attemptedChip: '进行中',
      cleanChip: '无提示通过',
      runtime: '耗时',
      progressLabel: '精选 {done} / {total}',
      editorPlaceholder: '在这里写解法…',
      unsaved: '未保存',
      importLink: '导入 LeetCode 链接',
      catalogError: '无法加载题库。',
      bootFailed: '练习场无法读取状态。',
      bootRetry: '重试',
      loading: '正在加载练习场…',
      tags: '标签',
      pattern: '模式',
      examplesCount: '{n} 个示例',
      hiddenCount: '{n} 个隐藏',
      visibleCount: '{n} 个可见',
      solvedToast: '通过了，做得好。',
      languageUnsupported: '该签名暂不支持这门语言。',
      noCoachTests: '先让教练生成边界用例。',
      clearDone: '教练会话已清空。',
      codeReset: '代码已重置为初始模板。',
      level0: '仅语法',
      level1: '澄清',
      level2: '点拨',
      level3: '思路',
      level4: '伪代码',
      level5: '完整题解',
      level0Desc: '只讲语言语法、标准库 API 和报错，不给逻辑帮助。',
      level1Desc: '复述题意、输入输出、约束和边界，不给做法。',
      level2Desc: '点出算法类别、目标复杂度和一个不变量。',
      level3Desc: '给出有序思路、不变量和边界，不写代码。',
      level4Desc: '给出详细伪代码，仍不提供可编译解法。',
      level5Desc: '完整思路、代码、复杂度和坑点。',
      emptyTestCase: '无参数',
      noTags: '无标签',
      lastRunShort: '上次运行',
      compileHint: '先读第一行错误，一次只修一个问题。',
      coachIntro: '上限约束教练；下方静态提示也按等级解锁。',
      problemLoading: '正在加载题目…',
      allProblems: '全部免费题',
      curatedOnly: '精选题单',
      importedOnly: '我的导入',
      searchEmptyTitle: '这里还没有内容',
      searchEmptyBody: '换个关键词，或导入一个 LeetCode 链接。',
      openCatalogHint: '从左侧题库开始。',
    };

    const CSS = `
.lca-root{display:flex;flex-direction:column;height:100%;min-height:0;position:relative;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;overflow:hidden}
.lca-root *{box-sizing:border-box}
.lca-root button,.lca-root input,.lca-root textarea{font:inherit;color:inherit}
.lca-root button{cursor:pointer}
.lca-root button:disabled{cursor:default}
.lca-root .lca-spacer{flex:1;min-width:0}
.lca-root :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.lca-top{height:46px;flex:0 0 46px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);position:relative;z-index:30}
.lca-brand{display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap}
.lca-brand-mark{width:22px;height:22px;border-radius:6px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);display:grid;place-items:center;flex:0 0 auto}
.lca-brand-title{font-size:13px;font-weight:600;letter-spacing:.01em}
.lca-top-spacer{flex:1;min-width:8px}
.lca-top-progress{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.lca-progress-bar{width:90px;height:5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.lca-progress-fill{height:100%;background:var(--dsw-alias-brand-primary);border-radius:999px;transition:width .25s ease}
.lca-top-count{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}
.lca-top-btn{display:none;height:28px;padding:0 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);align-items:center;gap:5px;font-size:11px}
.lca-top-btn[data-active="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.lca-body{display:flex;flex:1;min-height:0;position:relative}
.lca-catalog{width:264px;flex:0 0 264px;min-height:0;border-right:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.lca-cat-head{padding:10px 12px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto}
.lca-cat-title-row{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.lca-pane-title{font-size:12px;font-weight:600;letter-spacing:.02em}
.lca-count{font-size:10px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:0 6px;line-height:16px}
.lca-cat-title-row .lca-spacer{flex:1}
.lca-iconbtn{width:26px;height:26px;border-radius:6px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
.lca-iconbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.lca-search{position:relative;display:flex;align-items:center}
.lca-search svg{position:absolute;left:8px;color:var(--dsw-alias-label-secondary);pointer-events:none}
.lca-input{height:30px;width:100%;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);padding:0 9px;font-size:12px;outline:none;min-width:0}
.lca-input::placeholder{color:var(--dsw-alias-label-secondary)}
.lca-input:focus{border-color:var(--dsw-alias-brand-primary)}
.lca-search .lca-input{padding-left:28px;padding-right:24px}
.lca-search-clear{position:absolute;right:4px;width:20px;height:20px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);display:grid;place-items:center;border-radius:4px}
.lca-search-clear:hover{background:var(--dsw-alias-bg-layer-2)}
.lca-cat-import{display:flex;gap:5px;margin-top:6px}
.lca-cat-import .lca-input{height:28px;font-size:11px}
.lca-cat-import .lca-btn{height:28px;flex:0 0 auto}
.lca-cat-filters{display:flex;flex-wrap:wrap;gap:4px;padding:7px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto}
.lca-tab{height:23px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:23px;white-space:nowrap}
.lca-tab:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.lca-tab[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}
.lca-chip{height:21px;padding:0 7px;border-radius:999px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:19px;white-space:nowrap}
.lca-chip:hover{color:var(--dsw-alias-label-primary)}
.lca-chip[data-active="true"]{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.lca-cat-list{flex:1;min-height:0;overflow:auto;padding:4px 0 8px}
.lca-cat-row{display:grid;grid-template-columns:13px minmax(0,1fr) auto;gap:7px;width:100%;padding:7px 12px;border:0;border-left:2px solid transparent;background:transparent;text-align:left;align-items:start}
.lca-cat-row:hover{background:var(--dsw-alias-bg-layer-2)}
.lca-cat-row[data-active="true"]{background:var(--dsw-alias-bg-layer-2);border-left-color:var(--dsw-alias-brand-primary)}
.lca-dot{width:7px;height:7px;border-radius:50%;margin-top:5px;border:1px solid var(--dsw-alias-border-l2);background:transparent;flex:0 0 auto}
.lca-dot[data-status="solved"]{background:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.lca-dot[data-status="attempted"]{background:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.lca-cat-copy{min-width:0;display:flex;flex-direction:column;gap:1px}
.lca-cat-name{display:flex;align-items:center;gap:4px;font-size:12px;line-height:17px;font-weight:500;min-width:0}
.lca-cat-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lca-cat-meta{font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;gap:5px;align-items:center}
.lca-cat-side{display:flex;flex-direction:column;align-items:flex-end;gap:2px;margin-top:1px}
.lca-diff{font-size:9.5px;line-height:15px;padding:0 5px;border-radius:4px;white-space:nowrap;font-weight:500}
.lca-diff[data-d="Easy"]{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 13%,transparent)}
.lca-diff[data-d="Medium"]{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 13%,transparent)}
.lca-diff[data-d="Hard"]{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 13%,transparent)}
.lca-cat-foot{flex:0 0 auto;border-top:1px solid var(--dsw-alias-border-l1);padding:7px 12px;display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.lca-cat-foot .lca-spacer{flex:1}
.lca-cat-empty{padding:26px 16px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px}
.lca-offline{margin:7px 12px 0;padding:7px 9px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,transparent);border-radius:7px;font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-secondary)}
.lca-center{display:flex;flex:1;min-width:0;min-height:0}
.lca-problem{width:44%;flex:0 0 44%;min-width:300px;min-height:0;border-right:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.lca-problem-head{padding:11px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;align-items:flex-start;gap:8px;flex:0 0 auto}
.lca-problem-head-main{min-width:0;flex:1}
.lca-problem-title{font-size:16px;line-height:22px;font-weight:600;letter-spacing:.005em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lca-problem-sub{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:3px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.lca-problem-sub .lca-diff{font-size:9.5px}
.lca-problem-scroll{flex:1;min-height:0;overflow:auto;padding:14px 18px 32px}
.lca-md-h{font-weight:600;margin:16px 0 7px;letter-spacing:.005em}
.lca-md-h:first-child{margin-top:0}
h3.lca-md-h{font-size:14px;line-height:21px}
h4.lca-md-h{font-size:13px;line-height:20px}
.lca-md-p{margin:0 0 10px;white-space:pre-wrap;overflow-wrap:anywhere}
.lca-md-list{margin:0 0 10px;padding-left:20px}
.lca-md-list li{margin:2px 0}
.lca-md-quote{margin:0 0 10px;padding:6px 10px;border-left:2px solid var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-radius:0 6px 6px 0}
.lca-md-hr{height:1px;background:var(--dsw-alias-border-l1);margin:14px 0;border:0}
.lca-inline-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 4px;overflow-wrap:anywhere}
.lca-md-link{color:var(--dsw-alias-brand-primary);text-decoration:none}
.lca-md-link:hover{text-decoration:underline}
.lca-codeblock{margin:0 0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.lca-codeblock-head{display:flex;align-items:center;gap:6px;padding:3px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:9.5px;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.05em}
.lca-codeblock-head .lca-spacer{flex:1}
.lca-codeblock pre{margin:0;padding:9px 11px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-primary);white-space:pre}
.lca-copy{height:19px;padding:0 5px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:9.5px;display:inline-flex;align-items:center;gap:3px}
.lca-copy:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.lca-examples{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);margin:0 0 12px;overflow:hidden}
.lca-examples summary{cursor:pointer;padding:7px 10px;font-size:11px;font-weight:600;list-style:none;display:flex;align-items:center;gap:6px}
.lca-examples summary::-webkit-details-marker{display:none}
.lca-example{padding:7px 10px;border-top:1px solid var(--dsw-alias-border-l1)}
.lca-example-line{font-size:11.5px;line-height:17px;white-space:pre-wrap;overflow-wrap:anywhere}
.lca-example-line b{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--dsw-alias-label-secondary);margin-right:5px;font-weight:500}
.lca-example-input{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
.lca-example-explain{font-size:10.5px;color:var(--dsw-alias-label-secondary);margin-top:3px;line-height:15px}
.lca-constraints{margin:0 0 12px;padding-left:18px;font-size:11.5px;line-height:18px}
.lca-constraints li{margin:1px 0}
.lca-hints{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:9px 10px;margin:0 0 12px}
.lca-hints-head{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;margin-bottom:5px}
.lca-hints-head .lca-spacer{flex:1}
.lca-hint{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary);margin:6px 0;padding-left:14px;position:relative;white-space:pre-wrap}
.lca-hint:before{content:attr(data-n);position:absolute;left:0;top:0;font-size:9px;color:var(--dsw-alias-brand-primary);font-weight:600}
.lca-notice{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:8px 10px;margin:0 0 12px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.lca-notice b{color:var(--dsw-alias-label-primary);font-weight:600}
.lca-notice[data-kind="warn"]{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent)}
.lca-notice[data-kind="error"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,transparent)}
.lca-workspace{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.lca-ws-head{height:38px;flex:0 0 38px;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;gap:6px;padding:0 10px}
.lca-seg{display:flex;gap:1px;padding:2px;background:var(--dsw-alias-bg-layer-2);border-radius:7px}
.lca-seg button{height:23px;padding:0 8px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:23px}
.lca-seg button[data-active="true"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.lca-seg button:disabled{opacity:.35}
.lca-ws-spacer{flex:1}
.lca-savestate{font-size:10px;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.lca-savestate[data-state="saving"]{color:var(--dsw-alias-state-warn-primary)}
.lca-savestate[data-state="error"]{color:var(--dsw-alias-state-error-primary)}
.lca-editor-wrap{flex:1;min-height:0;display:flex;background:var(--dsw-alias-bg-layer-1);position:relative}
.lca-editor{flex:1;min-height:0;display:flex;position:relative;overflow:hidden}
.lca-gutter{width:42px;flex:0 0 42px;padding:12px 7px 12px 0;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:20px;color:var(--dsw-alias-label-secondary);opacity:.65;overflow:hidden;user-select:none;background:var(--dsw-alias-bg-layer-1)}
.lca-codearea{position:relative;flex:1;min-width:0}
.lca-pre,.lca-ta{position:absolute;inset:0;margin:0;padding:12px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;font-weight:400;font-style:normal;line-height:20px;letter-spacing:normal;word-spacing:0;font-variant-ligatures:none;font-kerning:none;tab-size:4;white-space:pre;overflow-wrap:normal;word-break:normal;overflow:auto;border:0;background:transparent;box-sizing:border-box;font-feature-settings:normal;scrollbar-width:none}
.lca-pre{pointer-events:none;z-index:0;color:var(--dsw-alias-label-primary);scrollbar-width:none}
.lca-pre code{display:block;margin:0;font-family:inherit;font-size:inherit;font-weight:inherit;font-style:inherit;line-height:inherit;letter-spacing:inherit;word-spacing:inherit;font-variant-ligatures:inherit;font-kerning:inherit;font-feature-settings:inherit;tab-size:inherit;white-space:inherit;overflow-wrap:inherit;color:inherit;background:transparent;padding:0;border:0}
.lca-pre::-webkit-scrollbar,.lca-ta::-webkit-scrollbar{display:none;width:0;height:0}
.lca-ta{z-index:1;color:transparent;-webkit-text-fill-color:transparent;caret-color:var(--dsw-alias-label-primary);resize:none;outline:none}
.lca-ta::selection{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent);color:transparent}
.lca-ta::placeholder{color:var(--dsw-alias-label-secondary);-webkit-text-fill-color:var(--dsw-alias-label-secondary)}
.lca-tok-keyword{color:var(--dsw-alias-brand-primary)}
.lca-tok-string{color:var(--dsw-alias-state-success-primary)}
.lca-tok-comment{color:var(--dsw-alias-label-secondary)}
.lca-tok-number{color:var(--dsw-alias-state-warn-primary)}
.lca-tok-builtin{color:var(--dsw-alias-state-idle-primary)}
.lca-tok-type{color:var(--dsw-alias-state-idle-primary)}
.lca-tok-fn{color:var(--dsw-alias-label-primary)}
.lca-editor-status{height:24px;flex:0 0 24px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;gap:10px;padding:0 10px;font-size:10px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);font-variant-numeric:tabular-nums}
.lca-editor-status .lca-spacer{flex:1}
.lca-actionbar{height:46px;flex:0 0 46px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;gap:6px;padding:0 10px;background:var(--dsw-alias-bg-base)}
.lca-actionbar .lca-spacer{flex:1}
.lca-btn{height:30px;padding:0 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:11.5px;white-space:nowrap}
.lca-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.lca-btn:disabled{opacity:.42}
.lca-btn[data-variant="primary"]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.lca-btn[data-variant="primary"]:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 88%,var(--dsw-alias-label-primary))}
.lca-btn[data-variant="ghost"]{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}
.lca-btn[data-variant="ghost"]:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.lca-btn[data-variant="danger"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);color:var(--dsw-alias-state-error-primary);background:transparent}
.lca-btn[data-size="sm"]{height:25px;padding:0 7px;font-size:10.5px}
.lca-kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 4px;line-height:16px;white-space:nowrap}
.lca-results{flex:0 0 auto;max-height:42%;min-height:0;border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.lca-results-head{height:34px;flex:0 0 34px;display:flex;align-items:center;gap:7px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.lca-results-title{font-size:11px;font-weight:600}
.lca-results-body{overflow:auto;padding:6px 10px 12px;min-height:0}
.lca-summary{display:flex;align-items:center;gap:8px;font-size:11.5px;padding:2px 0 7px;flex-wrap:wrap}
.lca-summary b{font-variant-numeric:tabular-nums}
.lca-summary[data-pass="true"] b{color:var(--dsw-alias-state-success-primary)}
.lca-summary[data-pass="false"] b{color:var(--dsw-alias-state-error-primary)}
.lca-summary .lca-spacer{flex:1}
.lca-meter{height:5px;flex:1;min-width:60px;background:var(--dsw-alias-bg-layer-2);border-radius:999px;overflow:hidden;max-width:180px}
.lca-meter-fill{height:100%;background:var(--dsw-alias-state-success-primary);border-radius:999px}
.lca-case{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;margin:5px 0;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.lca-case[data-pass="false"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}
.lca-case summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;padding:6px 8px;font-size:10.5px;min-width:0}
.lca-case summary::-webkit-details-marker{display:none}
.lca-case .lca-spacer{flex:1}
.lca-case-input{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.lca-case-body{padding:0 8px 8px;display:grid;gap:5px}
.lca-case-row{display:grid;grid-template-columns:56px minmax(0,1fr);gap:6px;align-items:start;font-size:10.5px}
.lca-case-label{color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em;font-size:9px;padding-top:2px}
.lca-pre-line{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;line-height:16px;background:var(--dsw-alias-bg-layer-2);border-radius:5px;padding:5px 7px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:150px;overflow:auto}
.lca-error-text{color:var(--dsw-alias-state-error-primary);font-size:10.5px;line-height:16px;white-space:pre-wrap;overflow-wrap:anywhere}
.lca-big-error{border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 6%,transparent);border-radius:8px;padding:8px 10px;margin:6px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;line-height:16px;white-space:pre-wrap;max-height:200px;overflow:auto}
.lca-result-empty{padding:18px 4px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:11px}
.lca-spinner{width:14px;height:14px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:lca-spin .8s linear infinite;flex:0 0 auto}
.lca-spinner[data-size="lg"]{width:22px;height:22px;border-width:2.5px}
@keyframes lca-spin{to{transform:rotate(360deg)}}
@keyframes lca-blink{0%,45%{opacity:1}50%,100%{opacity:0}}
.lca-coach{width:358px;flex:0 0 358px;min-height:0;border-left:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.lca-coach-head{padding:9px 11px 7px;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;gap:7px;flex:0 0 auto;flex-wrap:wrap}
.lca-coach-title{font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px}
.lca-coach-model{margin-left:auto;font-size:9.5px;color:var(--dsw-alias-label-secondary);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 6px;line-height:16px}
.lca-levels{display:flex;gap:3px;padding:7px 11px 4px;flex:0 0 auto}
.lca-level{flex:1;height:23px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:21px;padding:0;font-variant-numeric:tabular-nums}
.lca-level:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.lca-level[data-active="true"]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
.lca-level-desc{padding:0 11px 7px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary);border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto}
.lca-level-desc b{color:var(--dsw-alias-label-primary);font-weight:600}
.lca-coach-actions{padding:6px 9px;border-bottom:1px solid var(--dsw-alias-border-l1);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;flex:0 0 auto}
.lca-action{height:27px;padding:0 5px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:10px;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;overflow:hidden}
.lca-action:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.lca-action:disabled{opacity:.42}
.lca-action[data-kind="solution"]{color:var(--dsw-alias-state-warn-primary)}
.lca-action svg{flex:0 0 auto}
.lca-coach-thread{flex:1;min-height:0;overflow:auto;padding:2px 0 8px;scroll-behavior:smooth}
.lca-coach-empty{margin:12px 11px;border:1px dashed var(--dsw-alias-border-l2);border-radius:9px;padding:13px 12px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;text-align:center}
.lca-msg{margin:7px 10px;padding:7px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;font-size:11.5px;line-height:17px;overflow-wrap:anywhere}
.lca-msg[data-role="user"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.lca-msg[data-role="assistant"]{background:var(--dsw-alias-bg-layer-1)}
.lca-msg[data-error="true"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 5%,transparent)}
.lca-msg-role{display:flex;align-items:center;gap:6px;font-size:8.5px;line-height:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--dsw-alias-label-secondary);margin-bottom:3px}
.lca-msg-role .lca-spacer{flex:1}
.lca-msg-text{white-space:pre-wrap;overflow-wrap:anywhere}
.lca-msg .lca-md-h{font-size:12.5px;margin:8px 0 4px}
.lca-msg .lca-md-p{margin:0 0 7px}
.lca-msg .lca-md-list{margin:0 0 7px;padding-left:17px}
.lca-msg .lca-codeblock{margin:6px 0}
.lca-msg .lca-codeblock pre{font-size:10.5px;line-height:16px;padding:7px 8px}
.lca-msg .lca-codeblock-head{font-size:8.5px;padding:2px 6px}
.lca-msg .lca-examples,.lca-msg .lca-hints{display:none}
.lca-live:after{content:'▍';color:var(--dsw-alias-brand-primary);animation:lca-blink 1s step-end infinite}
.lca-typing{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);font-size:10.5px;padding:2px 0}
.lca-dots{display:inline-flex;gap:2px}
.lca-dots i{width:3px;height:3px;border-radius:50%;background:var(--dsw-alias-label-secondary);animation:lca-blink 1.1s infinite}
.lca-dots i:nth-child(2){animation-delay:.18s}
.lca-dots i:nth-child(3){animation-delay:.36s}
.lca-testcard{margin:7px 0 0;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);padding:6px 7px;font-size:10px;line-height:14px;display:flex;flex-direction:column;gap:5px}
.lca-testcard-head{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.lca-testcard-head strong{font-size:10px}
.lca-testcard-head .lca-spacer{flex:1}
.lca-badge{font-size:9px;line-height:15px;padding:0 5px;border-radius:4px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.lca-badge[data-kind="ok"]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 40%,transparent)}
.lca-badge[data-kind="warn"]{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent)}
.lca-testcard-list{margin:0;padding-left:15px;color:var(--dsw-alias-label-secondary);max-height:104px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;line-height:13px}
.lca-testcard-actions{display:flex;justify-content:flex-end;gap:5px}
.lca-coach-composer{border-top:1px solid var(--dsw-alias-border-l1);padding:7px 9px;display:flex;align-items:flex-end;gap:5px;flex:0 0 auto;background:var(--dsw-alias-bg-base)}
.lca-coach-input{flex:1;min-height:34px;max-height:110px;resize:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:7px 8px;font-size:11px;line-height:16px;outline:none;min-width:0}
.lca-coach-input:focus{border-color:var(--dsw-alias-brand-primary)}
.lca-coach-input::placeholder{color:var(--dsw-alias-label-secondary)}
.lca-send{width:30px;height:30px;border-radius:7px;border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);display:grid;place-items:center;flex:0 0 auto}
.lca-send:disabled{opacity:.4}
.lca-no-model{margin:8px 10px;padding:8px 9px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent);border-radius:7px;font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-secondary)}
.lca-welcome{flex:1;min-width:0;overflow:auto;padding:34px 38px 48px}
.lca-welcome-inner{max-width:980px;margin:0 auto}
.lca-welcome h1{font-size:24px;line-height:32px;margin:0 0 6px;letter-spacing:-.01em;font-weight:600}
.lca-welcome-lead{color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:19px;max-width:660px;margin:0 0 22px}
.lca-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 24px}
.lca-stat{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px;min-width:0}
.lca-stat-value{font-size:21px;line-height:27px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.lca-stat-label{font-size:9.5px;line-height:14px;text-transform:uppercase;letter-spacing:.07em;color:var(--dsw-alias-label-secondary);margin-top:1px}
.lca-section{margin:0 0 24px}
.lca-section-head{display:flex;align-items:baseline;gap:8px;margin:0 0 9px}
.lca-section-title{font-size:12.5px;font-weight:600}
.lca-section-sub{font-size:10px;color:var(--dsw-alias-label-secondary)}
.lca-section-head .lca-spacer{flex:1}
.lca-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}
.lca-card{text-align:left;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:10px 11px;display:flex;flex-direction:column;gap:2px;min-width:0}
.lca-card:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.lca-card-title{font-size:11.5px;line-height:17px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:5px}
.lca-card-meta{font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.lca-level-list{display:grid;gap:3px;max-width:760px}
.lca-level-row{display:grid;grid-template-columns:32px 86px minmax(0,1fr);gap:8px;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:11px;line-height:16px}
.lca-level-row:last-child{border-bottom:0}
.lca-level-row b{color:var(--dsw-alias-brand-primary);font-size:10px;font-weight:600}
.lca-level-row span:nth-child(2){font-weight:500}
.lca-level-row span:nth-child(3){color:var(--dsw-alias-label-secondary)}
.lca-welcome-actions{display:flex;gap:7px;flex-wrap:wrap;margin:14px 0 0}
.lca-boot{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--dsw-alias-label-secondary);font-size:12px}
.lca-boot h2{margin:0;font-size:15px;color:var(--dsw-alias-label-primary);font-weight:600}
.lca-toast{position:fixed;right:18px;bottom:18px;z-index:80;max-width:min(380px,calc(100vw - 36px));padding:9px 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:11.5px;line-height:16px;display:flex;align-items:flex-start;gap:7px}
.lca-toast[data-kind="error"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 50%,transparent)}
.lca-toast[data-kind="success"]{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 50%,transparent)}
.lca-toast svg{flex:0 0 auto;margin-top:1px}
.lca-diagram{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:10px;margin:0 0 11px;overflow:auto}
.lca-diagram-caption{font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary);margin-top:7px;text-align:center}
.lca-array{display:flex;gap:4px;align-items:flex-end;min-width:min-content;padding:15px 0 14px}
.lca-cell{position:relative;min-width:30px;height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-2);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;padding:0 5px;flex:0 0 auto}
.lca-cell[data-hl="true"]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,var(--dsw-alias-bg-layer-2))}
.lca-cell .lca-index{position:absolute;bottom:-14px;left:0;right:0;text-align:center;font-size:8px;color:var(--dsw-alias-label-secondary);font-weight:400}
.lca-pointers{position:absolute;top:-15px;left:50%;transform:translateX(-50%);display:flex;gap:2px;white-space:nowrap}
.lca-pointer{font-size:8px;line-height:11px;padding:0 3px;border-radius:3px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.lca-matrix{display:grid;gap:3px;justify-content:start;padding-bottom:2px}
.lca-mcell{width:30px;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;background:var(--dsw-alias-bg-layer-2)}
.lca-mcell[data-hl="true"]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,var(--dsw-alias-bg-layer-2))}
.lca-list{display:flex;align-items:center;gap:2px;padding:15px 0 14px;overflow:auto}
.lca-list-node{position:relative;min-width:32px;height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;background:var(--dsw-alias-bg-layer-2);padding:0 5px}
.lca-list-node[data-hl="true"]{border-color:var(--dsw-alias-brand-primary)}
.lca-list-arrow{color:var(--dsw-alias-label-secondary);font-size:11px;padding:0 1px}
.lca-bars{display:flex;align-items:flex-end;gap:4px;height:90px;padding:14px 0 15px}
.lca-bar{position:relative;width:17px;border-radius:3px 3px 0 0;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 60%,var(--dsw-alias-bg-layer-2));border:1px solid var(--dsw-alias-brand-primary);min-height:2px}
.lca-bar[data-hl="true"]{background:var(--dsw-alias-brand-primary)}
.lca-bar .lca-bar-val{position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:8px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.lca-steps{display:flex;flex-direction:column;gap:5px}
.lca-step{display:grid;grid-template-columns:18px minmax(0,1fr);gap:6px;align-items:start;font-size:10.5px;line-height:15px}
.lca-step-n{width:17px;height:17px;border-radius:50%;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-size:8.5px;display:flex;align-items:center;justify-content:center;font-weight:600}
.lca-step b{font-weight:600}
.lca-tree{display:block;max-width:100%;height:auto;overflow:visible}
.lca-svg-text{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;fill:var(--dsw-alias-label-primary)}
.lca-svg-edge{stroke:var(--dsw-alias-border-l2);stroke-width:1.2}
.lca-svg-node{fill:var(--dsw-alias-bg-layer-2);stroke:var(--dsw-alias-border-l2);stroke-width:1.2}
.lca-svg-node[data-hl="true"]{stroke:var(--dsw-alias-brand-primary);fill:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,var(--dsw-alias-bg-layer-2))}
.lca-only-mobile{display:none}
.lca-header-action{width:26px;height:26px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center}
.lca-header-action:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.lca-nav-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.lca-nav-icon[data-active="true"]{color:var(--dsw-alias-brand-primary)}
@media (max-width: 1280px){.lca-coach{width:330px;flex-basis:330px}.lca-problem{width:42%;flex-basis:42%}}
@media (max-width: 1120px){
  .lca-coach{position:absolute;top:0;right:0;bottom:0;width:min(380px,92vw);flex-basis:auto;z-index:25;display:none;box-shadow:-16px 0 34px rgba(0,0,0,.16)}
  .lca-root[data-coach="true"] .lca-coach{display:flex}
  .lca-top-coach{display:inline-flex}
  .lca-coach .lca-only-mobile{display:inline-flex}
}
@media (max-width: 880px){
  .lca-catalog{position:absolute;top:0;left:0;bottom:0;width:min(310px,90vw);flex-basis:auto;z-index:26;display:none;box-shadow:16px 0 34px rgba(0,0,0,.16)}
  .lca-root[data-catalog="true"] .lca-catalog{display:flex}
  .lca-top-catalog{display:inline-flex}
  .lca-catalog .lca-only-mobile{display:inline-flex}
  .lca-center{flex-direction:column;overflow:auto}
  .lca-problem{width:auto;flex:0 0 auto;max-height:34vh;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1)}
  .lca-workspace{flex:1;min-height:46vh;overflow:hidden}
  .lca-progress-bar{display:none}
  .lca-top-progress .lca-top-count:nth-of-type(2){display:none}
}
@media (max-width: 620px){
  .lca-top{padding:0 9px;gap:7px}
  .lca-brand-title{font-size:12px}
  .lca-top-progress{display:none}
  .lca-welcome{padding:20px 16px 32px}
  .lca-welcome h1{font-size:20px;line-height:27px}
  .lca-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .lca-problem{max-height:30vh}
  .lca-level-row{grid-template-columns:28px 70px minmax(0,1fr)}
  .lca-actionbar{height:44px}
  .lca-btn span.lca-long{display:none}
}
`;

    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      const existing = document.querySelector('style[data-dsh-leetcode="1"]');
      if (existing) {
        existing.textContent = CSS;
        return () => {};
      }
      const style = document.createElement('style');
      style.dataset.dshLeetcode = '1';
      style.textContent = CSS;
      document.head.appendChild(style);
      return () => {
        style.remove();
      };
    }

    function readLocal(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    function writeLocal(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage is optional */
      }
    }

    async function api(path, options = {}) {
      const init = {
        method: options.body !== undefined ? 'POST' : 'GET',
        headers: { accept: 'application/json' },
        signal: options.signal,
      };
      if (options.body !== undefined) {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(options.body);
      }
      const response = await fetch(path, init);
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok) {
        const error = new Error(data?.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>]/g, (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));
    }

    function formatMs(ms) {
      if (!Number.isFinite(Number(ms))) return '—';
      const value = Number(ms);
      if (value < 1000) return `${Math.round(value)} ms`;
      return `${(value / 1000).toFixed(value < 10000 ? 2 : 1)} s`;
    }

    function formatClock(ms) {
      if (!ms) return '';
      try {
        return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '';
      }
    }

    function short(value, max = 110) {
      const text = String(value ?? '');
      return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    }

    function diffClass(difficulty) {
      return ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium';
    }

    function actionLabelFor(action, boot, t) {
      const definition = (boot?.actions ?? []).find((item) => item.id === action);
      const fallback = definition?.label ?? action;
      const localized = t(action);
      return localized === action ? fallback : localized;
    }

    const KEYWORDS = {
      python: new Set(
        'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(
          ' ',
        ),
      ),
      javascript: new Set(
        'await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return static super switch this throw try typeof var void while with yield of async get set'.split(
          ' ',
        ),
      ),
      cpp: new Set(
        'alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq string vector unordered_map unordered_set map set queue stack deque priority_queue pair optional'.split(
          ' ',
        ),
      ),
    };

    const BUILTINS = {
      python: new Set(
        'len print range enumerate zip sum min max sorted set list dict tuple int str float bool open any all abs map filter reversed isinstance heapq deque defaultdict Counter bisect math functools itertools'.split(
          ' ',
        ),
      ),
      javascript: new Set(
        'console Math JSON Object Array String Number Boolean Map Set WeakMap WeakSet Promise Date RegExp Error parseInt parseFloat isNaN isFinite setTimeout clearTimeout'.split(
          ' ',
        ),
      ),
      cpp: new Set(
        'std cout cin endl nullptr size_t int32_t int64_t uint64_t unordered_map unordered_set vector string map set queue stack deque priority_queue pair optional'.split(
          ' ',
        ),
      ),
    };

    /** Small, fast, escaping syntax highlighter for the editor overlay. */
    function highlightCode(code, language) {
      const text = String(code ?? '');
      if (text === '') return '';
      if (text.length > 160000) return escapeHtml(text);
      const keywords = KEYWORDS[language] ?? KEYWORDS.python;
      const builtins = BUILTINS[language] ?? BUILTINS.python;
      const out = [];
      let i = 0;
      const push = (kind, value) => {
        if (kind) out.push(`<span class="lca-tok-${kind}">${escapeHtml(value)}</span>`);
        else out.push(escapeHtml(value));
      };
      while (i < text.length) {
        const ch = text[i];
        if ((language === 'python' && ch === '#') || (language !== 'python' && ch === '/' && text[i + 1] === '/')) {
          const end = text.indexOf('\n', i);
          const stop = end === -1 ? text.length : end;
          push('comment', text.slice(i, stop));
          i = stop;
          continue;
        }
        if (language !== 'python' && ch === '/' && text[i + 1] === '*') {
          const end = text.indexOf('*/', i + 2);
          const stop = end === -1 ? text.length : end + 2;
          push('comment', text.slice(i, stop));
          i = stop;
          continue;
        }
        if (language === 'python' && (text.startsWith('"""', i) || text.startsWith("'''", i))) {
          const quote = text.slice(i, i + 3);
          const end = text.indexOf(quote, i + 3);
          const stop = end === -1 ? text.length : end + 3;
          push('string', text.slice(i, stop));
          i = stop;
          continue;
        }
        if (ch === '"' || ch === "'" || (language === 'javascript' && ch === '`')) {
          let j = i + 1;
          let escaped = false;
          while (j < text.length) {
            const current = text[j];
            if (escaped) {
              escaped = false;
              j += 1;
              continue;
            }
            if (current === '\\') {
              escaped = true;
              j += 1;
              continue;
            }
            j += 1;
            if (current === ch) break;
          }
          push('string', text.slice(i, j));
          i = j;
          continue;
        }
        const number = /^(?:0[xX][0-9a-fA-F]+|\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(i));
        if (number) {
          push('number', number[0]);
          i += number[0].length;
          continue;
        }
        if (/[A-Za-z_$]/.test(ch)) {
          let j = i + 1;
          while (j < text.length && /[A-Za-z0-9_$]/.test(text[j])) j += 1;
          const word = text.slice(i, j);
          let kind = '';
          if (keywords.has(word)) kind = 'keyword';
          else if (builtins.has(word)) kind = 'builtin';
          else if (/^[A-Z]/.test(word)) kind = 'type';
          else if (/^\s*\(/.test(text.slice(j, j + 12))) kind = 'fn';
          push(kind, word);
          i = j;
          continue;
        }
        push('', ch);
        i += 1;
      }
      return out.join('');
    }

    function iconBase(size, children, props = {}) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          ...props,
        },
        children,
      );
    }

    function IconSearch({ size = 14 }) {
      return iconBase(size, [
        h('circle', { key: 'c', cx: 11, cy: 11, r: 6.5 }),
        h('path', { key: 'l', d: 'm20 20-3.2-3.2' }),
      ]);
    }
    function IconPlay({ size = 13 }) {
      return iconBase(size, [h('path', { key: 'p', d: 'M8 5.5v13l10-6.5z', fill: 'currentColor', stroke: 'none' })]);
    }
    function IconSend({ size = 14 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'm3.5 3.5 17 8.5-17 8.5 3-8.5z' }),
        h('path', { key: 'b', d: 'M6.5 12h14' }),
      ]);
    }
    function IconSpark({ size = 13 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'm12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' }),
        h('path', { key: 'b', d: 'M19 16.5 19.8 19l2.5.8-2.5.8-.8 2.5-.8-2.5L16 19.8l2.5-.8z' }),
      ]);
    }
    function IconCheck({ size = 13 }) {
      return iconBase(size, [h('path', { key: 'c', d: 'm4.5 12.5 5 5 10-11' })]);
    }
    function IconX({ size = 13 }) {
      return iconBase(size, [h('path', { key: 'x', d: 'm6 6 12 12M18 6 6 18' })]);
    }
    function IconCopy({ size = 11 }) {
      return iconBase(size, [
        h('rect', { key: 'a', x: 8, y: 8, width: 11, height: 11, rx: 2 }),
        h('path', { key: 'b', d: 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2' }),
      ]);
    }
    function IconRefresh({ size = 12 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'M20 12a8 8 0 1 1-2.3-5.6' }),
        h('path', { key: 'b', d: 'M20 3.5V9h-5.5' }),
      ]);
    }
    function IconBook({ size = 13 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z' }),
        h('path', { key: 'b', d: 'M4 20.5A2.5 2.5 0 0 1 6.5 18H20' }),
      ]);
    }
    function IconCode({ size = 13 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'm8 8-4 4 4 4' }),
        h('path', { key: 'b', d: 'm16 8 4 4-4 4' }),
        h('path', { key: 'c', d: 'm13.5 5-3 14' }),
      ]);
    }
    function IconBrain({ size = 13 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.4A3 3 0 0 0 7.5 18H9z' }),
        h('path', { key: 'b', d: 'M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.4A3 3 0 0 1 16.5 18H15z' }),
        h('path', { key: 'c', d: 'M9 4.5v15M15 4.5v15M9 10h6M9 14h6' }),
      ]);
    }
    function IconClock({ size = 12 }) {
      return iconBase(size, [
        h('circle', { key: 'a', cx: 12, cy: 12, r: 8 }),
        h('path', { key: 'b', d: 'M12 7v5l3 2' }),
      ]);
    }
    function IconList({ size = 13 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'M9 6h11M9 12h11M9 18h11' }),
        h('path', { key: 'b', d: 'M4.5 6h.01M4.5 12h.01M4.5 18h.01' }),
      ]);
    }
    function IconPencil({ size = 13 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'm4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z' }),
        h('path', { key: 'b', d: 'm14 7 3 3' }),
      ]);
    }
    function IconEye({ size = 13 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z' }),
        h('circle', { key: 'b', cx: 12, cy: 12, r: 2.5 }),
      ]);
    }
    function IconTrash({ size = 12 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'M4 7h16M9 7V4.5h6V7M6.5 7l.8 13h9.4l.8-13' }),
      ]);
    }
    function IconExternal({ size = 12 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'M14 4h6v6M20 4l-8 8' }),
        h('path', { key: 'b', d: 'M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5' }),
      ]);
    }
    function IconGlobe({ size = 10 }) {
      return iconBase(size, [
        h('circle', { key: 'a', cx: 12, cy: 12, r: 8 }),
        h('path', { key: 'b', d: 'M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16' }),
      ]);
    }
    function IconStar({ size = 10 }) {
      return iconBase(size, [h('path', { key: 'a', d: 'm12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z' })]);
    }
    function IconArena({ size = 18 }) {
      return iconBase(
        size,
        [
          h('path', { key: 'a', d: 'M8 7 3.5 12 8 17' }),
          h('path', { key: 'b', d: 'm16 7 4.5 5-4.5 5' }),
          h('path', { key: 'c', d: 'm13.5 5-3 14' }),
        ],
        { strokeWidth: 1.9 },
      );
    }
    function IconPanel({ size = 13 }) {
      return iconBase(size, [
        h('rect', { key: 'a', x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 }),
        h('path', { key: 'b', d: 'M9 4.5v15' }),
      ]);
    }
    function IconChevron({ size = 12 }) {
      return iconBase(size, [h('path', { key: 'a', d: 'm8 5 7 7-7 7' })]);
    }
    function IconAlert({ size = 14 }) {
      return iconBase(size, [
        h('path', { key: 'a', d: 'M12 3.5 22 20H2z' }),
        h('path', { key: 'b', d: 'M12 9v5M12 17.2h.01' }),
      ]);
    }

    /* ------------------------------------------------------------------ */
    /* Markdown + diagrams                                                */
    /* ------------------------------------------------------------------ */

    function inlineNodes(text, keyPrefix) {
      const nodes = [];
      const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
      let last = 0;
      let match;
      let index = 0;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index));
        const token = match[0];
        const key = `${keyPrefix}-${index++}`;
        if (token.startsWith('**')) {
          nodes.push(h('strong', { key }, token.slice(2, -2)));
        } else if (token.startsWith('`')) {
          nodes.push(h('code', { key, className: 'lca-inline-code' }, token.slice(1, -1)));
        } else if (token.startsWith('[')) {
          const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (link && /^https?:\/\//i.test(link[2])) {
            nodes.push(
              h('a', { key, className: 'lca-md-link', href: link[2], target: '_blank', rel: 'noreferrer' }, link[1]),
            );
          } else {
            nodes.push(token);
          }
        } else {
          nodes.push(h('em', { key }, token.slice(1, -1)));
        }
        last = pattern.lastIndex;
      }
      if (last < text.length) nodes.push(text.slice(last));
      return nodes;
    }

    function CodeBlock({ code, lang, t, compact = false }) {
      const [copied, setCopied] = useState(false);
      const copy = useCallback(async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard is optional */
        }
      }, [code]);
      return h(
        'div',
        { className: 'lca-codeblock' },
        !compact
          ? h(
              'div',
              { className: 'lca-codeblock-head' },
              h('span', null, lang || 'text'),
              h('span', { className: 'lca-spacer' }),
              h(
                'button',
                { type: 'button', className: 'lca-copy', onClick: copy, title: t('copy') },
                h(IconCopy, { size: 10 }),
                copied ? t('copied') : t('copy'),
              ),
            )
          : null,
        h('pre', null, h('code', null, code)),
      );
    }

    function TestsFence({ json, t }) {
      let tests = null;
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) tests = parsed;
      } catch {
        tests = null;
      }
      if (!Array.isArray(tests)) return h(CodeBlock, { code: json, lang: 'tests', t });
      return h(
        'div',
        { className: 'lca-notice' },
        h('b', null, `${tests.length} ${t('testsCard')}`),
        ` ${t('testsAttached')}`,
      );
    }

    function layoutTree(root) {
      const meta = new Map();
      let nextId = 0;
      let maxDepth = 0;
      function walk(node, depth, parentId) {
        if (!node || typeof node !== 'object') return;
        const id = nextId++;
        meta.set(node, { id, depth, parentId, value: node.val });
        maxDepth = Math.max(maxDepth, depth);
        walk(node.left, depth + 1, id);
        walk(node.right, depth + 1, id);
      }
      walk(root, 0, null);
      let cursor = 0;
      const nodes = [];
      function inorder(node) {
        if (!node || typeof node !== 'object') return;
        inorder(node.left);
        const entry = meta.get(node);
        if (entry) nodes.push({ ...entry, x: cursor++ });
        inorder(node.right);
      }
      inorder(root);
      return { nodes, maxDepth, width: Math.max(300, nodes.length * 50 + 20), height: (maxDepth + 1) * 58 + 10 };
    }

    function TreeDiagram({ data }) {
      const layout = useMemo(() => layoutTree(data.root), [data.root]);
      if (layout.nodes.length === 0) return h('div', { className: 'lca-diagram-caption' }, 'empty tree');
      const highlighted = new Set(data.highlight ?? []);
      const byId = new Map(layout.nodes.map((node) => [node.id, node]));
      const xOf = (node) => 24 + node.x * ((layout.width - 48) / Math.max(1, layout.nodes.length - 1 || 1));
      const yOf = (node) => 24 + node.depth * 58;
      return h(
        'div',
        { className: 'lca-diagram' },
        h(
          'svg',
          {
            className: 'lca-tree',
            viewBox: `0 0 ${layout.width} ${layout.height}`,
            style: { width: `${layout.width}px`, maxWidth: '100%' },
            role: 'img',
            'aria-label': data.caption || 'tree diagram',
          },
          layout.nodes
            .filter((node) => node.parentId !== null)
            .map((node) => {
              const parent = byId.get(node.parentId);
              if (!parent) return null;
              return h('line', {
                key: `e-${node.id}`,
                className: 'lca-svg-edge',
                x1: xOf(parent),
                y1: yOf(parent),
                x2: xOf(node),
                y2: yOf(node),
              });
            }),
          layout.nodes.map((node) =>
            h(
              'g',
              { key: `n-${node.id}` },
              h('circle', {
                className: 'lca-svg-node',
                cx: xOf(node),
                cy: yOf(node),
                r: 13,
                'data-hl': highlighted.has(node.value) ? 'true' : undefined,
              }),
              h(
                'text',
                {
                  className: 'lca-svg-text',
                  x: xOf(node),
                  y: yOf(node),
                  textAnchor: 'middle',
                  dominantBaseline: 'middle',
                },
                String(node.value ?? ''),
              ),
            ),
          ),
        ),
        data.caption ? h('div', { className: 'lca-diagram-caption' }, data.caption) : null,
      );
    }

    function ArrayDiagram({ data, list = false }) {
      const values = Array.isArray(data.values) ? data.values : [];
      const pointers = data.pointers && typeof data.pointers === 'object' ? data.pointers : {};
      const highlighted = new Set(Array.isArray(data.highlight) ? data.highlight : []);
      const byIndex = new Map();
      for (const [name, index] of Object.entries(pointers)) {
        if (!Number.isInteger(index)) continue;
        if (!byIndex.has(index)) byIndex.set(index, []);
        byIndex.get(index).push(name);
      }
      return h(
        'div',
        { className: 'lca-diagram' },
        h(
          'div',
          { className: list ? 'lca-list' : 'lca-array' },
          values.map((value, index) =>
            h(
              React.Fragment,
              { key: index },
              h(
                'div',
                {
                  className: list ? 'lca-list-node' : 'lca-cell',
                  'data-hl': highlighted.has(index) ? 'true' : undefined,
                },
                byIndex.has(index)
                  ? h(
                      'span',
                      { className: 'lca-pointers' },
                      byIndex.get(index).map((name) => h('span', { key: name, className: 'lca-pointer' }, name)),
                    )
                  : null,
                String(value),
                !list ? h('span', { className: 'lca-index' }, index) : null,
              ),
              list && index < values.length - 1
                ? h('span', { className: 'lca-list-arrow' }, '→')
                : null,
            ),
          ),
        ),
        data.caption ? h('div', { className: 'lca-diagram-caption' }, data.caption) : null,
      );
    }

    function MatrixDiagram({ data }) {
      const values = Array.isArray(data.values) ? data.values : [];
      const highlighted = new Set(
        (Array.isArray(data.highlight) ? data.highlight : []).map((item) =>
          Array.isArray(item) ? `${item[0]},${item[1]}` : String(item),
        ),
      );
      const cols = Math.max(1, ...values.map((row) => (Array.isArray(row) ? row.length : 0)));
      return h(
        'div',
        { className: 'lca-diagram' },
        h(
          'div',
          { className: 'lca-matrix', style: { gridTemplateColumns: `repeat(${cols}, 30px)` } },
          values.flatMap((row, r) =>
            (Array.isArray(row) ? row : []).map((value, c) =>
              h(
                'div',
                {
                  key: `${r}-${c}`,
                  className: 'lca-mcell',
                  'data-hl': highlighted.has(`${r},${c}`) ? 'true' : undefined,
                },
                String(value),
              ),
            ),
          ),
        ),
        data.caption ? h('div', { className: 'lca-diagram-caption' }, data.caption) : null,
      );
    }

    function BarsDiagram({ data }) {
      const values = Array.isArray(data.values) ? data.values : [];
      const max = Math.max(1, ...values.map((value) => Number(value) || 0));
      const highlighted = new Set(Array.isArray(data.highlight) ? data.highlight : []);
      return h(
        'div',
        { className: 'lca-diagram' },
        h(
          'div',
          { className: 'lca-bars' },
          values.map((value, index) =>
            h(
              'div',
              {
                key: index,
                className: 'lca-bar',
                'data-hl': highlighted.has(index) ? 'true' : undefined,
                style: { height: `${Math.max(2, (Number(value) / max) * 72)}px` },
                title: String(value),
              },
              h('span', { className: 'lca-bar-val' }, String(value)),
            ),
          ),
        ),
        data.caption ? h('div', { className: 'lca-diagram-caption' }, data.caption) : null,
      );
    }

    function StepsDiagram({ data }) {
      const steps = Array.isArray(data.steps) ? data.steps : [];
      return h(
        'div',
        { className: 'lca-diagram' },
        h(
          'div',
          { className: 'lca-steps' },
          steps.map((step, index) =>
            h(
              'div',
              { key: index, className: 'lca-step' },
              h('span', { className: 'lca-step-n' }, index + 1),
              h('span', null, h('b', null, String(step?.title ?? `Step ${index + 1}`)), step?.body ? ` — ${step.body}` : ''),
            ),
          ),
        ),
        data.caption ? h('div', { className: 'lca-diagram-caption' }, data.caption) : null,
      );
    }

    function Diagram({ json, t }) {
      let data = null;
      try {
        data = JSON.parse(json);
      } catch {
        data = null;
      }
      if (!data || typeof data !== 'object') return h(CodeBlock, { code: json, lang: 'diagram', t });
      const type = String(data.type ?? '').toLowerCase();
      if (type === 'tree') return h(TreeDiagram, { data });
      if (type === 'array') return h(ArrayDiagram, { data });
      if (type === 'list') return h(ArrayDiagram, { data, list: true });
      if (type === 'matrix') return h(MatrixDiagram, { data });
      if (type === 'bars') return h(BarsDiagram, { data });
      if (type === 'steps') return h(StepsDiagram, { data });
      return h(CodeBlock, { code: json, lang: type || 'diagram', t });
    }

    function Markdown({ text, t }) {
      const blocks = useMemo(() => {
        const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
        const result = [];
        let i = 0;
        let key = 0;
        const keyOf = () => `md-${key++}`;
        while (i < lines.length) {
          const line = lines[i];
          if (/^```/.test(line)) {
            const lang = line.slice(3).trim();
            const body = [];
            i += 1;
            while (i < lines.length && !/^```/.test(lines[i])) {
              body.push(lines[i]);
              i += 1;
            }
            if (i < lines.length) i += 1;
            const code = body.join('\n');
            if (lang === 'diagram') result.push(h(Diagram, { key: keyOf(), json: code, t }));
            else if (lang === 'tests') result.push(h(TestsFence, { key: keyOf(), json: code, t }));
            else result.push(h(CodeBlock, { key: keyOf(), code, lang, t }));
            continue;
          }
          if (line.trim() === '') {
            i += 1;
            continue;
          }
          const heading = line.match(/^(#{1,6})\s+(.*)$/);
          if (heading) {
            const level = Math.min(4, Math.max(3, heading[1].length + 1));
            result.push(h(level === 3 ? 'h3' : 'h4', { key: keyOf(), className: 'lca-md-h' }, inlineNodes(heading[2], keyOf())));
            i += 1;
            continue;
          }
          if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
            result.push(h('hr', { key: keyOf(), className: 'lca-md-hr' }));
            i += 1;
            continue;
          }
          if (/^\s*>\s?/.test(line)) {
            const quote = [];
            while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
              quote.push(lines[i].replace(/^\s*>\s?/, ''));
              i += 1;
            }
            result.push(h('div', { key: keyOf(), className: 'lca-md-quote' }, inlineNodes(quote.join('\n'), keyOf())));
            continue;
          }
          const listMatch = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
          if (listMatch) {
            const ordered = /\d+\./.test(listMatch[1]);
            const items = [];
            while (i < lines.length) {
              const itemMatch = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
              if (!itemMatch) break;
              items.push(itemMatch[2]);
              i += 1;
            }
            result.push(
              h(
                ordered ? 'ol' : 'ul',
                { key: keyOf(), className: 'lca-md-list' },
                items.map((item, index) => h('li', { key: index }, inlineNodes(item, `${keyOf()}-${index}`))),
              ),
            );
            continue;
          }
          const paragraph = [];
          while (i < lines.length && lines[i].trim() !== '' && !/^```/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i])) {
            paragraph.push(lines[i]);
            i += 1;
          }
          result.push(h('p', { key: keyOf(), className: 'lca-md-p' }, inlineNodes(paragraph.join('\n'), keyOf())));
        }
        return result;
      }, [text, t]);
      return h(React.Fragment, null, blocks);
    }

    /* ------------------------------------------------------------------ */
    /* Editor                                                             */
    /* ------------------------------------------------------------------ */

    function Editor({ value, onChange, language, onRun, onSubmit, onSave, t }) {
      const taRef = useRef(null);
      const preRef = useRef(null);
      const gutterRef = useRef(null);
      const [cursor, setCursor] = useState({ line: 1, col: 1 });
      const pendingSelection = useRef(null);
      const highlighted = useMemo(() => highlightCode(value, language), [value, language]);
      const lineCount = value === '' ? 1 : value.split('\n').length;

      const syncScroll = useCallback(() => {
        const ta = taRef.current;
        if (!ta) return;
        if (preRef.current) {
          preRef.current.scrollTop = ta.scrollTop;
          preRef.current.scrollLeft = ta.scrollLeft;
        }
        if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
      }, []);

      const updateCursor = useCallback(() => {
        const ta = taRef.current;
        if (!ta) return;
        const position = ta.selectionStart ?? 0;
        const before = value.slice(0, position);
        const line = before.split('\n').length;
        const lineStart = before.lastIndexOf('\n');
        setCursor({ line, col: position - lineStart });
      }, [value]);

      // Replacing the highlighted markup can reset the overlay's scroll
      // position. Restore it after every value change so the visible glyphs
      // stay under the textarea caret.
      useLayoutEffect(() => {
        syncScroll();
      }, [value, syncScroll]);

      useLayoutEffect(() => {
        const ta = taRef.current;
        const pending = pendingSelection.current;
        if (!ta || !pending) return;
        pendingSelection.current = null;
        ta.setSelectionRange(pending.start, pending.end);
        updateCursor();
        syncScroll();
        requestAnimationFrame(syncScroll);
      }, [value, updateCursor, syncScroll]);

      const replaceRange = useCallback(
        (start, end, insert, selectStart, selectEnd) => {
          const next = value.slice(0, start) + insert + value.slice(end);
          const targetStart = selectStart ?? start + insert.length;
          const targetEnd = selectEnd ?? targetStart;
          if (next === value) {
            const ta = taRef.current;
            if (ta) ta.setSelectionRange(targetStart, targetEnd);
            updateCursor();
            return;
          }
          pendingSelection.current = { start: targetStart, end: targetEnd };
          onChange(next);
        },
        [value, onChange, updateCursor],
      );

      const handleKeyDown = useCallback(
        (event) => {
          if (event.isComposing || event.keyCode === 229) return;
          const ta = event.currentTarget;
          const start = ta.selectionStart ?? 0;
          const end = ta.selectionEnd ?? 0;
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            if (event.shiftKey) onSubmit?.();
            else onRun?.();
            return;
          }
          if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
            event.preventDefault();
            onSave?.();
            return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            if (event.shiftKey && start === end) {
              const lineStart = value.lastIndexOf('\n', start - 1) + 1;
              const lineEnd = value.indexOf('\n', start);
              const endOfLine = lineEnd === -1 ? value.length : lineEnd;
              const line = value.slice(lineStart, endOfLine);
              const nextLine = line.replace(/^ {1,4}/, '');
              if (nextLine !== line) {
                const caret = Math.max(lineStart, start - (line.length - nextLine.length));
                replaceRange(lineStart, endOfLine, nextLine, caret, caret);
              }
              return;
            }
            if (start !== end) {
              const lineStart = value.lastIndexOf('\n', start - 1) + 1;
              const block = value.slice(lineStart, end);
              const lines = block.split('\n');
              if (event.shiftKey) {
                const nextLines = lines.map((line) => line.replace(/^ {1,4}/, ''));
                const nextBlock = nextLines.join('\n');
                replaceRange(lineStart, end, nextBlock, lineStart, lineStart + nextBlock.length);
              } else {
                const nextBlock = lines.map((line) => `    ${line}`).join('\n');
                replaceRange(lineStart, end, nextBlock, lineStart, lineStart + nextBlock.length);
              }
              return;
            }
            replaceRange(start, end, '    ');
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const line = value.slice(lineStart, start);
            const indent = line.match(/^\s*/)?.[0] ?? '';
            const extra = /[:\{\[\(]\s*$/.test(line) ? '    ' : '';
            replaceRange(start, end, `\n${indent}${extra}`);
          }
        },
        [value, replaceRange, onRun, onSubmit, onSave],
      );

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'lca-editor-wrap' },
          h(
            'div',
            { className: 'lca-editor' },
            h(
              'div',
              { className: 'lca-gutter', ref: gutterRef, 'aria-hidden': 'true' },
              Array.from({ length: lineCount }, (_, index) => h('div', { key: index }, index + 1)),
            ),
            h(
              'div',
              { className: 'lca-codearea' },
              h('pre', {
                className: 'lca-pre',
                ref: preRef,
                'aria-hidden': 'true',
                children: h('code', { dangerouslySetInnerHTML: { __html: `${highlighted}\n` } }),
              }),
              h('textarea', {
                ref: taRef,
                className: 'lca-ta',
                value,
                onChange: (event) => onChange(event.target.value),
                onKeyDown: handleKeyDown,
                onScroll: syncScroll,
                onSelect: updateCursor,
                onClick: updateCursor,
                onKeyUp: updateCursor,
                spellCheck: false,
                autoCapitalize: 'off',
                autoCorrect: 'off',
                autoComplete: 'off',
                wrap: 'off',
                'aria-label': t('editorPlaceholder'),
                placeholder: t('editorPlaceholder'),
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'lca-editor-status' },
          h('span', null, `Ln ${cursor.line}, Col ${cursor.col}`),
          h('span', null, `${value.length} chars`),
          h('span', { className: 'lca-spacer' }),
          h('span', null, LANGS.find((item) => item.id === language)?.label ?? language),
          h('span', null, 'Tab 4'),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Results                                                            */
    /* ------------------------------------------------------------------ */

    function ResultsPane({ result, extra, running, error, last, t }) {
      const data = result;
      const total = data?.total ?? 0;
      const passed = data?.passed ?? 0;
      const allPassed = total > 0 && passed === total && !data?.compileError;
      return h(
        'div',
        { className: 'lca-results' },
        h(
          'div',
          { className: 'lca-results-head' },
          h('span', { className: 'lca-results-title' }, t('results')),
          data ? h('span', { className: 'lca-badge', 'data-kind': allPassed ? 'ok' : 'warn' }, `${passed}/${total}`) : null,
          data?.durationMs ? h('span', { className: 'lca-badge' }, formatMs(data.durationMs)) : null,
          extra?.length ? h('span', { className: 'lca-badge' }, `+${extra.length} coach`) : null,
          h('span', { className: 'lca-spacer' }),
          running ? h('span', { className: 'lca-spinner' }) : null,
        ),
        h(
          'div',
          { className: 'lca-results-body' },
          error ? h('div', { className: 'lca-big-error' }, error) : null,
          running ? h('div', { className: 'lca-result-empty' }, t('running')) : null,
          !running && data
            ? h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'lca-summary', 'data-pass': String(allPassed) },
                  h('b', null, t('casesPassed', { passed, total })),
                  h('span', { className: 'lca-meter' }, h('span', { className: 'lca-meter-fill', style: { width: `${total ? (passed / total) * 100 : 0}%` } })),
                  h('span', { className: 'lca-spacer' }),
                  data.compileError ? h('span', { className: 'lca-badge', 'data-kind': 'warn' }, t('buildError')) : null,
                ),
                data.compileError
                  ? h(
                      React.Fragment,
                      null,
                      h('div', { className: 'lca-notice', 'data-kind': 'error' }, t('compileHint')),
                      h('div', { className: 'lca-big-error' }, data.compileError),
                    )
                  : data.cases.map((entry) =>
                      h(
                        'details',
                        {
                          key: entry.index,
                          className: 'lca-case',
                          'data-pass': String(entry.passed),
                          open: !entry.passed,
                        },
                        h(
                          'summary',
                          null,
                          entry.passed
                            ? h('span', { style: { color: 'var(--dsw-alias-state-success-primary)', display: 'inline-flex' } }, h(IconCheck, { size: 11 }))
                            : h('span', { style: { color: 'var(--dsw-alias-state-error-primary)', display: 'inline-flex' } }, h(IconX, { size: 11 })),
                          h('span', null, t('caseLabel', { n: entry.index + 1 })),
                          entry.hidden ? h('span', { className: 'lca-badge' }, t('hidden')) : null,
                          h('span', { className: 'lca-case-input' }, entry.input),
                          h('span', { className: 'lca-spacer' }),
                          entry.durationMs ? h('span', { className: 'lca-badge' }, formatMs(entry.durationMs)) : null,
                        ),
                        h(
                          'div',
                          { className: 'lca-case-body' },
                          h('div', { className: 'lca-case-row' }, h('span', { className: 'lca-case-label' }, t('input')), h('div', { className: 'lca-pre-line' }, entry.input)),
                          entry.error
                            ? h('div', { className: 'lca-case-row' }, h('span', { className: 'lca-case-label' }, t('error')), h('div', { className: 'lca-error-text' }, entry.error))
                            : null,
                          h('div', { className: 'lca-case-row' }, h('span', { className: 'lca-case-label' }, t('expected')), h('div', { className: 'lca-pre-line' }, entry.expected)),
                          h('div', { className: 'lca-case-row' }, h('span', { className: 'lca-case-label' }, t('actual')), h('div', { className: 'lca-pre-line' }, entry.actual)),
                        ),
                      ),
                    ),
              )
            : null,
          !running && !data && !error
            ? h(
                'div',
                { className: 'lca-result-empty' },
                last
                  ? `${t('lastRun', { passed: last.passed, total: last.total })} · ${formatMs(last.durationMs)}`
                  : t('noRun'),
              )
            : null,
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Catalog                                                            */
    /* ------------------------------------------------------------------ */

    function CatalogPane({
      t,
      boot,
      catalog,
      loading,
      error,
      scope,
      onScope,
      search,
      onSearch,
      difficulty,
      onDifficulty,
      selectedSlug,
      onOpen,
      importText,
      onImportText,
      importOpen,
      onToggleImport,
      onImport,
      importing,
      onRefresh,
      onLoadMore,
      loadingMore,
      onClose,
    }) {
      const importRef = useRef(null);
      useEffect(() => {
        if (importOpen) importRef.current?.focus();
      }, [importOpen]);
      const scopes = [
        { id: 'all', label: t('all') },
        { id: 'curated', label: t('curated') },
        { id: 'imported', label: t('imported') },
      ];
      const difficulties = [
        { id: '', label: t('filterAll') },
        { id: 'Easy', label: t('easy') },
        { id: 'Medium', label: t('medium') },
        { id: 'Hard', label: t('hard') },
      ];
      return h(
        'aside',
        { className: 'lca-catalog', 'aria-label': t('catalog') },
        h(
          'div',
          { className: 'lca-cat-head' },
          h(
            'div',
            { className: 'lca-cat-title-row' },
            h('span', { className: 'lca-pane-title' }, t('catalog')),
            h('span', { className: 'lca-count' }, String(catalog.items.length)),
            h('span', { className: 'lca-spacer' }),
            h(
              'button',
              {
                type: 'button',
                className: 'lca-iconbtn',
                onClick: onToggleImport,
                title: t('importProblem'),
                'aria-label': t('importProblem'),
                'aria-expanded': importOpen,
              },
              h(IconCode, { size: 13 }),
            ),
            h(
              'button',
              { type: 'button', className: 'lca-iconbtn lca-only-mobile', onClick: onClose, title: t('catalog'), 'aria-label': t('catalog') },
              h(IconX, { size: 13 }),
            ),
          ),
          h(
            'div',
            { className: 'lca-search' },
            h(IconSearch, { size: 13 }),
            h('input', {
              className: 'lca-input',
              value: search,
              onChange: (event) => onSearch(event.target.value),
              placeholder: t('searchPlaceholder'),
              'aria-label': t('searchPlaceholder'),
            }),
            search
              ? h(
                  'button',
                  { type: 'button', className: 'lca-search-clear', onClick: () => onSearch(''), 'aria-label': t('clear') },
                  h(IconX, { size: 10 }),
                )
              : null,
          ),
          importOpen
            ? h(
                'div',
                { className: 'lca-cat-import' },
                h('input', {
                  ref: importRef,
                  className: 'lca-input',
                  value: importText,
                  onChange: (event) => onImportText(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') onImport();
                  },
                  placeholder: t('importPlaceholder'),
                  'aria-label': t('importPlaceholder'),
                }),
                h('button', { type: 'button', className: 'lca-btn', 'data-size': 'sm', onClick: onImport, disabled: importing || !importText.trim() }, importing ? t('importing') : t('importAction')),
              )
            : null,
        ),
        h(
          'div',
          { className: 'lca-cat-filters' },
          scopes.map((item) =>
            h(
              'button',
              { key: item.id, type: 'button', className: 'lca-tab', 'data-active': String(scope === item.id), onClick: () => onScope(item.id) },
              item.label,
            ),
          ),
          h('span', { className: 'lca-spacer' }),
          difficulties.map((item) =>
            h(
              'button',
              {
                key: item.id || 'all',
                type: 'button',
                className: 'lca-chip',
                'data-active': String(difficulty === item.id),
                onClick: () => onDifficulty(item.id),
              },
              item.label,
            ),
          ),
        ),
        catalog.offline
          ? h(
              'div',
              { className: 'lca-offline' },
              h('div', null, t('offline')),
              h(
                'button',
                { type: 'button', className: 'lca-btn', 'data-size': 'sm', style: { marginTop: '5px' }, onClick: onRefresh },
                h(IconRefresh, { size: 11 }),
                t('retry'),
              ),
            )
          : error
            ? h(
                'div',
                { className: 'lca-offline' },
                h('div', null, `${t('catalogError')} ${error}`),
                h('button', { type: 'button', className: 'lca-btn', 'data-size': 'sm', style: { marginTop: '5px' }, onClick: onRefresh }, t('retry')),
              )
            : null,
        h(
          'div',
          { className: 'lca-cat-list' },
          loading && catalog.items.length === 0
            ? h(
                'div',
                { className: 'lca-cat-empty' },
                h('div', { className: 'lca-spinner', style: { margin: '0 auto 6px' } }),
                t('loading'),
              )
            : catalog.items.length === 0
              ? h(
                  'div',
                  { className: 'lca-cat-empty' },
                  h('div', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)', marginBottom: '3px' } }, t('searchEmptyTitle')),
                  h('div', null, t('searchEmptyBody')),
                )
              : catalog.items.map((item) =>
                  h(
                    'button',
                    {
                      key: item.slug,
                      type: 'button',
                      className: 'lca-cat-row',
                      'data-active': String(selectedSlug === item.slug),
                      onClick: () => onOpen(item.slug),
                      title: (item.tags ?? []).join(', ') || t('noTags'),
                    },
                    h('span', { className: 'lca-dot', 'data-status': item.solved ? 'solved' : item.status }),
                    h(
                      'span',
                      { className: 'lca-cat-copy' },
                      h(
                        'span',
                        { className: 'lca-cat-name' },
                        item.curated ? h(IconStar, { size: 9 }) : null,
                        item.imported ? h(IconGlobe, { size: 9 }) : null,
                        h('span', null, item.title),
                      ),
                      h(
                        'span',
                        { className: 'lca-cat-meta' },
                        item.curated ? `#${item.order}` : item.id ? `#${item.id}` : '',
                        item.tags?.[0] ? `· ${item.tags[0]}` : '',
                      ),
                    ),
                    h(
                      'span',
                      { className: 'lca-cat-side' },
                      item.difficulty ? h('span', { className: 'lca-diff', 'data-d': diffClass(item.difficulty) }, item.difficulty) : null,
                      item.solved ? h(IconCheck, { size: 10 }) : null,
                    ),
                  ),
                ),
        ),
        h(
          'div',
          { className: 'lca-cat-foot' },
          h('span', null, t('showing', { n: catalog.items.length })),
          h('span', { className: 'lca-spacer' }),
          catalog.hasMore
            ? h(
                'button',
                { type: 'button', className: 'lca-btn', 'data-size': 'sm', onClick: onLoadMore, disabled: loadingMore },
                loadingMore ? h('span', { className: 'lca-spinner' }) : null,
                t('loadMore'),
              )
            : catalog.total
              ? h('span', null, `${catalog.total}`)
              : null,
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Problem                                                            */
    /* ------------------------------------------------------------------ */

    function ProblemPane({ t, problem, level, onLevelChange, loading }) {
      if (!problem) {
        return h('div', { className: 'lca-problem' }, h('div', { className: 'lca-result-empty' }, t('selectProblem')));
      }
      const hints = Array.isArray(problem.hints) ? problem.hints : [];
      const unlocked = level >= 2 ? Math.min(hints.length, level - 1) : 0;
      const visibleHints = hints.slice(0, unlocked);
      const examples = Array.isArray(problem.examples) ? problem.examples : [];
      const constraints = Array.isArray(problem.constraints) ? problem.constraints : [];
      return h(
        'section',
        { className: 'lca-problem', 'aria-label': t('statement') },
        h(
          'div',
          { className: 'lca-problem-head' },
          h(
            'div',
            { className: 'lca-problem-head-main' },
            h('div', { className: 'lca-problem-title', title: problem.title }, problem.title),
            h(
              'div',
              { className: 'lca-problem-sub' },
              h('span', null, `#${problem.frontendId ?? problem.order ?? ''}`),
              h('span', { className: 'lca-diff', 'data-d': diffClass(problem.difficulty) }, problem.difficulty),
              problem.pattern ? h('span', null, problem.pattern) : null,
              problem.record?.solved ? h('span', { className: 'lca-badge', 'data-kind': 'ok' }, t('solvedChip')) : null,
              problem.record?.clean ? h('span', { className: 'lca-badge', 'data-kind': 'ok' }, t('cleanChip')) : null,
            ),
          ),
          h(
            'a',
            {
              className: 'lca-iconbtn',
              href: problem.url ?? `https://leetcode.com/problems/${problem.slug}/`,
              target: '_blank',
              rel: 'noreferrer',
              title: t('openExternal'),
              'aria-label': t('openExternal'),
              style: { color: 'var(--dsw-alias-label-secondary)' },
            },
            h(IconExternal, { size: 13 }),
          ),
        ),
        h(
          'div',
          { className: 'lca-problem-scroll' },
          loading ? h('div', { className: 'lca-notice' }, t('problemLoading')) : null,
          problem.design
            ? h('div', { className: 'lca-notice', 'data-kind': 'warn' }, h('b', null, `${t('designNotice')} `))
            : null,
          problem.paidOnly ? h('div', { className: 'lca-notice', 'data-kind': 'warn' }, h('b', null, t('examplesOnly'))) : null,
          problem.source !== 'curated' && problem.runnable
            ? h('div', { className: 'lca-notice' }, h('b', null, t('examplesOnly')))
            : null,
          h(Markdown, { text: problem.statement, t }),
          problem.source === 'curated' && examples.length > 0
            ? h(
                'details',
                { className: 'lca-examples', open: true },
                h('summary', null, `${t('examples')} (${examples.length})`),
                examples.map((example, index) =>
                  h(
                    'div',
                    { key: index, className: 'lca-example' },
                    h('div', { className: 'lca-example-line lca-example-input' }, h('b', null, t('input')), example.input),
                    h('div', { className: 'lca-example-line lca-example-input' }, h('b', null, t('output')), example.output),
                    example.explanation ? h('div', { className: 'lca-example-explain' }, example.explanation) : null,
                  ),
                ),
              )
            : null,
          constraints.length > 0
            ? h(
                'div',
                null,
                h('div', { className: 'lca-md-h', style: { fontSize: '12px' } }, t('constraints')),
                h('ul', { className: 'lca-constraints' }, constraints.map((constraint, index) => h('li', { key: index }, constraint))),
              )
            : null,
          hints.length > 0
            ? h(
                'div',
                { className: 'lca-hints' },
                h(
                  'div',
                  { className: 'lca-hints-head' },
                  h(IconSpark, { size: 12 }),
                  h('span', null, t('hints')),
                  h('span', { className: 'lca-spacer' }),
                  h('span', { className: 'lca-badge' }, `L${level}`),
                ),
                level < 2
                  ? h(
                      React.Fragment,
                      null,
                      h('div', { className: 'lca-hint', style: { paddingLeft: 0 } }, t('hintsLocked')),
                      h(
                        'button',
                        { type: 'button', className: 'lca-btn', 'data-size': 'sm', onClick: () => onLevelChange(2) },
                        h(IconChevron, { size: 10 }),
                        t('raiseCeiling'),
                      ),
                    )
                  : h(
                      React.Fragment,
                      null,
                      visibleHints.map((hint, index) =>
                        h('div', { key: index, className: 'lca-hint', 'data-n': `H${index + 1}` }, hint),
                      ),
                      hints.length > unlocked && level < 5
                        ? h(
                            'button',
                            { type: 'button', className: 'lca-btn', 'data-size': 'sm', onClick: () => onLevelChange(Math.min(5, level + 1)) },
                            h(IconChevron, { size: 10 }),
                            t('hintNext', { level: Math.min(5, level + 1) }),
                          )
                        : null,
                    ),
              )
            : null,
          h('div', { className: 'lca-notice' }, t('coachIntro')),
          h(
            'div',
            { className: 'lca-problem-sub' },
            problem.visibleCount ? h('span', { className: 'lca-badge' }, t('visibleCount', { n: problem.visibleCount })) : null,
            problem.hiddenCount ? h('span', { className: 'lca-badge' }, t('hiddenCount', { n: problem.hiddenCount })) : null,
            Array.isArray(problem.tags) ? problem.tags.slice(0, 4).map((tag) => h('span', { key: tag, className: 'lca-badge' }, tag)) : null,
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Workspace                                                          */
    /* ------------------------------------------------------------------ */

    function WorkspacePane({
      t,
      problem,
      language,
      onLanguage,
      code,
      onCode,
      saveState,
      onRun,
      onSubmit,
      running,
      result,
      extra,
      error,
      onReset,
      onCopy,
      onSave,
    }) {
      if (!problem) {
        return h('div', { className: 'lca-workspace' }, h('div', { className: 'lca-result-empty' }, t('selectProblem')));
      }
      const available = Array.isArray(problem.availableLanguages) ? problem.availableLanguages : [];
      const runnable = problem.runnable !== false && available.includes(language) && code.trim() !== '';
      const last = problem.record?.last ?? null;
      return h(
        'section',
        { className: 'lca-workspace', 'aria-label': t('results') },
        h(
          'div',
          { className: 'lca-ws-head' },
          h(
            'div',
            { className: 'lca-seg', role: 'group', 'aria-label': t('language') },
            LANGS.map((item) =>
              h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  'data-active': String(language === item.id),
                  disabled: !available.includes(item.id) && available.length > 0,
                  title: available.includes(item.id) || available.length === 0 ? item.label : t('languageUnsupported'),
                  onClick: () => onLanguage(item.id),
                },
                item.label,
              ),
            ),
          ),
          h('span', { className: 'lca-spacer' }),
          h(
            'span',
            { className: 'lca-savestate', 'data-state': saveState },
            saveState === 'saving' ? h('span', { className: 'lca-spinner', style: { width: '9px', height: '9px', borderWidth: '1.5px' } }) : null,
            saveState === 'saving' ? t('saving') : saveState === 'error' ? t('saveFailed') : t('saved'),
          ),
          h(
            'button',
            { type: 'button', className: 'lca-iconbtn', title: t('copy'), 'aria-label': t('copy'), onClick: onCopy },
            h(IconCopy, { size: 13 }),
          ),
          h(
            'button',
            { type: 'button', className: 'lca-iconbtn', title: t('resetCode'), 'aria-label': t('resetCode'), onClick: onReset },
            h(IconRefresh, { size: 13 }),
          ),
        ),
        h(Editor, {
          value: code,
          onChange: onCode,
          language,
          onRun,
          onSubmit,
          onSave,
          t,
        }),
        h(
          'div',
          { className: 'lca-actionbar' },
          h(
            'button',
            { type: 'button', className: 'lca-btn', onClick: onRun, disabled: running || !runnable },
            running ? h('span', { className: 'lca-spinner' }) : h(IconPlay, { size: 12 }),
            t('run'),
          ),
          h(
            'button',
            { type: 'button', className: 'lca-btn', 'data-variant': 'primary', onClick: onSubmit, disabled: running || !runnable },
            running ? h('span', { className: 'lca-spinner' }) : h(IconCheck, { size: 12 }),
            problem.hiddenCount > 0 ? t('submit') : t('checkExamples'),
          ),
          h('span', { className: 'lca-spacer' }),
          problem.design || !problem.runnable
            ? h('span', { className: 'lca-savestate' }, t('notRunnable'))
            : problem.hiddenCount === 0
              ? h('span', { className: 'lca-savestate' }, t('examplesOnly'))
              : null,
          h('span', { className: 'lca-kbd' }, navigator.platform && /Mac/i.test(navigator.platform) ? '⌘↵' : 'Ctrl+↵'),
          h('span', { className: 'lca-savestate' }, t('run')),
        ),
        h(ResultsPane, { result, extra, running, error, last, t }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Coach                                                              */
    /* ------------------------------------------------------------------ */

    function TestsCard({ tests, verified, dropped, t, onRun, disabled }) {
      if (!Array.isArray(tests) || tests.length === 0) return null;
      const isVerified = verified === true || tests.every((test) => test.verified === true);
      return h(
        'div',
        { className: 'lca-testcard' },
        h(
          'div',
          { className: 'lca-testcard-head' },
          h('strong', null, t('testsCard')),
          h('span', { className: 'lca-badge' }, `${tests.length}`),
          h('span', { className: 'lca-badge', 'data-kind': isVerified ? 'ok' : 'warn' }, isVerified ? t('testsVerified') : t('testsUnverified')),
          h('span', { className: 'lca-spacer' }),
        ),
        dropped
          ? h('div', { className: 'lca-badge', 'data-kind': 'warn' }, t('testsDropped', { n: dropped }))
          : null,
        h(
          'details',
          null,
          h('summary', { className: 'lca-badge', style: { cursor: 'pointer', alignSelf: 'flex-start' } }, `${tests.length} cases`),
          h(
            'ul',
            { className: 'lca-testcard-list' },
            tests.map((test, index) => h('li', { key: index }, `${JSON.stringify(test.args)} → ${JSON.stringify(test.expected)}`)),
          ),
        ),
        h(
          'div',
          { className: 'lca-testcard-actions' },
          h(
            'button',
            { type: 'button', className: 'lca-btn', 'data-size': 'sm', onClick: () => onRun(tests), disabled },
            h(IconPlay, { size: 10 }),
            t('runCoachTests'),
          ),
        ),
      );
    }

    function CoachMessage({ message, t, onRunTests, disabled }) {
      const isUser = message.role === 'user';
      return h(
        'div',
        { className: 'lca-msg', 'data-role': message.role, 'data-error': String(message.error === true) },
        h(
          'div',
          { className: 'lca-msg-role' },
          isUser ? t('ask') : t('coach'),
          message.level !== undefined ? h('span', { className: 'lca-badge' }, `L${message.level}`) : null,
          message.at ? h('span', null, formatClock(message.at)) : null,
          h('span', { className: 'lca-spacer' }),
        ),
        isUser
          ? h('div', { className: 'lca-msg-text' }, message.text)
          : h(Markdown, { text: message.text, t }),
        !isUser && message.tests?.length
          ? h(TestsCard, {
              tests: message.tests,
              verified: message.testsVerified,
              dropped: message.testsDropped,
              t,
              onRun: () => onRunTests(message.tests),
              disabled,
            })
          : null,
      );
    }

    function CoachPane({
      t,
      boot,
      problem,
      level,
      onLevelChange,
      thread,
      live,
      busy,
      tests,
      testsVerified,
      testsDropped,
      input,
      onInput,
      onSend,
      onAction,
      onClear,
      onRunTests,
      onClose,
    }) {
      const threadRef = useRef(null);
      const levels = boot?.levels?.length ? boot.levels : [0, 1, 2, 3, 4, 5].map((id) => ({ id, name: t(`level${id}`), description: t(`level${id}Desc`) }));
      const actions = (boot?.actions ?? []).filter((action) => action.id !== 'chat');
      const active = levels.find((item) => item.id === level) ?? levels[0];
      const model = boot?.model ? `${boot.model.provider}/${boot.model.model}` : null;
      useEffect(() => {
        const element = threadRef.current;
        if (element) element.scrollTop = element.scrollHeight;
      }, [thread, live, busy]);
      const actionIcon = (id) => {
        if (id === 'syntax') return IconCode;
        if (id === 'clarify') return IconBook;
        if (id === 'nudge') return IconSpark;
        if (id === 'complexity') return IconClock;
        if (id === 'review') return IconSearch;
        if (id === 'tests') return IconCheck;
        if (id === 'concept') return IconBrain;
        if (id === 'outline') return IconList;
        if (id === 'pseudocode') return IconPencil;
        if (id === 'solution') return IconEye;
        return IconSpark;
      };
      return h(
        'aside',
        { className: 'lca-coach', 'aria-label': t('coach') },
        h(
          'div',
          { className: 'lca-coach-head' },
          h('span', { className: 'lca-coach-title' }, h(IconSpark, { size: 13 }), t('coach')),
          model ? h('span', { className: 'lca-coach-model', title: model }, model) : h('span', { className: 'lca-coach-model' }, t('noModelShort')),
          h(
            'button',
            { type: 'button', className: 'lca-iconbtn', onClick: onClear, title: t('clearChat'), 'aria-label': t('clearChat'), disabled: busy },
            h(IconTrash, { size: 12 }),
          ),
          h(
            'button',
            { type: 'button', className: 'lca-iconbtn lca-only-mobile', onClick: onClose, title: t('coach'), 'aria-label': t('coach') },
            h(IconX, { size: 13 }),
          ),
        ),
        h(
          'div',
          { className: 'lca-levels', role: 'group', 'aria-label': t('level') },
          levels.map((item) =>
            h(
              'button',
              {
                key: item.id,
                type: 'button',
                className: 'lca-level',
                'data-active': String(level === item.id),
                title: `${item.name ?? t(`level${item.id}`)} — ${item.description ?? t(`level${item.id}Desc`)}`,
                onClick: () => onLevelChange(item.id),
                'aria-pressed': level === item.id,
              },
              `L${item.id}`,
            ),
          ),
        ),
        h(
          'div',
          { className: 'lca-level-desc' },
          h('b', null, `${t('level')} L${level} · ${t(`level${level}`)}`),
          ` — ${t(`level${level}Desc`)}`,
        ),
        !model
          ? h('div', { className: 'lca-no-model' }, t('coachNoModel'))
          : null,
        h(
          'div',
          { className: 'lca-coach-actions' },
          actions.map((action) => {
            const locked = level < action.minLevel;
            const Icon = actionIcon(action.id);
            return h(
              'button',
              {
                key: action.id,
                type: 'button',
                className: 'lca-action',
                'data-kind': action.id === 'solution' ? 'solution' : undefined,
                'data-locked': String(locked),
                disabled: busy || !model || locked || !problem,
                title: locked ? `${actionLabelFor(action.id, boot, t)} — ${t('lockedAt', { level: action.minLevel })}` : actionLabelFor(action.id, boot, t),
                onClick: () => onAction(action.id, action.minLevel),
              },
              h(Icon, { size: 11 }),
              actionLabelFor(action.id, boot, t),
            );
          }),
        ),
        h(
          'div',
          { className: 'lca-coach-thread', ref: threadRef, 'aria-live': 'polite' },
          thread.length === 0 && !busy
            ? h(
                'div',
                { className: 'lca-coach-empty' },
                h('div', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)', marginBottom: '3px' } }, t('coachEmpty')),
                problem ? h('div', null, `${t('levelHint')} ${t('level')} L${level}.`) : h('div', null, t('openCatalogHint')),
              )
            : thread.map((message, index) =>
                h(CoachMessage, {
                  key: index,
                  message,
                  t,
                  onRunTests,
                  disabled: busy,
                }),
              ),
          busy
            ? h(
                'div',
                { className: 'lca-msg', 'data-role': 'assistant' },
                h('div', { className: 'lca-msg-role' }, t('coach'), h('span', { className: 'lca-badge' }, `L${level}`), h('span', { className: 'lca-spacer' })),
                live
                  ? h('div', { className: 'lca-live' }, h(Markdown, { text: live, t }))
                  : h(
                      'div',
                      { className: 'lca-typing' },
                      t('coachThinking'),
                      h('span', { className: 'lca-dots' }, h('i'), h('i'), h('i')),
                    ),
              )
            : null,
        ),
        h(
          'div',
          { className: 'lca-coach-composer' },
          h('textarea', {
            className: 'lca-coach-input',
            value: input,
            onChange: (event) => onInput(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (input.trim()) onSend();
              }
            },
            placeholder: t('coachPlaceholder'),
            'aria-label': t('coachPlaceholder'),
            rows: 1,
            disabled: busy || !model || !problem,
          }),
          h(
            'button',
            { type: 'button', className: 'lca-send', onClick: onSend, disabled: busy || !model || !problem || !input.trim(), title: t('ask'), 'aria-label': t('ask') },
            h(IconSend, { size: 13 }),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Welcome + top bar                                                  */
    /* ------------------------------------------------------------------ */

    function Welcome({ t, boot, stats, onOpen, onBrowse, onImport }) {
      const curated = boot?.curated ?? [];
      const levels = [0, 1, 2, 3, 4, 5];
      const cards = curated.slice(0, 6);
      return h(
        'div',
        { className: 'lca-welcome' },
        h(
          'div',
          { className: 'lca-welcome-inner' },
          h('h1', null, t('welcomeTitle')),
          h('p', { className: 'lca-welcome-lead' }, t('welcomeLead')),
          h(
            'div',
            { className: 'lca-stat-grid' },
            h('div', { className: 'lca-stat' }, h('div', { className: 'lca-stat-value' }, String(stats?.curatedSolved ?? 0)), h('div', { className: 'lca-stat-label' }, t('statSolved'))),
            h('div', { className: 'lca-stat' }, h('div', { className: 'lca-stat-value' }, String(stats?.cleanSolves ?? 0)), h('div', { className: 'lca-stat-label' }, t('statClean'))),
            h('div', { className: 'lca-stat' }, h('div', { className: 'lca-stat-value' }, String(stats?.curatedAttempted ?? 0)), h('div', { className: 'lca-stat-label' }, t('statAttempted'))),
            h('div', { className: 'lca-stat' }, h('div', { className: 'lca-stat-value' }, String(stats?.importedTotal ?? 0)), h('div', { className: 'lca-stat-label' }, t('statImported'))),
          ),
          h(
            'div',
            { className: 'lca-section' },
            h(
              'div',
              { className: 'lca-section-head' },
              h('span', { className: 'lca-section-title' }, t('startHere')),
              h('span', { className: 'lca-section-sub' }, t('curatedOnly')),
              h('span', { className: 'lca-spacer' }),
              h('button', { type: 'button', className: 'lca-btn', 'data-size': 'sm', onClick: onBrowse }, h(IconPanel, { size: 11 }), t('openCatalog')),
            ),
            h(
              'div',
              { className: 'lca-cards' },
              cards.map((item) =>
                h(
                  'button',
                  { key: item.slug, type: 'button', className: 'lca-card', onClick: () => onOpen(item.slug) },
                  h(
                    'span',
                    { className: 'lca-card-title' },
                    item.solved ? h(IconCheck, { size: 10 }) : h(IconStar, { size: 10 }),
                    item.title,
                  ),
                  h(
                    'span',
                    { className: 'lca-card-meta' },
                    h('span', { className: 'lca-diff', 'data-d': diffClass(item.difficulty) }, item.difficulty),
                    h('span', null, item.pattern || item.tags?.[0] || ''),
                  ),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'lca-section' },
            h(
              'div',
              { className: 'lca-section-head' },
              h('span', { className: 'lca-section-title' }, t('howCoach')),
              h('span', { className: 'lca-section-sub' }, t('levelHint')),
            ),
            h('p', { className: 'lca-welcome-lead', style: { marginBottom: '8px' } }, t('howCoachLead')),
            h(
              'div',
              { className: 'lca-level-list' },
              levels.map((id) =>
                h(
                  'div',
                  { key: id, className: 'lca-level-row' },
                  h('b', null, `L${id}`),
                  h('span', null, t(`level${id}`)),
                  h('span', null, t(`level${id}Desc`)),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'lca-welcome-actions' },
            h('button', { type: 'button', className: 'lca-btn', 'data-variant': 'primary', onClick: onBrowse }, h(IconPanel, { size: 12 }), t('openCatalog')),
            h('button', { type: 'button', className: 'lca-btn', onClick: onImport }, h(IconCode, { size: 12 }), t('importProblem')),
            h('a', { className: 'lca-btn', href: 'https://leetcode.com/problemset/', target: '_blank', rel: 'noreferrer' }, h(IconExternal, { size: 12 }), 'leetcode.com'),
          ),
        ),
      );
    }

    function ArenaTop({ t, boot, stats, onToggleCatalog, onToggleCoach, catalogOpen, coachOpen, busy, problemLoading }) {
      const total = stats?.curatedTotal ?? 0;
      const solved = stats?.curatedSolved ?? 0;
      const percent = total > 0 ? Math.min(100, (solved / total) * 100) : 0;
      return h(
        'header',
        { className: 'lca-top' },
        h(
          'div',
          { className: 'lca-brand' },
          h('span', { className: 'lca-brand-mark' }, h(IconArena, { size: 14 })),
          h('span', { className: 'lca-brand-title' }, t('title')),
        ),
        problemLoading || busy ? h('span', { className: 'lca-spinner' }) : null,
        h('span', { className: 'lca-top-spacer' }),
        h(
          'div',
          { className: 'lca-top-progress' },
          h('span', { className: 'lca-top-count' }, h(IconCheck, { size: 11 }), `${solved}/${total}`),
          h('span', { className: 'lca-progress-bar' }, h('span', { className: 'lca-progress-fill', style: { width: `${percent}%` } })),
          h('span', { className: 'lca-top-count' }, h(IconSpark, { size: 11 }), `${stats?.cleanSolves ?? 0}`),
        ),
        h(
          'button',
          { type: 'button', className: 'lca-top-btn lca-top-catalog', 'data-active': String(catalogOpen), onClick: onToggleCatalog, 'aria-pressed': catalogOpen, title: t('catalog') },
          h(IconPanel, { size: 12 }),
          t('catalog'),
        ),
        h(
          'button',
          { type: 'button', className: 'lca-top-btn lca-top-coach', 'data-active': String(coachOpen), onClick: onToggleCoach, 'aria-pressed': coachOpen, title: t('coach') },
          h(IconSpark, { size: 12 }),
          t('coach'),
        ),
      );
    }

    function Toast({ toast, t }) {
      if (!toast) return null;
      return h(
        'div',
        { className: 'lca-toast', 'data-kind': toast.kind, role: 'status' },
        toast.kind === 'error' ? h(IconAlert, { size: 13 }) : toast.kind === 'success' ? h(IconCheck, { size: 13 }) : h(IconSpark, { size: 13 }),
        h('span', null, toast.text),
      );
    }

    function ArenaIcon({ size = 18, active = false }) {
      return h('span', { className: 'lca-nav-icon', 'data-active': active ? 'true' : undefined }, h(IconArena, { size }));
    }

    function ArenaHeaderAction({ t, openArena }) {
      return h(
        'button',
        {
          type: 'button',
          className: 'lca-header-action',
          onClick: openArena,
          title: t('nav'),
          'aria-label': t('nav'),
        },
        h(IconArena, { size: 14 }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Root                                                               */
    /* ------------------------------------------------------------------ */

    function ArenaRoot(props) {
      const slotT = props.t;
      const t = useCallback(
        (key, vars) => {
          if (slotT) return slotT(key, vars);
          let text = en[key] ?? key;
          if (vars) {
            for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
          }
          return text;
        },
        [slotT],
      );

      const [boot, setBoot] = useState(null);
      const [bootError, setBootError] = useState(null);
      const [selected, setSelected] = useState(null);
      const [problemLoading, setProblemLoading] = useState(false);
      const [language, setLanguage] = useState(() => readLocal('lc.language') || 'python');
      const [codeMap, setCodeMap] = useState({});
      const [code, setCode] = useState('');
      const [level, setLevel] = useState(0);
      const [saveState, setSaveState] = useState('saved');
      const [catalog, setCatalog] = useState(EMPTY_CATALOG);
      const [catalogLoading, setCatalogLoading] = useState(false);
      const [catalogError, setCatalogError] = useState(null);
      const [scope, setScope] = useState('all');
      const [search, setSearch] = useState('');
      const [difficulty, setDifficulty] = useState('');
      const [catalogRefresh, setCatalogRefresh] = useState(0);
      const [resultState, setResultState] = useState(EMPTY_RESULT);
      const [coachState, setCoachState] = useState(EMPTY_COACH);
      const [coachInput, setCoachInput] = useState('');
      const [toast, setToast] = useState(null);
      const [catalogOpen, setCatalogOpen] = useState(false);
      const [coachOpen, setCoachOpen] = useState(false);
      const [importOpen, setImportOpen] = useState(false);
      const [importText, setImportText] = useState('');
      const [importing, setImporting] = useState(false);
      const [loadingMore, setLoadingMore] = useState(false);

      const selectedRef = useRef(null);
      const languageRef = useRef(language);
      const saveTimer = useRef(null);
      const pendingSave = useRef(null);
      const saveSeq = useRef(0);
      const editVersion = useRef(0);
      const flushSaveRef = useRef(null);
      const openProblemRef = useRef(null);
      const toastTimer = useRef(null);
      const coachPollTimer = useRef(null);
      const coachAbortRef = useRef(null);
      const bootLoadedRef = useRef(false);
      const mountedRef = useRef(true);

      useEffect(() => {
        selectedRef.current = selected;
      }, [selected]);
      useEffect(() => {
        languageRef.current = language;
      }, [language]);
      useEffect(() => {
        mountedRef.current = true;
        return () => {
          mountedRef.current = false;
          if (toastTimer.current) clearTimeout(toastTimer.current);
          if (coachPollTimer.current) clearTimeout(coachPollTimer.current);
          coachAbortRef.current?.abort();
          void flushSaveRef.current?.();
        };
      }, []);

      const showToast = useCallback((text, kind = 'info') => {
        if (!mountedRef.current) return;
        setToast({ text: String(text ?? ''), kind, id: Date.now() });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => {
          if (mountedRef.current) setToast(null);
        }, 4200);
      }, []);

      const flushSave = useCallback(async () => {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        const payload = pendingSave.current;
        if (!payload) return;
        pendingSave.current = null;
        const version = editVersion.current;
        const seq = ++saveSeq.current;
        try {
          await api('/api/leetcode.save', { body: payload });
          if (seq === saveSeq.current && version === editVersion.current && mountedRef.current) {
            setSaveState('saved');
          }
        } catch {
          if (seq === saveSeq.current && mountedRef.current) {
            setSaveState('error');
            if (pendingSave.current === null) pendingSave.current = payload;
          }
        }
      }, []);
      useEffect(() => {
        flushSaveRef.current = flushSave;
      }, [flushSave]);

      const scheduleSave = useCallback(
        (payload) => {
          editVersion.current += 1;
          pendingSave.current = payload;
          setSaveState('saving');
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            void flushSaveRef.current?.();
          }, 700);
        },
        [],
      );

      const refreshBoot = useCallback(async () => {
        try {
          const data = await api('/api/leetcode.state');
          if (mountedRef.current) setBoot(data);
          return data;
        } catch {
          return null;
        }
      }, []);

      const openProblem = useCallback(
        async (slug) => {
          if (!slug) return;
          if (selectedRef.current?.slug === slug) {
            setCatalogOpen(false);
            setCoachOpen(false);
            return;
          }
          await flushSaveRef.current?.();
          setCatalogOpen(false);
          setCoachOpen(false);
          setProblemLoading(true);
          try {
            const data = await api(`/api/leetcode.problem?slug=${encodeURIComponent(slug)}`);
            if (!mountedRef.current) return;
            const problem = data.problem;
            const available = Array.isArray(problem.availableLanguages) ? problem.availableLanguages : [];
            const nextLanguage = available.includes(languageRef.current) ? languageRef.current : available[0] || languageRef.current;
            const map = {};
            for (const id of ['python', 'javascript', 'cpp']) {
              map[id] = problem.record?.code?.[id] ?? problem.starters?.[id] ?? '';
            }
            selectedRef.current = problem;
            setSelected(problem);
            setLanguage(nextLanguage);
            languageRef.current = nextLanguage;
            setCodeMap(map);
            setCode(map[nextLanguage] || '');
            setLevel(Number(problem.record?.level) || 0);
            setSaveState('saved');
            pendingSave.current = null;
            if (saveTimer.current) {
              clearTimeout(saveTimer.current);
              saveTimer.current = null;
            }
            setResultState(EMPTY_RESULT);
            if (coachPollTimer.current) clearTimeout(coachPollTimer.current);
            coachAbortRef.current?.abort();
            const controller = new AbortController();
            coachAbortRef.current = controller;
            setCoachState({ ...EMPTY_COACH, thread: Array.isArray(problem.record?.coach) ? problem.record.coach : [] });
            setCoachInput('');
            writeLocal('lc.lastSlug', slug);
            writeLocal('lc.language', nextLanguage);
          } catch (error) {
            showToast(error.message, 'error');
          } finally {
            if (mountedRef.current) setProblemLoading(false);
          }
        },
        [showToast],
      );
      useEffect(() => {
        openProblemRef.current = openProblem;
      }, [openProblem]);

      const loadBoot = useCallback(async () => {
        setBootError(null);
        try {
          const data = await api('/api/leetcode.state');
          if (!mountedRef.current) return null;
          setBoot(data);
          if (!bootLoadedRef.current) {
            bootLoadedRef.current = true;
            const stored = readLocal('lc.language');
            const valid = data.languages?.some((item) => item.id === stored);
            const nextLanguage = valid ? stored : data.settings?.defaultLanguage || 'python';
            setLanguage(nextLanguage);
            languageRef.current = nextLanguage;
            const last = readLocal('lc.lastSlug');
            if (last) {
              setTimeout(() => {
                if (mountedRef.current) void openProblemRef.current?.(last);
              }, 0);
            }
          }
          return data;
        } catch (error) {
          if (mountedRef.current) setBootError(error.message);
          return null;
        }
      }, []);

      useEffect(() => {
        void loadBoot();
      }, [loadBoot]);

      const updateRecord = useCallback((record, stats) => {
        if (!record) return;
        setSelected((previous) => (previous ? { ...previous, record } : previous));
        const patch = (item) =>
          item.slug === record.slug
            ? { ...item, status: record.status, solved: record.solved === true, clean: record.clean === true, level: record.level }
            : item;
        setBoot((previous) => {
          if (!previous) return previous;
          return {
            ...previous,
            stats: stats ?? previous.stats,
            curated: (previous.curated ?? []).map(patch),
            imported: (previous.imported ?? []).map(patch),
          };
        });
        setCatalog((previous) => ({
          ...previous,
          items: previous.items.map(patch),
        }));
      }, []);

      const run = useCallback(
        async (mode, explicitTests = null) => {
          if (!selected || resultState.running) return;
          if (problemLoading) return;
          if (selected.runnable === false) {
            showToast(t('notRunnable'), 'warn');
            return;
          }
          const available = Array.isArray(selected.availableLanguages) ? selected.availableLanguages : [];
          if (available.length > 0 && !available.includes(language)) {
            showToast(t('languageUnsupported'), 'warn');
            return;
          }
          if (!code.trim()) {
            showToast(t('noCode'), 'warn');
            return;
          }
          const extraTests = mode === 'coach' ? explicitTests ?? coachState.tests : [];
          if (mode === 'coach' && extraTests.length === 0) {
            showToast(t('noCoachTests'), 'warn');
            return;
          }
          await flushSaveRef.current?.();
          if (!mountedRef.current || selectedRef.current?.slug !== selected.slug) return;
          setResultState((previous) => ({ ...previous, running: true, error: null }));
          try {
            const body = {
              slug: selected.slug,
              language,
              code,
              mode,
              level,
              ...(mode === 'coach' ? { extraTests } : {}),
            };
            const data = await api('/api/leetcode.run', { body });
            if (!mountedRef.current || selectedRef.current?.slug !== selected.slug) return;
            setResultState({ data: data.result, extra: data.extra ?? [], running: false, error: null });
            updateRecord(data.record, data.stats);
            if (mode === 'coach' && Array.isArray(data.extra)) {
              setCoachState((previous) => ({ ...previous, tests: data.extra, testsVerified: data.extra.every((item) => item.verified === true) }));
            }
            if (mode === 'submit' && data.result && !data.result.compileError && data.result.total > 0 && data.result.passed === data.result.total) {
              showToast(t('solvedToast'), 'success');
            }
          } catch (error) {
            if (!mountedRef.current) return;
            setResultState((previous) => ({ ...previous, running: false, error: error.message }));
            showToast(error.message, 'error');
          }
        },
        [selected, resultState.running, problemLoading, language, code, level, coachState.tests, updateRecord, showToast, t],
      );

      const pollCoach = useCallback(
        (jobId, controller, request) => {
          const tick = async () => {
            if (!mountedRef.current || controller.signal.aborted) return;
            try {
              const data = await api(`/api/leetcode.coach?job=${encodeURIComponent(jobId)}`, { signal: controller.signal });
              if (!mountedRef.current || controller.signal.aborted) return;
              setCoachState((previous) => ({
                ...previous,
                live: data.text || '',
                error: data.error || null,
                tests: Array.isArray(data.tests) ? data.tests : [],
                testsVerified: data.testsVerified === true,
                testsDropped: data.testsDropped || 0,
                job: data.id,
              }));
              if (data.status === 'running') {
                coachPollTimer.current = setTimeout(tick, 350);
                return;
              }
              const assistant = {
                role: 'assistant',
                text: data.text || data.error || t('coachEmpty'),
                at: Date.now(),
                level: request.level,
                action: request.action,
                error: data.status === 'error' || !data.text,
                ...(data.tests?.length
                  ? { tests: data.tests, testsVerified: data.testsVerified === true, testsDropped: data.testsDropped || 0 }
                  : {}),
              };
              setCoachState((previous) => ({
                ...previous,
                busy: false,
                live: '',
                job: null,
                error: data.error || null,
                tests: Array.isArray(data.tests) ? data.tests : [],
                testsVerified: data.testsVerified === true,
                testsDropped: data.testsDropped || 0,
                thread: [...previous.thread, assistant],
              }));
              setSelected((previous) =>
                previous
                  ? {
                      ...previous,
                      record: {
                        ...previous.record,
                        level: request.level,
                        maxHintLevel: Math.max(previous.record?.maxHintLevel ?? 0, request.level),
                      },
                    }
                  : previous,
              );
              if (data.error) showToast(data.error, 'error');
            } catch (error) {
              if (!mountedRef.current || controller.signal.aborted) return;
              setCoachState((previous) => ({
                ...previous,
                busy: false,
                live: '',
                error: error.message,
                thread: [...previous.thread, { role: 'assistant', error: true, text: error.message, at: Date.now() }],
              }));
              showToast(error.message, 'error');
            }
          };
          void tick();
        },
        [showToast, t],
      );

      const startCoach = useCallback(
        async (action, message = '') => {
          if (!selected || coachState.busy || problemLoading) return;
          if (!boot?.model) {
            showToast(t('coachNoModel'), 'warn');
            return;
          }
          const definition = (boot.actions ?? []).find((item) => item.id === action);
          const minimum = definition?.minLevel ?? 0;
          if (level < minimum) {
            showToast(t('lockedAt', { level: minimum }), 'warn');
            return;
          }
          await flushSaveRef.current?.();
          if (!mountedRef.current || selectedRef.current?.slug !== selected.slug || problemLoading) return;
          if (coachPollTimer.current) clearTimeout(coachPollTimer.current);
          coachAbortRef.current?.abort();
          const controller = new AbortController();
          coachAbortRef.current = controller;
          const request = { action, level, message };
          setCoachState((previous) => ({
            ...previous,
            busy: true,
            live: '',
            error: null,
            tests: [],
            testsVerified: false,
            testsDropped: 0,
            thread: [
              ...previous.thread,
              {
                role: 'user',
                text: message.trim() || actionLabelFor(action, boot, t),
                at: Date.now(),
                level,
                action,
              },
            ],
          }));
          setCoachInput('');
          try {
            const data = await api('/api/leetcode.coach', {
              body: { slug: selected.slug, language, level, action, message, code },
              signal: controller.signal,
            });
            if (!mountedRef.current || controller.signal.aborted) return;
            pollCoach(data.job, controller, request);
          } catch (error) {
            if (!mountedRef.current || controller.signal.aborted) return;
            setCoachState((previous) => ({
              ...previous,
              busy: false,
              live: '',
              error: error.message,
              thread: [...previous.thread, { role: 'assistant', error: true, text: error.message, at: Date.now() }],
            }));
            showToast(error.message, 'error');
          }
        },
        [selected, coachState.busy, problemLoading, boot, level, language, code, pollCoach, showToast, t],
      );

      const clearCoach = useCallback(async () => {
        if (!selected || coachState.busy) return;
        if (!window.confirm(t('clearConfirm'))) return;
        try {
          await api('/api/leetcode.reset', { body: { slug: selected.slug, what: 'coach' } });
          setCoachState(EMPTY_COACH);
          showToast(t('clearDone'), 'success');
        } catch (error) {
          showToast(error.message, 'error');
        }
      }, [selected, coachState.busy, showToast, t]);

      const resetCode = useCallback(async () => {
        if (!selected) return;
        if (!window.confirm(t('resetConfirm'))) return;
        try {
          await api('/api/leetcode.reset', { body: { slug: selected.slug, what: 'code' } });
          const starter = selected.starters?.[language] ?? '';
          setCode(starter);
          setCodeMap((previous) => ({ ...previous, [language]: starter }));
          setSaveState('saved');
          pendingSave.current = null;
          showToast(t('codeReset'), 'success');
        } catch (error) {
          showToast(error.message, 'error');
        }
      }, [selected, language, showToast, t]);

      const onCodeChange = useCallback(
        (next) => {
          setCode(next);
          setCodeMap((previous) => ({ ...previous, [language]: next }));
          if (selected) scheduleSave({ slug: selected.slug, language, code: next, level });
        },
        [selected, language, level, scheduleSave],
      );

      const onLanguageChange = useCallback(
        (next) => {
          if (next === language || !selected) return;
          void flushSaveRef.current?.();
          setLanguage(next);
          languageRef.current = next;
          writeLocal('lc.language', next);
          const nextCode = codeMap[next] ?? selected.starters?.[next] ?? '';
          setCode(nextCode);
          setSaveState('saved');
        },
        [language, selected, codeMap],
      );

      const onLevelChange = useCallback(
        (next) => {
          const value = Math.max(0, Math.min(5, Number(next) || 0));
          setLevel(value);
          setSelected((previous) =>
            previous ? { ...previous, record: { ...previous.record, level: value } } : previous,
          );
          setBoot((previous) => {
            if (!previous) return previous;
            const patch = (item) => (item.slug === selected?.slug ? { ...item, level: value } : item);
            return { ...previous, curated: (previous.curated ?? []).map(patch), imported: (previous.imported ?? []).map(patch) };
          });
          if (selected) scheduleSave({ slug: selected.slug, language, code, level: value });
        },
        [selected, language, code, scheduleSave],
      );

      const copyCode = useCallback(async () => {
        try {
          await navigator.clipboard.writeText(code);
          showToast(t('copied'), 'success');
        } catch {
          showToast(t('copy'), 'warn');
        }
      }, [code, showToast, t]);

      const refreshCatalog = useCallback(() => {
        setCatalogRefresh((value) => value + 1);
      }, []);

      const catalogEnabled = boot !== null;
      useEffect(() => {
        if (!catalogEnabled) return undefined;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
          setCatalogLoading(true);
          setCatalogError(null);
          try {
            const params = new URLSearchParams({
              scope,
              search: search.trim(),
              difficulty,
              page: '0',
              limit: '60',
            });
            const data = await api(`/api/leetcode.catalog?${params.toString()}`, { signal: controller.signal });
            if (!controller.signal.aborted) setCatalog(data);
          } catch (error) {
            if (error.name === 'AbortError') return;
            if (!controller.signal.aborted) setCatalogError(error.message);
          } finally {
            if (!controller.signal.aborted) setCatalogLoading(false);
          }
        }, 250);
        return () => {
          clearTimeout(timer);
          controller.abort();
        };
      }, [catalogEnabled, scope, search, difficulty, catalogRefresh]);

      const loadMore = useCallback(async () => {
        if (!catalog.hasMore || loadingMore || scope !== 'all') return;
        setLoadingMore(true);
        try {
          const nextPage = (catalog.page ?? 0) + 1;
          const params = new URLSearchParams({
            scope,
            search: search.trim(),
            difficulty,
            page: String(nextPage),
            limit: '60',
          });
          const data = await api(`/api/leetcode.catalog?${params.toString()}`);
          setCatalog((previous) => {
            const seen = new Set(previous.items.map((item) => item.slug));
            const additions = (data.items ?? []).filter((item) => !seen.has(item.slug));
            return {
              ...previous,
              items: [...previous.items, ...additions],
              page: data.page,
              total: data.total,
              hasMore: data.hasMore,
              offline: data.offline,
            };
          });
        } catch (error) {
          showToast(error.message, 'error');
        } finally {
          setLoadingMore(false);
        }
      }, [catalog, loadingMore, scope, search, difficulty, showToast]);

      const importProblem = useCallback(async () => {
        const input = importText.trim();
        if (!input || importing) return;
        setImporting(true);
        try {
          const data = await api('/api/leetcode.import', { body: { input } });
          setImportText('');
          await refreshBoot();
          refreshCatalog();
          const slug = data.summary?.slug ?? data.problem?.slug;
          if (slug) await openProblem(slug);
          showToast(t('importDone', { title: data.summary?.title ?? slug }), 'success');
        } catch (error) {
          showToast(error.message, 'error');
        } finally {
          setImporting(false);
        }
      }, [importText, importing, refreshBoot, refreshCatalog, openProblem, showToast, t]);

      const browse = useCallback(() => {
        setScope('curated');
        setCatalogOpen(true);
      }, []);
      const openImport = useCallback(() => {
        setCatalogOpen(true);
        setImportOpen(true);
      }, []);

      if (!boot) {
        return h(
          'div',
          { className: 'lca-root' },
          bootError
            ? h(
                'div',
                { className: 'lca-boot' },
                h(IconAlert, { size: 24 }),
                h('h2', null, t('bootFailed')),
                h('div', null, bootError),
                h('button', { type: 'button', className: 'lca-btn', 'data-variant': 'primary', onClick: () => void loadBoot() }, t('bootRetry')),
              )
            : h('div', { className: 'lca-boot' }, h('span', { className: 'lca-spinner', 'data-size': 'lg' }), t('loading')),
        );
      }

      const stats = boot.stats;
      return h(
        'div',
        { className: 'lca-root', 'data-catalog': String(catalogOpen), 'data-coach': String(coachOpen) },
        h(ArenaTop, {
          t,
          boot,
          stats,
          onToggleCatalog: () => setCatalogOpen((value) => !value),
          onToggleCoach: () => setCoachOpen((value) => !value),
          catalogOpen,
          coachOpen,
          busy: coachState.busy || resultState.running || problemLoading,
          problemLoading,
        }),
        h(
          'div',
          { className: 'lca-body' },
          h(CatalogPane, {
            t,
            boot,
            catalog,
            loading: catalogLoading,
            error: catalogError,
            scope,
            onScope: setScope,
            search,
            onSearch: setSearch,
            difficulty,
            onDifficulty: setDifficulty,
            selectedSlug: selected?.slug,
            onOpen: openProblem,
            importText,
            onImportText: setImportText,
            importOpen,
            onToggleImport: () => setImportOpen((value) => !value),
            onImport: importProblem,
            importing,
            onRefresh: refreshCatalog,
            onLoadMore: loadMore,
            loadingMore,
            onClose: () => setCatalogOpen(false),
          }),
          selected
            ? h(
                'div',
                { className: 'lca-center' },
                h(ProblemPane, {
                  t,
                  problem: selected,
                  level,
                  onLevelChange,
                  loading: problemLoading,
                }),
                h(WorkspacePane, {
                  t,
                  problem: selected,
                  language,
                  onLanguage: onLanguageChange,
                  code,
                  onCode: onCodeChange,
                  saveState,
                  onRun: () => void run('run'),
                  onSubmit: () => void run('submit'),
                  running: resultState.running,
                  result: resultState.data,
                  extra: resultState.extra,
                  error: resultState.error,
                  onReset: resetCode,
                  onCopy: copyCode,
                  onSave: () => void flushSaveRef.current?.(),
                }),
              )
            : h(Welcome, {
                t,
                boot,
                stats,
                onOpen: (slug) => void openProblem(slug),
                onBrowse: browse,
                onImport: openImport,
              }),
          h(CoachPane, {
            t,
            boot,
            problem: selected,
            level,
            onLevelChange,
            thread: coachState.thread,
            live: coachState.live,
            busy: coachState.busy,
            tests: coachState.tests,
            testsVerified: coachState.testsVerified,
            testsDropped: coachState.testsDropped,
            input: coachInput,
            onInput: setCoachInput,
            onSend: () => void startCoach('chat', coachInput),
            onAction: (action) => void startCoach(action),
            onClear: clearCoach,
            onRunTests: (tests) => void run('coach', tests),
            onClose: () => setCoachOpen(false),
          }),
        ),
        h(Toast, { toast, t }),
      );
    }

    return {
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'leetcode: dictionaries');
        ctx.effect(() => installStyles(), 'leetcode: styles');

        ctx.effect(() => {
          if (typeof window === 'undefined') return undefined;
          const onKeyDown = (event) => {
            if (event.defaultPrevented || event.isComposing || event.repeat) return;
            const primary = /Mac/i.test(navigator.platform) ? event.metaKey : event.ctrlKey;
            if (!primary || !event.shiftKey || event.altKey) return;
            if (event.code !== 'KeyL') return;
            event.preventDefault();
            event.stopPropagation();
            try {
              const active = ctx.layout.panelInfo?.getSnapshot?.().activePanelId;
              ctx.layout.selectPanel(active === PANEL_ID ? null : PANEL_ID);
            } catch {
              ctx.layout.selectPanel(PANEL_ID);
            }
          };
          window.addEventListener('keydown', onKeyDown, true);
          return () => window.removeEventListener('keydown', onKeyDown, true);
        }, 'leetcode: Ctrl+Shift+L');

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
            },
            ArenaRoot,
          ),
        );
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              locale: NS,
              label: () => t('nav'),
            },
            ArenaIcon,
          ),
        );
        ctx.slots.inject('conversation.session.header.actions', () =>
          ctx.slots.register(
            {
              name: 'conversation.session.header.actions',
              id: 'leetcode-arena',
              order: 60,
              locale: NS,
              inject: () => ({ openArena: () => ctx.layout.selectPanel(PANEL_ID) }),
            },
            ArenaHeaderAction,
          ),
        );
      },
    };
  },
});
