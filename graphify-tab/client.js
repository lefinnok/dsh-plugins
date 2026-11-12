/**
 * Browser half of `@local/dsh-graphify`.
 *
 * Registers:
 *   - a `conversation.view` tab with three modes: an Explore force graph, a
 *     collapsible project Tree, and a file/folder Dependencies graph;
 *   - a `settings.section` page that manages and verifies the external
 *     dependencies declared by the project's manifests.
 *
 * Both surfaces read the Host half's authenticated `/api/graphify.*` routes.
 * Canvas rendering is native: no iframe, no CDN, no Harness Client package
 * import. All chrome uses `--dsw-alias-*` theme tokens.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-graphify',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'graphify.tab'
    const STYLE_KEY = 'dsh-graphify'
    const ROOT_KEY = 'dsh.graphify.root.'
    const SETTINGS_ROOT_KEY = 'dsh.graphify.settings.root'
    const COLORS = ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC', '#7F7F7F', '#BCBD22']

    const en = {
      nav: 'Graph',
      title: 'Project knowledge graph',
      explore: 'Explore',
      tree: 'Tree',
      deps: 'Dependencies',
      build: 'Build graph',
      update: 'Update',
      rebuild: 'Rebuild',
      refresh: 'Refresh',
      resetView: 'Reset view',
      cancel: 'Cancel',
      rootLabel: 'Project root',
      rootHint: 'Session directory',
      applyRoot: 'Apply',
      resetRoot: 'Reset',
      loading: 'Loading graph…',
      loadFailed: 'Could not load the graph',
      retry: 'Retry',
      noGraphTitle: 'No graph for this project yet',
      noGraphBody: 'Graphify parses code locally with tree-sitter AST. Code-only builds need no API key and send nothing anywhere.',
      installTitle: 'graphify is not installed',
      installBody: 'The Graph tab needs the graphify CLI on the Host PATH.',
      installHint: 'uv tool install graphifyy',
      building: 'Building graph…',
      buildStarted: 'Build started.',
      buildFailed: 'Build failed',
      buildDone: 'Graph ready.',
      statsNodes: 'nodes',
      statsEdges: 'edges',
      statsFiles: 'files',
      statsCommunities: 'communities',
      builtAt: 'built {time}',
      graphMissing: 'not built',
      graphifyVersion: 'graphify {version}',
      schemaVersion: 'schema {version}',
      searchPlaceholder: 'Search symbols, files, communities',
      searchEmpty: 'No matches.',
      searchResults: '{n} matches',
      details: 'Details',
      selectHint: 'Select a node, file, or dependency to inspect it.',
      community: 'Community',
      degree: 'Degree',
      file: 'File',
      line: 'Line',
      symbols: 'Symbols',
      neighbors: 'Connections',
      incoming: 'Incoming',
      outgoing: 'Outgoing',
      relations: 'Relations',
      confidence: 'Confidence',
      evidence: 'Evidence',
      noDetail: 'Nothing selected.',
      impact: 'Impact',
      impactTitle: 'Impacted files',
      pathFrom: 'Path from here',
      pathHint: 'Pick a second item to trace the shortest path.',
      pathResult: 'Shortest path',
      pathNone: 'No path found.',
      clear: 'Clear',
      treeFilter: 'Filter the tree',
      files: 'Files',
      dirs: 'Folders',
      depsLevelFile: 'Files',
      depsLevelFolder: 'Folders',
      depsRelations: 'Relations',
      depsCycles: 'Import cycles',
      depsNoCycles: 'No cycles',
      depsNoInternal: 'No internal file-to-file imports; showing external dependencies.',
      depsTopIn: 'Most depended on',
      depsTopOut: 'Most dependencies',
      depsOrphans: 'Isolated files',
      depsExternal: 'External',
      depsSelectFile: 'Select a file to inspect its dependencies.',
      report: 'Report',
      reportTitle: 'Graph report',
      noReport: 'No GRAPH_REPORT.md yet.',
      truncated: 'Showing {shown} of {total}.',
      close: 'Close',
      cycleBadge: '{n} cycles',
      externalsNav: 'Graphify',
      settingsTitle: 'Graphify & external dependencies',
      settingsIntro: 'Inspect the graphify runtime for one project and manage the external dependencies declared by its manifests. Verification is a manual decision recorded per project; npm packages also show the version found in node_modules.',
      runtimeTitle: 'Runtime',
      runtimeMissing: 'CLI not found',
      runtimeOk: 'CLI available',
      project: 'Project',
      rescan: 'Rescan',
      verified: 'Verify',
      ignored: 'Ignore',
      reset: 'Reset',
      status: 'Status',
      statusVerified: 'verified',
      statusInstalled: 'installed',
      statusDeclared: 'declared',
      statusMissing: 'missing',
      statusUnresolved: 'unresolved',
      statusIgnored: 'ignored',
      declaredRange: 'Declared',
      installedVersion: 'Installed',
      usage: 'Uses',
      manifest: 'Manifest',
      actions: 'Actions',
      addTitle: 'Add a dependency',
      addName: 'Package name',
      addEcosystem: 'Ecosystem',
      addRange: 'Version or note',
      addAction: 'Add',
      addFailed: 'Could not add the dependency',
      noExternals: 'No external dependencies found in this project.',
      note: 'Note',
      notePlaceholder: 'Why is this verified or ignored?',
      filterAll: 'All',
      filterAttention: 'Needs attention',
      settingsNoProject: 'No project is registered. Open a session in a workspace first.',
      externalHelp: 'Automatic detection reads package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, and composer.json. npm installs are checked in node_modules; other ecosystems expect a manual verification.',
      manifests: 'Manifests',
      noManifests: 'No recognized manifest files.',
      openFailed: 'Request failed',
      custom: 'manual',
      graphPath: 'Graph file',
      buildOutput: 'Build output',
      hide: 'Hide',
      show: 'Show',
    }

    const zh = {
      nav: '图谱',
      title: '项目知识图谱',
      explore: '探索',
      tree: '项目树',
      deps: '依赖',
      build: '构建图谱',
      update: '更新',
      rebuild: '重建',
      refresh: '刷新',
      resetView: '重置视图',
      cancel: '取消',
      rootLabel: '项目根目录',
      rootHint: '会话目录',
      applyRoot: '应用',
      resetRoot: '重置',
      loading: '正在加载图谱…',
      loadFailed: '无法加载图谱',
      retry: '重试',
      noGraphTitle: '该项目还没有图谱',
      noGraphBody: 'Graphify 使用 tree-sitter AST 在本地解析代码。仅代码模式不需要 API 密钥，也不会发送任何数据。',
      installTitle: '尚未安装 graphify',
      installBody: '图谱页需要 Host 的 PATH 中存在 graphify CLI。',
      installHint: 'uv tool install graphifyy',
      building: '正在构建图谱…',
      buildStarted: '构建已开始。',
      buildFailed: '构建失败',
      buildDone: '图谱已就绪。',
      statsNodes: '节点',
      statsEdges: '边',
      statsFiles: '文件',
      statsCommunities: '社区',
      builtAt: '构建于 {time}',
      graphMissing: '未构建',
      graphifyVersion: 'graphify {version}',
      schemaVersion: 'schema {version}',
      searchPlaceholder: '搜索符号、文件、社区',
      searchEmpty: '没有匹配项。',
      searchResults: '{n} 个匹配',
      details: '详情',
      selectHint: '选择一个节点、文件或依赖以查看详情。',
      community: '社区',
      degree: '度数',
      file: '文件',
      line: '行',
      symbols: '符号',
      neighbors: '连接',
      incoming: '入边',
      outgoing: '出边',
      relations: '关系',
      confidence: '置信度',
      evidence: '证据',
      noDetail: '未选择任何内容。',
      impact: '影响',
      impactTitle: '受影响的文件',
      pathFrom: '从此处找路径',
      pathHint: '再选择一个条目以追踪最短路径。',
      pathResult: '最短路径',
      pathNone: '未找到路径。',
      clear: '清除',
      treeFilter: '过滤项目树',
      files: '文件',
      dirs: '目录',
      depsLevelFile: '文件',
      depsLevelFolder: '目录',
      depsRelations: '关系',
      depsCycles: '导入环',
      depsNoCycles: '无环',
      depsNoInternal: '没有文件间的内部导入；当前显示外部依赖。',
      depsTopIn: '被依赖最多',
      depsTopOut: '依赖最多',
      depsOrphans: '孤立文件',
      depsExternal: '外部依赖',
      depsSelectFile: '选择一个文件查看其依赖。',
      report: '报告',
      reportTitle: '图谱报告',
      noReport: '还没有 GRAPH_REPORT.md。',
      truncated: '显示 {shown} / {total}。',
      close: '关闭',
      cycleBadge: '{n} 个环',
      externalsNav: 'Graphify',
      settingsTitle: 'Graphify 与外部依赖',
      settingsIntro: '查看某个项目的 graphify 运行时，并管理清单文件中声明的外部依赖。核验结果按项目保存；npm 包会显示 node_modules 中的版本。',
      runtimeTitle: '运行时',
      runtimeMissing: '未找到 CLI',
      runtimeOk: 'CLI 可用',
      project: '项目',
      rescan: '重新扫描',
      verified: '核验',
      ignored: '忽略',
      reset: '重置',
      status: '状态',
      statusVerified: '已核验',
      statusInstalled: '已安装',
      statusDeclared: '已声明',
      statusMissing: '缺失',
      statusUnresolved: '未解析',
      statusIgnored: '已忽略',
      declaredRange: '声明版本',
      installedVersion: '已安装',
      usage: '引用',
      manifest: '清单',
      actions: '操作',
      addTitle: '添加依赖',
      addName: '包名',
      addEcosystem: '生态',
      addRange: '版本或备注',
      addAction: '添加',
      addFailed: '添加依赖失败',
      noExternals: '未在该项目中发现外部依赖。',
      note: '备注',
      notePlaceholder: '为什么核验或忽略它？',
      filterAll: '全部',
      filterAttention: '需处理',
      settingsNoProject: '尚未注册项目。请先在工作区打开一个会话。',
      externalHelp: '自动检测会读取 package.json、requirements.txt、pyproject.toml、Cargo.toml、go.mod 与 composer.json。npm 依赖会在 node_modules 中检查；其他生态默认需要手动核验。',
      manifests: '清单文件',
      noManifests: '未发现可识别的清单文件。',
      openFailed: '请求失败',
      custom: '手动',
      graphPath: '图谱文件',
      buildOutput: '构建输出',
      hide: '收起',
      show: '展开',
    }

    let translate = (key) => key

    const css = `
      .dshg-root { position:relative; display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden; overflow-anchor:none; color:var(--dsw-alias-label-primary); font-size:12px; }
      .dshg-head { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); }
      .dshg-head-main { display:flex; align-items:center; gap:14px; min-width:0; flex:1; }
      .dshg-title { display:flex; flex-direction:column; gap:2px; min-width:0; }
      .dshg-title strong { font-size:13px; font-weight:600; }
      .dshg-rootline { display:flex; align-items:center; gap:6px; color:var(--dsw-alias-label-secondary); font-size:11px; min-width:0; }
      .dshg-rootline code { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:46vw; }
      .dshg-iconbtn { border:0; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; padding:2px 4px; border-radius:4px; font-size:11px; }
      .dshg-iconbtn:hover { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
      .dshg-rootform { display:flex; gap:6px; align-items:center; padding:6px 0 0; width:100%; }
      .dshg-rootform input { flex:1; min-width:120px; }
      .dshg-tabs { display:flex; border:1px solid var(--dsw-alias-border-l1); border-radius:7px; overflow:hidden; background:var(--dsw-alias-bg-base); }
      .dshg-tab { border:0; border-right:1px solid var(--dsw-alias-border-l1); background:transparent; color:var(--dsw-alias-label-secondary); padding:5px 12px; font-size:12px; cursor:pointer; }
      .dshg-tab:last-child { border-right:0; }
      .dshg-tab[data-active="true"] { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font-weight:600; }
      .dshg-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .dshg-btn { border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer; }
      .dshg-btn:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); }
      .dshg-btn:disabled { opacity:.55; cursor:default; }
      .dshg-btn[data-primary="true"] { background:var(--dsw-alias-brand-primary); border-color:var(--dsw-alias-brand-primary); color:#fff; }
      .dshg-btn[data-danger="true"] { color:var(--dsw-alias-state-error-primary); }
      .dshg-stats { display:flex; flex-wrap:wrap; gap:6px; padding:7px 14px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); align-items:center; }
      .dshg-chip { display:inline-flex; align-items:center; gap:4px; border:1px solid var(--dsw-alias-border-l1); border-radius:999px; padding:2px 8px; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-1); white-space:nowrap; }
      .dshg-chip b { color:var(--dsw-alias-label-primary); font-weight:600; }
      .dshg-spacer { flex:1; }
      .dshg-body { display:flex; flex:1; min-height:0; overflow:hidden; }
      .dshg-main { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; position:relative; }
      .dshg-canvaswrap { position:relative; flex:1; min-height:240px; overflow:hidden; overscroll-behavior:contain; touch-action:none; background:var(--dsw-alias-bg-base); }
      .dshg-canvaswrap canvas { display:block; width:100%; height:100%; touch-action:none; cursor:grab; }
      .dshg-canvaswrap canvas:active { cursor:grabbing; }
      .dshg-side { width:330px; flex:0 0 330px; border-left:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); display:flex; flex-direction:column; min-height:0; }
      .dshg-side-head { padding:9px 12px; border-bottom:1px solid var(--dsw-alias-border-l1); display:flex; flex-direction:column; gap:7px; }
      .dshg-side-title { font-weight:600; font-size:12px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .dshg-side-body { overflow:auto; padding:10px 12px; flex:1; min-height:0; scrollbar-gutter:stable; overflow-anchor:none; }
      .dshg-sectitle { color:var(--dsw-alias-label-secondary); font-size:10px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; margin:12px 0 5px; }
      .dshg-sectitle:first-child { margin-top:0; }
      .dshg-row { display:flex; align-items:flex-start; gap:6px; padding:4px 6px; border-radius:5px; cursor:pointer; line-height:1.35; }
      .dshg-row:hover { background:var(--dsw-alias-bg-layer-2); }
      .dshg-row[data-active="true"] { background:var(--dsw-alias-bg-layer-2); }
      .dshg-row-main { min-width:0; flex:1; }
      .dshg-row-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dshg-row-sub { color:var(--dsw-alias-label-secondary); font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dshg-mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      .dshg-muted { color:var(--dsw-alias-label-secondary); }
      .dshg-empty { margin:auto; max-width:560px; padding:28px 24px; text-align:center; display:flex; flex-direction:column; gap:10px; align-items:center; }
      .dshg-empty h2 { font-size:15px; font-weight:600; margin:0; }
      .dshg-empty p { margin:0; color:var(--dsw-alias-label-secondary); line-height:1.5; }
      .dshg-empty code { background:var(--dsw-alias-bg-layer-2); padding:2px 6px; border-radius:4px; }
      .dshg-emptyactions { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:4px; }
      .dshg-tree { overflow:auto; padding:6px 4px 20px; flex:1; min-height:0; background:var(--dsw-alias-bg-base); }
      .dshg-treebar { display:flex; gap:8px; align-items:center; padding:7px 12px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }
      .dshg-treebar input { flex:1; min-width:80px; }
      .dshg-tnode { display:flex; align-items:center; gap:4px; padding:2px 8px 2px 0; border-radius:4px; cursor:pointer; white-space:nowrap; }
      .dshg-tnode:hover { background:var(--dsw-alias-bg-layer-1); }
      .dshg-tnode[data-active="true"] { background:var(--dsw-alias-bg-layer-2); }
      .dshg-caret { width:14px; flex:0 0 14px; text-align:center; color:var(--dsw-alias-label-secondary); font-size:10px; user-select:none; }
      .dshg-ticon { width:14px; flex:0 0 14px; text-align:center; font-size:10px; color:var(--dsw-alias-label-secondary); }
      .dshg-ticon[data-kind="dir"] { color:var(--dsw-alias-brand-primary); }
      .dshg-tsize { margin-left:auto; padding-left:10px; color:var(--dsw-alias-label-secondary); font-size:10px; }
      .dshg-depsbar { display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:7px 12px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }
      .dshg-toggle { border:1px solid var(--dsw-alias-border-l1); border-radius:999px; background:transparent; color:var(--dsw-alias-label-secondary); padding:2px 8px; cursor:pointer; font-size:11px; }
      .dshg-toggle[data-on="true"] { border-color:var(--dsw-alias-brand-primary); color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2); }
      .dshg-input, .dshg-select, .dshg-note { border:1px solid var(--dsw-alias-border-l1); border-radius:6px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); padding:4px 7px; font-size:12px; min-width:0; }
      .dshg-note { width:100%; box-sizing:border-box; }
      .dshg-badge { display:inline-flex; align-items:center; border-radius:4px; padding:1px 5px; font-size:10px; border:1px solid var(--dsw-alias-border-l1); color:var(--dsw-alias-label-secondary); white-space:nowrap; }
      .dshg-badge[data-tone="ok"] { color:var(--dsw-alias-state-success-primary); border-color:var(--dsw-alias-state-success-primary); }
      .dshg-badge[data-tone="warn"] { color:var(--dsw-alias-state-warn-primary); border-color:var(--dsw-alias-state-warn-primary); }
      .dshg-badge[data-tone="error"] { color:var(--dsw-alias-state-error-primary); border-color:var(--dsw-alias-state-error-primary); }
      .dshg-badge[data-tone="idle"] { color:var(--dsw-alias-state-idle-primary); border-color:var(--dsw-alias-state-idle-primary); }
      .dshg-error { margin:10px 14px; padding:8px 10px; border:1px solid var(--dsw-alias-state-error-primary); border-radius:6px; color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; }
      .dshg-foot { display:flex; align-items:center; gap:10px; padding:5px 12px; border-top:1px solid var(--dsw-alias-border-l1); color:var(--dsw-alias-label-secondary); font-size:10px; min-height:20px; background:var(--dsw-alias-bg-base); flex-wrap:wrap; }
      .dshg-foot code { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:40vw; }
      .dshg-details { margin-top:8px; }
      .dshg-details summary { cursor:pointer; color:var(--dsw-alias-label-secondary); font-size:11px; }
      .dshg-pre { white-space:pre-wrap; word-break:break-word; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:11px; line-height:1.45; background:var(--dsw-alias-bg-base); border:1px solid var(--dsw-alias-border-l1); border-radius:6px; padding:8px; max-height:260px; overflow:auto; margin:6px 0 0; }
      .dshg-modal { position:absolute; inset:0; background:color-mix(in srgb, var(--dsw-alias-bg-base) 70%, transparent); display:flex; align-items:center; justify-content:center; padding:24px; z-index:5; }
      .dshg-modal-inner { width:min(820px,100%); max-height:100%; display:flex; flex-direction:column; background:var(--dsw-alias-bg-overlay); border:1px solid var(--dsw-alias-border-l2); border-radius:10px; box-shadow:0 18px 40px rgba(0,0,0,.35); overflow:hidden; }
      .dshg-modal-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; border-bottom:1px solid var(--dsw-alias-border-l1); font-weight:600; }
      .dshg-modal-body { padding:12px 14px; overflow:auto; }
      .dshg-settings { padding:18px 22px 28px; overflow:auto; height:100%; box-sizing:border-box; }
      .dshg-settings h2 { font-size:16px; margin:0 0 4px; }
      .dshg-settings .dshg-muted { line-height:1.5; max-width:820px; }
      .dshg-card { border:1px solid var(--dsw-alias-border-l1); border-radius:8px; background:var(--dsw-alias-bg-layer-1); padding:12px 14px; margin-top:14px; }
      .dshg-card h3 { margin:0 0 8px; font-size:13px; font-weight:600; }
      .dshg-kv { display:grid; grid-template-columns:max-content 1fr; gap:4px 14px; font-size:12px; }
      .dshg-kv span:nth-child(odd) { color:var(--dsw-alias-label-secondary); }
      .dshg-table { width:100%; border-collapse:collapse; font-size:12px; }
      .dshg-table th { text-align:left; color:var(--dsw-alias-label-secondary); font-weight:500; font-size:10px; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid var(--dsw-alias-border-l1); padding:5px 6px; }
      .dshg-table td { border-bottom:1px solid var(--dsw-alias-border-l1); padding:6px; vertical-align:top; }
      .dshg-table tr:hover td { background:var(--dsw-alias-bg-layer-2); }
      .dshg-tablerow-actions { display:flex; gap:4px; flex-wrap:wrap; }
      .dshg-smallbtn { border:1px solid var(--dsw-alias-border-l1); background:transparent; color:var(--dsw-alias-label-secondary); border-radius:4px; padding:2px 6px; font-size:10px; cursor:pointer; }
      .dshg-smallbtn:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2); }
      .dshg-formrow { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:8px; }
      .dshg-notice { margin-top:8px; color:var(--dsw-alias-state-success-primary); }
      .dshg-formerror { margin-top:8px; color:var(--dsw-alias-state-error-primary); }
      .dshg-legend { display:flex; gap:8px; flex-wrap:wrap; align-items:center; color:var(--dsw-alias-label-secondary); font-size:10px; }
      .dshg-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:3px; }
      .dshg-pill { display:inline-flex; align-items:center; gap:4px; border:1px solid var(--dsw-alias-border-l1); border-radius:999px; padding:1px 7px; font-size:10px; color:var(--dsw-alias-label-secondary); }
      .dshg-impact { margin-top:6px; border:1px solid var(--dsw-alias-border-l1); border-radius:6px; padding:6px; }
      .dshg-pathstep { display:flex; align-items:center; gap:6px; padding:3px 0; border-bottom:1px dashed var(--dsw-alias-border-l1); }
      .dshg-pathstep:last-child { border-bottom:0; }
      @media (max-width: 900px) { .dshg-side { width:280px; flex-basis:280px; } }
    `

    function installStyles() {
      if (typeof document === 'undefined') return () => {}
      for (const stale of document.querySelectorAll(`style[data-plugin-css="${STYLE_KEY}"]`)) stale.remove()
      const tag = document.createElement('style')
      tag.dataset.plugin = '@local/dsh-graphify'
      tag.dataset.pluginCss = STYLE_KEY
      tag.textContent = css
      document.head.appendChild(tag)
      return () => tag.remove()
    }

    function bindT(props) {
      return props && typeof props.t === 'function' ? props.t : translate
    }

    function fill(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (match, key) => (values && key in values ? String(values[key]) : match))
    }

    async function api(path, params, signal) {
      const url = new URL(path, window.location.origin)
      for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined || value === null || value === '') continue
        url.searchParams.set(key, String(value))
      }
      const response = await fetch(url.toString(), { signal, headers: { accept: 'application/json' } })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`)
      return data
    }

    async function postApi(path, body) {
      const response = await fetch(new URL(path, window.location.origin).toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body || {}),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`)
      return data
    }

    function readRoot(sessionId) {
      try {
        return window.localStorage.getItem(ROOT_KEY + sessionId) || ''
      } catch {
        return ''
      }
    }

    function writeRoot(sessionId, root) {
      try {
        if (root) window.localStorage.setItem(ROOT_KEY + sessionId, root)
        else window.localStorage.removeItem(ROOT_KEY + sessionId)
      } catch {}
    }

    function formatBytes(bytes) {
      if (!bytes) return '0 B'
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    function formatTime(value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleString()
    }

    function shortPath(value) {
      const text = String(value || '')
      return text.length > 58 ? `…${text.slice(-57)}` : text
    }

    function communityColor(id) {
      const number = Number(id)
      return COLORS[Number.isFinite(number) ? Math.abs(number) % COLORS.length : 0]
    }

    function statusTone(status) {
      if (status === 'verified' || status === 'installed') return 'ok'
      if (status === 'ignored') return 'idle'
      if (status === 'missing') return 'error'
      if (status === 'unresolved') return 'warn'
      return 'idle'
    }

    /* ------------------------------------------------------------- layout */

    function forcePositions(nodes, edges) {
      const positions = new Map()
      const count = nodes.length
      if (count === 0) return positions
      const index = new Map(nodes.map((node, position) => [node.id, position]))
      const points = nodes.map((node, position) => {
        const angle = (position / Math.max(1, count)) * Math.PI * 2
        const radius = Math.max(45, Math.sqrt(count) * 46)
        return {
          id: node.id,
          x: Math.cos(angle) * radius + (position % 5) * 2.4,
          y: Math.sin(angle) * radius + (position % 7) * 2.1,
          vx: 0,
          vy: 0,
        }
      })
      const springs = []
      for (const edge of edges) {
        const source = index.get(edge.source)
        const target = index.get(edge.target)
        if (source === undefined || target === undefined) continue
        springs.push([source, target])
        if (springs.length >= 3000) break
      }
      const iterations = count > 350 ? 70 : 120
      for (let tick = 0; tick < iterations; tick += 1) {
        const alpha = 1 - tick / iterations
        for (let i = 0; i < points.length; i += 1) {
          const a = points[i]
          for (let j = i + 1; j < points.length; j += 1) {
            const b = points[j]
            let dx = a.x - b.x
            let dy = a.y - b.y
            let distanceSquared = dx * dx + dy * dy
            if (distanceSquared < 1) {
              distanceSquared = 1
              dx += 0.5
            }
            const force = (620 * alpha) / distanceSquared
            a.vx += dx * force
            a.vy += dy * force
            b.vx -= dx * force
            b.vy -= dy * force
          }
        }
        for (const [source, target] of springs) {
          const a = points[source]
          const b = points[target]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.001
          const force = ((distance - 84) / distance) * 0.012 * alpha
          a.vx += dx * force
          a.vy += dy * force
          b.vx -= dx * force
          b.vy -= dy * force
        }
        for (const point of points) {
          point.vx -= point.x * 0.0016 * alpha
          point.vy -= point.y * 0.0016 * alpha
          point.x += point.vx * 0.72
          point.y += point.vy * 0.72
          point.vx *= 0.62
          point.vy *= 0.62
        }
      }
      for (const point of points) positions.set(point.id, { x: point.x, y: point.y })
      return positions
    }

    function layeredPositions(nodes, edges) {
      const positions = new Map()
      if (nodes.length === 0) return positions
      const ids = new Set(nodes.map((node) => node.id))
      const indegree = new Map(nodes.map((node) => [node.id, 0]))
      const outgoing = new Map()
      for (const edge of edges) {
        if (!ids.has(edge.source) || !ids.has(edge.target)) continue
        indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1)
        if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
        outgoing.get(edge.source).push(edge.target)
      }
      let roots = nodes.filter((node) => (indegree.get(node.id) || 0) === 0).map((node) => node.id)
      if (roots.length === 0) {
        const ranked = nodes.slice().sort((a, b) => (b.degree || 0) - (a.degree || 0))
        roots = [ranked[0].id]
      }
      const level = new Map()
      const queue = []
      for (const root of roots) {
        level.set(root, 0)
        queue.push(root)
      }
      while (queue.length > 0) {
        const current = queue.shift()
        const nextLevel = (level.get(current) || 0) + 1
        for (const target of outgoing.get(current) || []) {
          if (level.has(target)) continue
          level.set(target, nextLevel)
          queue.push(target)
        }
      }
      let maximum = 0
      for (const value of level.values()) maximum = Math.max(maximum, value)
      for (const node of nodes) if (!level.has(node.id)) level.set(node.id, maximum + 1)
      const groups = new Map()
      for (const node of nodes) {
        const value = level.get(node.id)
        if (!groups.has(value)) groups.set(value, [])
        groups.get(value).push(node)
      }
      for (const [value, group] of groups) {
        group.sort((a, b) => (b.fanIn || b.degree || 0) - (a.fanIn || a.degree || 0) || String(a.label).localeCompare(String(b.label)))
        const width = (group.length - 1) * 150
        group.forEach((node, position) => {
          positions.set(node.id, { x: position * 150 - width / 2, y: value * 120 })
        })
      }
      return positions
    }

    /* ------------------------------------------------------------- canvas */

    function GraphCanvas(props) {
      const { nodes, edges, layout, selectedId, onSelect, arrows, colorBy, resetToken } = props
      const wrapRef = useRef(null)
      const canvasRef = useRef(null)
      const viewRef = useRef({ scale: 1, ox: 0, oy: 0, positions: new Map() })
      const dragRef = useRef(null)
      const [size, setSize] = useState({ width: 0, height: 0 })
      const [transform, setTransform] = useState({ zoom: 1, x: 0, y: 0 })
      const [hover, setHover] = useState('')
      const nodeKey = useMemo(() => nodes.map((node) => node.id).join('|'), [nodes])
      const edgeKey = useMemo(() => `${edges.length}:${edges.length > 0 ? edges[0].source : ''}`, [edges])

      const positions = useMemo(() => {
        return layout === 'layered' ? layeredPositions(nodes, edges) : forcePositions(nodes, edges)
      }, [nodeKey, edgeKey, layout])

      useEffect(() => {
        setTransform({ zoom: 1, x: 0, y: 0 })
      }, [layout, nodeKey, resetToken])

      useEffect(() => {
        if (!wrapRef.current) return undefined
        const observer = new ResizeObserver((entries) => {
          const rect = entries[0]?.contentRect
          if (!rect) return
          const width = Math.max(40, Math.round(rect.width))
          const height = Math.max(40, Math.round(rect.height))
          setSize((current) => {
            if (Math.abs(current.width - width) < 2 && Math.abs(current.height - height) < 2) return current
            return { width, height }
          })
        })
        observer.observe(wrapRef.current)
        return () => observer.disconnect()
      }, [])

      // React attaches its synthetic wheel listener passively, so
      // preventDefault() there does not stop the surrounding page from
      // scrolling. A native non-passive listener owns zoom and consumes the
      // gesture entirely while the pointer is over the canvas.
      useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return undefined
        const handleWheel = (event) => {
          event.preventDefault()
          event.stopPropagation()
          const rect = canvas.getBoundingClientRect()
          // The draw transform is `screen = (world - centre) * fit * zoom +
          // canvasCentre + pan`, so the zoom anchor must be measured from the
          // canvas centre, not from its top-left corner.
          const anchorX = event.clientX - rect.left - rect.width / 2
          const anchorY = event.clientY - rect.top - rect.height / 2
          setTransform((current) => {
            const nextZoom = Math.min(4, Math.max(0.25, current.zoom * Math.exp(-event.deltaY * 0.0012)))
            const factor = nextZoom / current.zoom
            return {
              zoom: nextZoom,
              x: anchorX - (anchorX - current.x) * factor,
              y: anchorY - (anchorY - current.y) * factor,
            }
          })
        }
        canvas.addEventListener('wheel', handleWheel, { passive: false })
        return () => canvas.removeEventListener('wheel', handleWheel)
      }, [])

      const neighbors = useMemo(() => {
        const focus = hover || selectedId
        const set = new Set()
        if (!focus) return set
        for (const edge of edges) {
          if (edge.source === focus) set.add(edge.target)
          if (edge.target === focus) set.add(edge.source)
        }
        return set
      }, [hover, selectedId, edges])

      useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || size.width === 0) return
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.round(size.width * dpr)
        canvas.height = Math.round(size.height * dpr)
        const context = canvas.getContext('2d')
        if (!context) return
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
        context.clearRect(0, 0, size.width, size.height)
        if (positions.size === 0) return

        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        for (const point of positions.values()) {
          minX = Math.min(minX, point.x)
          maxX = Math.max(maxX, point.x)
          minY = Math.min(minY, point.y)
          maxY = Math.max(maxY, point.y)
        }
        if (!Number.isFinite(minX)) return
        const padding = 46
        const fit = Math.min(
          (size.width - padding * 2) / Math.max(40, maxX - minX),
          (size.height - padding * 2) / Math.max(40, maxY - minY),
          2.2,
        )
        const scale = fit * transform.zoom
        const ox = size.width / 2 - ((minX + maxX) / 2) * scale + transform.x
        const oy = size.height / 2 - ((minY + maxY) / 2) * scale + transform.y
        viewRef.current = { scale, ox, oy, positions }
        const pointOf = (id) => {
          const point = positions.get(id)
          return point ? { x: point.x * scale + ox, y: point.y * scale + oy } : null
        }
        const styles = getComputedStyle(wrapRef.current)
        const secondary = styles.getPropertyValue('--dsw-alias-label-secondary') || 'rgba(128,128,128,.9)'
        const primary = styles.getPropertyValue('--dsw-alias-label-primary') || 'rgba(40,40,40,.95)'
        const brand = styles.getPropertyValue('--dsw-alias-brand-primary') || '#4E79A7'
        const focus = hover || selectedId
        const active = new Set(neighbors)
        if (focus) active.add(focus)

        context.lineWidth = 1
        for (const edge of edges) {
          const a = pointOf(edge.source)
          const b = pointOf(edge.target)
          if (!a || !b) continue
          const involved = !focus || active.has(edge.source) || active.has(edge.target)
          const inferred = String(edge.confidence).toUpperCase() === 'INFERRED'
          context.globalAlpha = involved ? 0.55 : 0.1
          context.strokeStyle = secondary
          context.setLineDash(inferred ? [4, 3] : [])
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.stroke()
          if (arrows) {
            const angle = Math.atan2(b.y - a.y, b.x - a.x)
            const length = 7
            const target = 13
            context.setLineDash([])
            context.beginPath()
            context.moveTo(b.x - Math.cos(angle) * target, b.y - Math.sin(angle) * target)
            context.lineTo(b.x - Math.cos(angle - 0.42) * (target + length), b.y - Math.sin(angle - 0.42) * (target + length))
            context.lineTo(b.x - Math.cos(angle + 0.42) * (target + length), b.y - Math.sin(angle + 0.42) * (target + length))
            context.closePath()
            context.fillStyle = secondary
            context.fill()
          }
        }
        context.setLineDash([])

        const sorted = nodes.slice().sort((a, b) => (a.degree || a.fanIn + a.fanOut || 0) - (b.degree || b.fanIn + b.fanOut || 0))
        const labelBudget = new Set(
          [...sorted]
            .sort((a, b) => (b.degree || b.fanIn + b.fanOut || 0) - (a.degree || a.fanIn + a.fanOut || 0))
            .slice(0, 14)
            .map((node) => node.id),
        )
        for (const node of nodes) {
          const point = pointOf(node.id)
          if (!point) continue
          const degree = node.degree || (node.fanIn || 0) + (node.fanOut || 0)
          const radius = 3 + Math.min(10, Math.sqrt(degree || 1) * 2.1)
          const highlighted = !focus || active.has(node.id)
          const isSelected = node.id === selectedId
          context.globalAlpha = highlighted ? 1 : 0.22
          let color
          if (node.type === 'external') color = '#8b949e'
          else if (colorBy === 'cycle') color = node.cycle !== null && node.cycle !== undefined ? '#E15759' : communityColor(node.community)
          else color = communityColor(node.community)
          context.beginPath()
          context.arc(point.x, point.y, radius, 0, Math.PI * 2)
          context.fillStyle = color
          context.fill()
          context.lineWidth = isSelected ? 2.4 : 1
          context.strokeStyle = isSelected ? brand : 'rgba(0,0,0,.22)'
          context.stroke()
          if (isSelected) {
            context.beginPath()
            context.arc(point.x, point.y, radius + 4, 0, Math.PI * 2)
            context.strokeStyle = brand
            context.lineWidth = 1.2
            context.stroke()
          }
          const showLabel = isSelected || node.id === hover || labelBudget.has(node.id) || transform.zoom > 1.55
          if (showLabel) {
            context.globalAlpha = highlighted ? 0.95 : 0.3
            context.fillStyle = isSelected ? primary : secondary
            context.font = '10px ui-sans-serif, system-ui, sans-serif'
            context.textAlign = 'center'
            context.textBaseline = 'top'
            const label = String(node.label || node.id)
            context.fillText(label.length > 26 ? `${label.slice(0, 25)}…` : label, point.x, point.y + radius + 3)
          }
        }
        context.globalAlpha = 1
      }, [positions, size, transform, selectedId, hover, neighbors, arrows, colorBy, nodes, edges])

      const hitTest = (clientX, clientY) => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        const x = clientX - rect.left
        const y = clientY - rect.top
        const view = viewRef.current
        let best = null
        let bestDistance = 14
        for (const node of nodes) {
          const point = view.positions.get(node.id)
          if (!point) continue
          const px = point.x * view.scale + view.ox
          const py = point.y * view.scale + view.oy
          const distance = Math.hypot(px - x, py - y)
          if (distance < bestDistance) {
            bestDistance = distance
            best = node
          }
        }
        return best
      }

      return h(
        'div',
        { className: 'dshg-canvaswrap', ref: wrapRef },
        h('canvas', {
          ref: canvasRef,
          onPointerDown: (event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture?.(event.pointerId)
            const node = hitTest(event.clientX, event.clientY)
            if (node) {
              onSelect?.(node)
              return
            }
            dragRef.current = { x: transform.x, y: transform.y, startX: event.clientX, startY: event.clientY }
          },
          onPointerMove: (event) => {
            if (dragRef.current) {
              setTransform((current) => ({
                ...current,
                x: dragRef.current.x + (event.clientX - dragRef.current.startX),
                y: dragRef.current.y + (event.clientY - dragRef.current.startY),
              }))
              return
            }
            const node = hitTest(event.clientX, event.clientY)
            setHover(node ? node.id : '')
          },
          onPointerUp: () => {
            dragRef.current = null
          },
          onPointerLeave: () => {
            dragRef.current = null
            setHover('')
          },
        }),
      )
    }

    /* ---------------------------------------------------------------- tree */

    function treeKey(node) {
      return `${node.type}:${node.path || ''}:${node.id || ''}:${node.name}`
    }

    function collectVisible(node, needle, visible, expanded) {
      let self = false
      if (needle) {
        const haystack = `${node.name || ''} ${node.path || ''}`.toLowerCase()
        self = haystack.includes(needle)
      }
      let childMatch = false
      for (const child of node.children || []) {
        const match = collectVisible(child, needle, visible, expanded)
        childMatch = childMatch || match
      }
      if (!needle || self || childMatch) {
        visible.add(node)
        if (needle && childMatch) expanded.add(treeKey(node))
        return true
      }
      return false
    }

    function TreeNodeRow(props) {
      const { node, depth, expanded, toggle, onSelect, selected, t } = props
      const key = treeKey(node)
      const isDir = node.type === 'dir'
      const isOpen = expanded.has(key)
      const isSelected = Boolean(
        selected &&
          ((node.type === 'file' && selected.kind === 'file' && selected.path === node.path) ||
            (node.type === 'symbol' && selected.kind === 'node' && selected.id === node.id)),
      )
      const count = isDir ? node.count : node.type === 'file' ? (node.count || 1) - 1 : node.children?.length || 0
      return h(
        'div',
        null,
        h(
          'div',
          {
            className: 'dshg-tnode',
            style: { paddingLeft: `${6 + depth * 14}px` },
            'data-active': isSelected ? 'true' : 'false',
            onClick: () => {
              if (isDir) toggle(key)
              else if (node.type === 'file') onSelect({ kind: 'file', path: node.path })
              else if (node.id) onSelect({ kind: 'node', id: node.id })
            },
          },
          h('span', { className: 'dshg-caret' }, isDir ? (isOpen ? '▾' : '▸') : ''),
          h('span', { className: 'dshg-ticon', 'data-kind': node.type }, isDir ? '▣' : node.type === 'file' ? (node.manifest ? '⚙' : '▤') : 'ƒ'),
          h('span', { className: 'dshg-row-name' }, node.name),
          count !== null && count !== undefined && count > 0
            ? h('span', { className: 'dshg-tsize' }, isDir ? `${count}` : node.type === 'file' ? `${count}` : '')
            : null,
        ),
        isDir && isOpen
          ? (node.children || []).map((child) => h(TreeNodeRow, { key: treeKey(child), node: child, depth: depth + 1, expanded, toggle, onSelect, selected, t }))
          : null,
      )
    }

    function TreeView(props) {
      const { tree, t, onSelect, selected } = props
      const [filter, setFilter] = useState('')
      const [expanded, setExpanded] = useState(() => new Set())
      const needle = filter.trim().toLowerCase()
      useEffect(() => {
        if (!tree) return
        const key = treeKey(tree)
        setExpanded((current) => (current.size > 0 ? current : new Set([key])))
      }, [tree])
      const visible = useMemo(() => {
        const set = new Set()
        const open = new Set(expanded)
        if (tree) collectVisible(tree, needle, set, open)
        return { set, open }
      }, [tree, needle, expanded])
      const toggle = useCallback((key) => {
        setExpanded((current) => {
          const next = new Set(current)
          if (next.has(key)) next.delete(key)
          else next.add(key)
          return next
        })
      }, [])
      if (!tree) return null
      const root = tree
      const rootKey = treeKey(root)
      const isRootOpen = expanded.has(rootKey) || Boolean(needle)
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } },
        h(
          'div',
          { className: 'dshg-treebar' },
          h('input', {
            className: 'dshg-input',
            placeholder: t('treeFilter'),
            value: filter,
            onChange: (event) => setFilter(event.target.value),
          }),
          h('span', { className: 'dshg-muted' }, filter ? fill(t('searchResults'), { n: visible.set.size }) : ''),
        ),
        h(
          'div',
          { className: 'dshg-tree' },
          h(
            'div',
            {
              className: 'dshg-tnode',
              style: { paddingLeft: '6px' },
              onClick: () => toggle(rootKey),
            },
            h('span', { className: 'dshg-caret' }, isRootOpen ? '▾' : '▸'),
            h('span', { className: 'dshg-ticon', 'data-kind': 'dir' }, '▣'),
            h('span', { className: 'dshg-row-name' }, root.name),
            h('span', { className: 'dshg-tsize' }, `${root.count}`),
          ),
          isRootOpen
            ? (root.children || [])
                .filter((child) => !needle || visible.set.has(child))
                .map((child) =>
                  h(TreeNodeRow, {
                    key: treeKey(child),
                    node: child,
                    depth: 1,
                    expanded: needle ? visible.open : expanded,
                    toggle,
                    onSelect,
                    selected,
                    t,
                  }),
                )
            : null,
        ),
      )
    }

    /* ----------------------------------------------------------------- main */

    function GraphTab(props) {
      const t = bindT(props)
      const sessionId = props.sessionId
      const [root, setRoot] = useState(() => readRoot(sessionId))
      const [draftRoot, setDraftRoot] = useState(root)
      const [editingRoot, setEditingRoot] = useState(false)
      const [status, setStatus] = useState(null)
      const [error, setError] = useState('')
      const [loading, setLoading] = useState(false)
      const [view, setView] = useState('explore')
      const [graph, setGraph] = useState(null)
      const [tree, setTree] = useState(null)
      const [deps, setDeps] = useState(null)
      const [depsLevel, setDepsLevel] = useState('file')
      const [depsRelations, setDepsRelations] = useState({ imports: true, calls: true, inherits: true, other: true })
      const [selected, setSelected] = useState(null)
      const [detail, setDetail] = useState(null)
      const [detailLoading, setDetailLoading] = useState(false)
      const [search, setSearch] = useState('')
      const [searchResults, setSearchResults] = useState([])
      const [searchLoading, setSearchLoading] = useState(false)
      const [pathFrom, setPathFrom] = useState(null)
      const [pathResult, setPathResult] = useState(null)
      const [pathError, setPathError] = useState('')
      const [impact, setImpact] = useState(null)
      const [impactLoading, setImpactLoading] = useState(false)
      const [report, setReport] = useState(null)
      const [reportOpen, setReportOpen] = useState(false)
      const [notice, setNotice] = useState('')
      const [resetToken, setResetToken] = useState(0)

      const rootRef = useRef(root)
      rootRef.current = root

      const graphExists = Boolean(status?.graph?.exists)
      const buildState = status?.build?.state || 'idle'
      const building = buildState === 'running'

      const loadStatus = useCallback(
        async (silent = false) => {
          if (!silent) setLoading(true)
          try {
            const data = await api('/api/graphify.status', { session: sessionId, root: rootRef.current })
            setStatus(data)
            if (data.root && data.root !== rootRef.current) {
              setRoot(data.root)
              setDraftRoot(data.root)
            }
            setError('')
            return data
          } catch (failure) {
            setError(failure.message || String(failure))
            return null
          } finally {
            if (!silent) setLoading(false)
          }
        },
        [sessionId],
      )

      useEffect(() => {
        void loadStatus()
      }, [loadStatus])

      useEffect(() => {
        if (!building) return undefined
        const timer = setInterval(() => {
          void loadStatus(true)
        }, 1200)
        return () => clearInterval(timer)
      }, [building, loadStatus])

      useEffect(() => {
        const previous = status?.build
        if (previous?.state === 'ok' && graphExists) {
          setGraph(null)
          setTree(null)
          setDeps(null)
        }
      }, [status?.build?.finishedAt])

      const loadGraph = useCallback(
        async (kind, level) => {
          try {
            if (kind === 'explore') {
              const data = await api('/api/graphify.graph', { session: sessionId, root: rootRef.current })
              setGraph(data)
            } else if (kind === 'tree') {
              const data = await api('/api/graphify.tree', { session: sessionId, root: rootRef.current })
              setTree(data.tree)
            } else if (kind === 'deps') {
              const data = await api('/api/graphify.deps', { session: sessionId, root: rootRef.current, level })
              setDeps(data)
            }
            setError('')
          } catch (failure) {
            setError(failure.message || String(failure))
          }
        },
        [sessionId],
      )

      useEffect(() => {
        if (!graphExists || building) return
        if (view === 'explore' && !graph) void loadGraph('explore')
        if (view === 'tree' && !tree) void loadGraph('tree')
        if (view === 'deps' && !deps) void loadGraph('deps', depsLevel)
      }, [graphExists, building, view, graph, tree, deps, depsLevel, loadGraph])

      useEffect(() => {
        setDeps(null)
      }, [depsLevel])

      const openItem = useCallback(
        async (item) => {
          if (!item) return
          if (item.kind === 'dep' || item.kind === 'external') {
            setSelected(item)
            setDetail(null)
            return
          }
          setSelected(item)
          setPathResult(null)
          setImpact(null)
          setDetail(null)
          setDetailLoading(true)
          try {
            const data =
              item.kind === 'file'
                ? await api('/api/graphify.file', { session: sessionId, root: rootRef.current, path: item.path })
                : await api('/api/graphify.node', { session: sessionId, root: rootRef.current, id: item.id })
            setDetail(data)
            setError('')
            if (pathFrom) {
              const fromId = pathFrom.kind === 'node' ? pathFrom.id : pathFrom.nodeId
              const toId = item.kind === 'node' ? item.id : data.nodeId
              if (fromId && toId) {
                try {
                  const result = await api('/api/graphify.path', {
                    session: sessionId,
                    root: rootRef.current,
                    from: fromId,
                    to: toId,
                  })
                  setPathResult(result)
                  setPathFrom(null)
                  setPathError('')
                } catch (failure) {
                  setPathError(failure.message || String(failure))
                }
              } else {
                setPathError(t('pathNone'))
              }
            }
          } catch (failure) {
            setError(failure.message || String(failure))
          } finally {
            setDetailLoading(false)
          }
        },
        [pathFrom, sessionId, t],
      )

      useEffect(() => {
        const needle = search.trim()
        if (!needle || !graphExists) {
          setSearchResults([])
          return undefined
        }
        const timer = setTimeout(async () => {
          setSearchLoading(true)
          try {
            const data = await api('/api/graphify.search', { session: sessionId, root: rootRef.current, q: needle, limit: 40 })
            setSearchResults(data.results || [])
          } catch {
            setSearchResults([])
          } finally {
            setSearchLoading(false)
          }
        }, 240)
        return () => clearTimeout(timer)
      }, [search, graphExists, sessionId])

      const startBuild = async () => {
        setNotice('')
        try {
          const data = await postApi('/api/graphify.build', {
            session: sessionId,
            root: rootRef.current,
            mode: graphExists ? 'update' : 'build',
          })
          if (data.status) setStatus(data.status)
          else setStatus((current) => (current ? { ...current, build: data.build } : current))
          setNotice(t('buildStarted'))
        } catch (failure) {
          setError(failure.message || String(failure))
        }
      }

      const cancelBuild = async () => {
        try {
          const data = await postApi('/api/graphify.cancel', { session: sessionId, root: rootRef.current })
          setStatus((current) => (current ? { ...current, build: data.build } : current))
        } catch (failure) {
          setError(failure.message || String(failure))
        }
      }

      const applyRoot = () => {
        const next = draftRoot.trim()
        setRoot(next)
        rootRef.current = next
        writeRoot(sessionId, next)
        setEditingRoot(false)
        setGraph(null)
        setTree(null)
        setDeps(null)
        setSelected(null)
        setDetail(null)
        setStatus(null)
        void loadStatus()
      }

      const resetRoot = () => {
        setDraftRoot('')
        setRoot('')
        rootRef.current = ''
        writeRoot(sessionId, '')
        setEditingRoot(false)
        setGraph(null)
        setTree(null)
        setDeps(null)
        setSelected(null)
        setDetail(null)
        setStatus(null)
        void loadStatus()
      }

      const openReport = async () => {
        setReportOpen(true)
        setReport(null)
        try {
          const data = await api('/api/graphify.report', { session: sessionId, root: rootRef.current })
          setReport(data)
        } catch (failure) {
          setReport({ exists: false, text: failure.message || String(failure) })
        }
      }

      const runImpact = async (item) => {
        const file = item?.kind === 'file' ? item.path : detail?.kind === 'file' ? detail.path : ''
        if (!file) return
        setImpactLoading(true)
        try {
          const data = await api('/api/graphify.impact', { session: sessionId, root: rootRef.current, file, depth: 3 })
          setImpact(data)
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setImpactLoading(false)
        }
      }

      const beginPath = (item) => {
        setPathFrom(item)
        setPathResult(null)
        setPathError('')
      }

      const selectFromCanvas = (node) => {
        void openItem({ kind: 'node', id: node.id, nodeId: node.id })
      }

      const selectedCanvasId = selected?.kind === 'node' ? selected.id : selected?.kind === 'file' ? detail?.nodeId || '' : ''

      const stats = status?.graph?.stats

      const chips = stats
        ? [
            [t('statsNodes'), stats.nodes],
            [t('statsEdges'), stats.edges],
            [t('statsFiles'), stats.files],
            [t('statsCommunities'), stats.communities],
          ]
        : []

      return h(
        'div',
        { className: 'dshg-root' },
        h(
          'div',
          { className: 'dshg-head' },
          h(
            'div',
            { className: 'dshg-head-main' },
            h(
              'div',
              { className: 'dshg-title' },
              h('strong', null, t('title')),
              h(
                'div',
                { className: 'dshg-rootline' },
                h('code', { className: 'dshg-mono' }, shortPath(status?.root || root || rootHintText())),
                h(
                  'button',
                  { className: 'dshg-iconbtn', type: 'button', onClick: () => setEditingRoot((value) => !value) },
                  editingRoot ? t('hide') : '✎',
                ),
              ),
              editingRoot
                ? h(
                    'div',
                    { className: 'dshg-rootform' },
                    h('input', {
                      className: 'dshg-input',
                      value: draftRoot,
                      placeholder: status?.sessionRoot || rootHintText(),
                      onChange: (event) => setDraftRoot(event.target.value),
                    }),
                    h('button', { className: 'dshg-btn', type: 'button', onClick: applyRoot }, t('applyRoot')),
                    h('button', { className: 'dshg-btn', type: 'button', onClick: resetRoot }, t('resetRoot')),
                  )
                : null,
            ),
            h(
              'div',
              { className: 'dshg-tabs' },
              ['explore', 'tree', 'deps'].map((mode) =>
                h(
                  'button',
                  {
                    key: mode,
                    type: 'button',
                    className: 'dshg-tab',
                    'data-active': view === mode ? 'true' : 'false',
                    onClick: () => {
                      setView(mode)
                      setSelected(null)
                      setDetail(null)
                    },
                  },
                  t(mode),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dshg-actions' },
            graphExists
              ? h('button', { type: 'button', className: 'dshg-btn', disabled: building, onClick: () => void startBuild() }, building ? t('building') : t('update'))
              : h('button', { type: 'button', className: 'dshg-btn', 'data-primary': 'true', disabled: building, onClick: () => void startBuild() }, t('build')),
            building ? h('button', { type: 'button', className: 'dshg-btn', 'data-danger': 'true', onClick: () => void cancelBuild() }, t('cancel')) : null,
            h(
              'button',
              {
                type: 'button',
                className: 'dshg-btn',
                disabled: loading || building,
                onClick: () => {
                  setGraph(null)
                  setTree(null)
                  setDeps(null)
                  void loadStatus()
                },
              },
              t('refresh'),
            ),
            graphExists ? h('button', { type: 'button', className: 'dshg-btn', onClick: () => setResetToken((value) => value + 1) }, t('resetView')) : null,
            graphExists ? h('button', { type: 'button', className: 'dshg-btn', onClick: () => void openReport() }, t('report')) : null,
          ),
        ),
        graphExists
          ? h(
              'div',
              { className: 'dshg-stats' },
              chips.map(([label, value]) => h('span', { className: 'dshg-chip', key: label }, `${value} `, h('span', { className: 'dshg-muted' }, label))),
              h('span', { className: 'dshg-spacer' }),
              status?.graph?.builtAt ? h('span', { className: 'dshg-chip' }, fill(t('builtAt'), { time: formatTime(status.graph.builtAt) })) : null,
              status?.graph?.graphifyVersion ? h('span', { className: 'dshg-chip' }, `graphify ${status.graph.graphifyVersion}`) : null,
            )
          : null,
        error ? h('div', { className: 'dshg-error' }, error) : null,
        notice ? h('div', { className: 'dshg-stats dshg-notice' }, notice) : null,
        !graphExists
          ? h(
              'div',
              { className: 'dshg-main' },
              h(
                'div',
                { className: 'dshg-empty' },
                h('h2', null, status?.binary?.available === false ? t('installTitle') : t('noGraphTitle')),
                h('p', null, status?.binary?.available === false ? t('installBody') : t('noGraphBody')),
                status?.binary?.available === false
                  ? h('p', null, h('code', null, t('installHint')))
                  : h(
                      'div',
                      { className: 'dshg-emptyactions' },
                      h('button', { type: 'button', className: 'dshg-btn', 'data-primary': 'true', disabled: building, onClick: () => void startBuild() }, building ? t('building') : t('build')),
                      building ? h('button', { type: 'button', className: 'dshg-btn', onClick: () => void cancelBuild() }, t('cancel')) : null,
                    ),
                building
                  ? h(
                      'div',
                      { style: { width: '100%', textAlign: 'left' } },
                      h('div', { className: 'dshg-muted' }, `${t('building')} ${status?.build?.step || ''}`),
                      h('pre', { className: 'dshg-pre' }, (status?.build?.lines || []).slice(-10).join('\n')),
                    )
                  : null,
                status?.build?.state === 'error'
                  ? h('pre', { className: 'dshg-pre', style: { borderColor: 'var(--dsw-alias-state-error-primary)' } }, status.build.error || '')
                  : null,
              ),
            )
          : h(
              'div',
              { className: 'dshg-body' },
              h(
                'div',
                { className: 'dshg-main' },
                view === 'explore'
                  ? graph
                    ? h(GraphCanvas, {
                        nodes: graph.nodes,
                        edges: graph.edges,
                        layout: 'force',
                        selectedId: selectedCanvasId,
                        onSelect: selectFromCanvas,
                        resetToken,
                      })
                    : h('div', { className: 'dshg-empty' }, h('p', { className: 'dshg-muted' }, t('loading')))
                  : null,
                view === 'tree'
                  ? tree
                    ? h(TreeView, { tree, t, onSelect: openItem, selected })
                    : h('div', { className: 'dshg-empty' }, h('p', { className: 'dshg-muted' }, t('loading')))
                  : null,
                view === 'deps' ? h(DepsView, {
                  deps,
                  level: depsLevel,
                  setLevel: setDepsLevel,
                  relations: depsRelations,
                  setRelations: setDepsRelations,
                  t,
                  selected,
                  onSelect: openItem,
                  onImpact: runImpact,
                  building,
                  resetToken,
                }) : null,
              ),
              h(SidePanel, {
                t,
                view,
                status,
                graph,
                deps,
                detail,
                detailLoading,
                selected,
                search,
                setSearch,
                searchResults,
                searchLoading,
                openItem,
                pathFrom,
                pathHint: pathFrom ? t('pathHint') : '',
                pathResult,
                pathError,
                clearPath: () => {
                  setPathFrom(null)
                  setPathResult(null)
                  setPathError('')
                },
                beginPath,
                impact,
                impactLoading,
                runImpact,
                setView,
                depsLevel,
              }),
            ),
        h(
          'div',
          { className: 'dshg-foot' },
          h('span', { className: 'dshg-pill' }, status?.binary?.available ? `${t('runtimeOk')} ${status.binary.version || ''}` : t('runtimeMissing')),
          status?.graph?.path ? h('code', { className: 'dshg-mono' }, shortPath(status.graph.path)) : null,
          status?.graph?.bytes ? h('span', null, formatBytes(status.graph.bytes)) : null,
          status?.build?.state && status.build.state !== 'idle' ? h('span', null, `${status.build.state}${status.build.step ? ` · ${status.build.step}` : ''}`) : null,
          buildState === 'error' && status?.build?.error
            ? h('details', { className: 'dshg-details', style: { width: '100%' } }, h('summary', null, t('buildOutput')), h('pre', { className: 'dshg-pre' }, status.build.error))
            : null,
        ),
        reportOpen
          ? h(
              'div',
              { className: 'dshg-modal', onClick: (event) => { if (event.target === event.currentTarget) setReportOpen(false) } },
              h(
                'div',
                { className: 'dshg-modal-inner' },
                h(
                  'div',
                  { className: 'dshg-modal-head' },
                  h('span', null, t('reportTitle')),
                  h('button', { type: 'button', className: 'dshg-btn', onClick: () => setReportOpen(false) }, t('close')),
                ),
                h('div', { className: 'dshg-modal-body' }, h('pre', { className: 'dshg-pre' }, report ? report.text || t('noReport') : t('loading'))),
              ),
            )
          : null,
      )
    }

    function rootHintText() {
      return '.'
    }

    /* ----------------------------------------------------------- dependencies */

    function DepsView(props) {
      const { deps, level, setLevel, relations, setRelations, t, selected, onSelect, onImpact, building, resetToken } = props
      if (!deps) return h('div', { className: 'dshg-empty' }, h('p', { className: 'dshg-muted' }, t('loading')))
      const relationNames = Object.keys(deps.relationCounts || {})
      const filterEdges = (edge) => {
        const keys = Object.keys(edge.relations || {})
        return keys.some((key) => {
          if (key === 'imports' || key === 'imports_from' || key === 'requires') return relations.imports
          if (key === 'calls' || key === 'indirect_call') return relations.calls
          if (key === 'inherits' || key === 'extends' || key === 'implements' || key === 'mixes_in') return relations.inherits
          return relations.other
        })
      }
      const edges = deps.edges.filter(filterEdges)
      const selectedId =
        selected?.kind === 'file' && level === 'file'
          ? selected.path
          : selected?.kind === 'dep' || selected?.kind === 'external'
            ? selected.id
            : ''
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } },
        h(
          'div',
          { className: 'dshg-depsbar' },
          h('span', { className: 'dshg-muted' }, t('depsLevelFile')),
          h(
            'div',
            { className: 'dshg-tabs' },
            ['file', 'folder'].map((option) =>
              h(
                'button',
                {
                  key: option,
                  type: 'button',
                  className: 'dshg-tab',
                  'data-active': level === option ? 'true' : 'false',
                  onClick: () => setLevel(option),
                },
                option === 'file' ? t('depsLevelFile') : t('depsLevelFolder'),
              ),
            ),
          ),
          h('span', { style: { width: '8px' } }),
          ['imports', 'calls', 'inherits', 'other'].map((key) =>
            h(
              'button',
              {
                key,
                type: 'button',
                className: 'dshg-toggle',
                'data-on': relations[key] ? 'true' : 'false',
                onClick: () => setRelations((current) => ({ ...current, [key]: !current[key] })),
              },
              key,
            ),
          ),
          h('span', { className: 'dshg-spacer' }),
          deps.cycles?.length ? h('span', { className: 'dshg-badge', 'data-tone': 'error' }, fill(t('cycleBadge'), { n: deps.cycles.length })) : h('span', { className: 'dshg-badge' }, t('depsNoCycles')),
          h('span', { className: 'dshg-muted' }, `${deps.stats?.nodes ?? 0} · ${edges.length}`),
        ),
        h(GraphCanvas, {
          nodes: deps.nodes,
          edges,
          layout: 'layered',
          selectedId,
          arrows: true,
          colorBy: 'cycle',
          resetToken,
          onSelect: (node) => {
            if (node.type === 'external') onSelect({ kind: 'external', id: node.id, label: node.label })
            else if (level === 'file') onSelect({ kind: 'file', path: node.id })
            else onSelect({ kind: 'dep', id: node.id, label: node.label })
          },
        }),
      )
    }

    /* ---------------------------------------------------------------- side */

    function SidePanel(props) {
      const {
        t,
        view,
        graph,
        deps,
        detail,
        detailLoading,
        selected,
        search,
        setSearch,
        searchResults,
        searchLoading,
        openItem,
        pathFrom,
        pathHint,
        pathResult,
        pathError,
        clearPath,
        beginPath,
        impact,
        impactLoading,
        runImpact,
        setView,
        depsLevel,
      } = props
      const showResults = Boolean(search.trim()) && !pathFrom
      return h(
        'div',
        { className: 'dshg-side' },
        h(
          'div',
          { className: 'dshg-side-head' },
          h('div', { className: 'dshg-side-title' }, h('span', null, pathFrom ? t('pathHint') : t('details')), pathFrom ? h('button', { type: 'button', className: 'dshg-smallbtn', onClick: clearPath }, t('clear')) : null),
          h('input', {
            className: 'dshg-input',
            placeholder: t('searchPlaceholder'),
            value: search,
            onChange: (event) => setSearch(event.target.value),
          }),
        ),
        h(
          'div',
          { className: 'dshg-side-body' },
          showResults
            ? h(
                'div',
                null,
                h('div', { className: 'dshg-sectitle' }, searchLoading ? t('loading') : fill(t('searchResults'), { n: searchResults.length })),
                searchResults.length === 0 && !searchLoading
                  ? h('div', { className: 'dshg-muted' }, t('searchEmpty'))
                  : searchResults.map((result) =>
                      h(
                        'div',
                        {
                          key: `${result.kind}:${result.id}`,
                          className: 'dshg-row',
                          onClick: () => {
                            setSearch('')
                            openItem(result.kind === 'file' ? { kind: 'file', path: result.file, nodeId: result.id } : { kind: 'node', id: result.id, nodeId: result.id })
                          },
                        },
                        h('span', { className: 'dshg-ticon', 'data-kind': result.kind === 'file' ? 'file' : 'symbol' }, result.kind === 'file' ? '▤' : 'ƒ'),
                        h(
                          'span',
                          { className: 'dshg-row-main' },
                          h('div', { className: 'dshg-row-name' }, result.label),
                          h('div', { className: 'dshg-row-sub dshg-mono' }, `${result.file || ''}${result.line ? `:${result.line}` : ''}`),
                        ),
                      ),
                    ),
              )
            : null,
          pathFrom
            ? h(
                'div',
                null,
                h('div', { className: 'dshg-muted' }, pathHint),
                h('div', { className: 'dshg-muted', style: { marginTop: '6px' } }, pathFrom.kind === 'file' ? pathFrom.path : pathFrom.label || pathFrom.id),
              )
            : null,
          pathResult
            ? h(
                'div',
                null,
                h('div', { className: 'dshg-sectitle' }, t('pathResult')),
                pathResult.found
                  ? pathResult.hops.map((hop, index) =>
                      h(
                        'div',
                        { className: 'dshg-pathstep', key: index },
                        h('span', { className: 'dshg-badge' }, hop.relation),
                        h('span', { className: 'dshg-mono dshg-row-name' }, hop.from.label),
                        h('span', { className: 'dshg-muted' }, '→'),
                        h('span', { className: 'dshg-mono dshg-row-name' }, hop.to.label),
                      ),
                    )
                  : h('div', { className: 'dshg-muted' }, t('pathNone')),
              )
            : null,
          pathError ? h('div', { className: 'dshg-formerror' }, pathError) : null,
          !showResults && !pathFrom && !detail && view === 'deps' && deps && selected?.kind !== 'external'
            ? h(DepsSummary, { deps, t, onSelect: openItem, level: depsLevel })
            : null,
          !showResults && selected?.kind === 'external'
            ? (() => {
                const external = deps?.nodes?.find((node) => node.id === selected.id)
                return h(
                  'div',
                  null,
                  h(
                    'div',
                    { className: 'dshg-side-title' },
                    h('span', { className: 'dshg-row-name dshg-mono' }, external?.label || selected.label || selected.id),
                    h('span', { className: 'dshg-badge' }, t('depsExternal')),
                  ),
                  h(
                    'div',
                    { className: 'dshg-legend', style: { marginTop: '4px' } },
                    external?.ecosystem ? h('span', null, external.ecosystem) : null,
                    h('span', null, `${t('incoming')} ${external?.fanIn ?? 0}`),
                  ),
                  (external?.importers || []).length > 0
                    ? h(
                        'div',
                        null,
                        h('div', { className: 'dshg-sectitle' }, `${t('file')} (${external.importers.length})`),
                        external.importers.map((file) =>
                          h(
                            'div',
                            { key: file, className: 'dshg-row', onClick: () => openItem({ kind: 'file', path: file }) },
                            h('span', { className: 'dshg-ticon' }, '←'),
                            h('span', { className: 'dshg-row-main' }, h('div', { className: 'dshg-row-name dshg-mono' }, file)),
                          ),
                        ),
                      )
                    : h('div', { className: 'dshg-muted' }, t('selectHint')),
                )
              })()
            : null,
          !showResults && !pathFrom && !detail && view !== 'deps'
            ? h('div', { className: 'dshg-muted' }, t('selectHint'))
            : null,
          detailLoading ? h('div', { className: 'dshg-muted' }, t('loading')) : null,
          !showResults && detail
            ? h(
                'div',
                null,
                h('div', { className: 'dshg-side-title' }, h('span', { className: 'dshg-row-name' }, detail.kind === 'file' ? detail.path : detail.label), h('span', { className: 'dshg-badge' }, detail.kind || 'file')),
                h(
                  'div',
                  { className: 'dshg-legend', style: { marginTop: '4px' } },
                  detail.kind === 'node'
                    ? [
                        h('span', { key: 'file', className: 'dshg-mono' }, `${detail.file || ''}${detail.line ? `:${detail.line}` : ''}`),
                        h('span', { key: 'community' }, `${t('community')} ${(detail.communityName || detail.community) ?? '—'}`),
                        h('span', { key: 'degree' }, `${t('degree')} ${detail.degree ?? 0}`),
                      ]
                    : [
                        h('span', { key: 'fanin' }, `${t('incoming')} ${detail.fanIn ?? 0}`),
                        h('span', { key: 'fanout' }, `${t('outgoing')} ${detail.fanOut ?? 0}`),
                        detail.community !== null && detail.community !== undefined ? h('span', { key: 'community' }, `${t('community')} ${detail.community}`) : null,
                      ],
                ),
                detail.kind === 'node'
                  ? h(
                      'div',
                      null,
                      (detail.groups || []).map((group) =>
                        h(
                          'div',
                          { key: group.relation },
                          h('div', { className: 'dshg-sectitle' }, `${group.relation} (${group.items.length})`),
                          group.items.slice(0, 40).map((neighbor) =>
                            h(
                              'div',
                              { key: `${neighbor.direction}:${neighbor.node.id}`, className: 'dshg-row', onClick: () => openItem({ kind: 'node', id: neighbor.node.id }) },
                              h('span', { className: 'dshg-ticon' }, neighbor.direction === 'in' ? '←' : '→'),
                              h(
                                'span',
                                { className: 'dshg-row-main' },
                                h('div', { className: 'dshg-row-name' }, neighbor.node.label),
                                h('div', { className: 'dshg-row-sub dshg-mono' }, `${neighbor.node.file || ''}${neighbor.node.line ? `:${neighbor.node.line}` : ''}`),
                              ),
                              h('span', { className: 'dshg-badge' }, neighbor.confidence === 'INFERRED' ? 'INF' : 'EXT'),
                            ),
                          ),
                        ),
                      ),
                      detail.file
                        ? h(
                            'div',
                            null,
                            h(
                              'div',
                              { className: 'dshg-formrow' },
                              h('button', { type: 'button', className: 'dshg-smallbtn', onClick: () => beginPath({ kind: 'node', id: detail.id, label: detail.label }) }, t('pathFrom')),
                            ),
                          )
                        : null,
                    )
                  : h(
                      'div',
                      null,
                      h('div', { className: 'dshg-sectitle' }, `${t('symbols')} (${detail.symbols?.length || 0})`),
                      (detail.symbols || []).slice(0, 80).map((symbol) =>
                        h(
                          'div',
                          { key: symbol.id, className: 'dshg-row', onClick: () => openItem({ kind: 'node', id: symbol.id }) },
                          h('span', { className: 'dshg-ticon', 'data-kind': 'symbol' }, 'ƒ'),
                          h('span', { className: 'dshg-row-main' }, h('div', { className: 'dshg-row-name' }, symbol.label), h('div', { className: 'dshg-row-sub' }, `L${symbol.line}`)),
                        ),
                      ),
                      (detail.outgoing || []).length > 0
                        ? h(
                            'div',
                            null,
                            h('div', { className: 'dshg-sectitle' }, `${t('outgoing')} (${detail.outgoing.length})`),
                            detail.outgoing.slice(0, 30).map((edge) =>
                              h(
                                'div',
                                { key: `out:${edge.target}`, className: 'dshg-row', onClick: () => openItem({ kind: 'file', path: edge.target }) },
                                h('span', { className: 'dshg-ticon' }, '→'),
                                h(
                                  'span',
                                  { className: 'dshg-row-main' },
                                  h('div', { className: 'dshg-row-name dshg-mono' }, edge.target),
                                  h('div', { className: 'dshg-row-sub' }, `${Object.keys(edge.relations).join(', ')} · ${edge.count} links`),
                                ),
                              ),
                            ),
                          )
                        : null,
                      (detail.incoming || []).length > 0
                        ? h(
                            'div',
                            null,
                            h('div', { className: 'dshg-sectitle' }, `${t('incoming')} (${detail.incoming.length})`),
                            detail.incoming.slice(0, 30).map((edge) =>
                              h(
                                'div',
                                { key: `in:${edge.source}`, className: 'dshg-row', onClick: () => openItem({ kind: 'file', path: edge.source }) },
                                h('span', { className: 'dshg-ticon' }, '←'),
                                h(
                                  'span',
                                  { className: 'dshg-row-main' },
                                  h('div', { className: 'dshg-row-name dshg-mono' }, edge.source),
                                  h('div', { className: 'dshg-row-sub' }, `${Object.keys(edge.relations).join(', ')} · ${edge.count} links`),
                                ),
                              ),
                            ),
                          )
                        : null,
                      h(
                        'div',
                        { className: 'dshg-sectitle' },
                        `${t('evidence')} (${(detail.outgoing || []).reduce((sum, edge) => sum + Math.min(2, edge.evidence?.length || 0), 0)})`,
                      ),
                      (detail.outgoing || []).slice(0, 8).map((edge) =>
                        (edge.evidence || []).slice(0, 2).map((item, index) =>
                          h(
                            'div',
                            { key: `${edge.target}:${index}`, className: 'dshg-row', onClick: () => openItem({ kind: 'node', id: item.sourceId || '' }) },
                            h('span', { className: 'dshg-ticon', 'data-kind': 'symbol' }, '·'),
                            h(
                              'span',
                              { className: 'dshg-row-main' },
                              h('div', { className: 'dshg-row-name dshg-mono' }, `${item.file}:${item.line}`),
                              h('div', { className: 'dshg-row-sub' }, `${item.relation} → ${item.toLabel}`),
                            ),
                          ),
                        ),
                      ),
                      h(
                        'div',
                        { className: 'dshg-formrow' },
                        h('button', { type: 'button', className: 'dshg-smallbtn', onClick: () => void runImpact({ kind: 'file', path: detail.path }) }, impactLoading ? t('loading') : t('impact')),
                        detail.nodeId
                          ? h('button', { type: 'button', className: 'dshg-smallbtn', onClick: () => beginPath({ kind: 'file', path: detail.path, nodeId: detail.nodeId }) }, t('pathFrom'))
                          : null,
                      ),
                    ),
                impact
                  ? h(
                      'div',
                      { className: 'dshg-impact' },
                      h('div', { className: 'dshg-sectitle' }, `${t('impactTitle')} (${impact.total})`),
                      impact.files.slice(0, 40).map((item) =>
                        h(
                          'div',
                          { key: item.file, className: 'dshg-row', onClick: () => openItem({ kind: 'file', path: item.file }) },
                          h('span', { className: 'dshg-badge' }, `+${item.distance}`),
                          h('span', { className: 'dshg-row-name dshg-mono' }, item.file),
                        ),
                      ),
                    )
                  : null,
              )
            : null,
        ),
      )
    }

    function DepsSummary(props) {
      const { deps, t, onSelect, level } = props
      const hasInternal = (deps.edges || []).some((edge) => !edge.external)
      const select = (id, label) => onSelect(level === 'file' ? { kind: 'file', path: id } : { kind: 'dep', id, label })
      const row = (item, key, tone) =>
        h(
          'div',
          { key, className: 'dshg-row', onClick: () => select(item.id, item.label) },
          h('span', { className: 'dshg-row-name dshg-mono' }, item.label),
          h('span', { className: 'dshg-tsize' }, String(item.count)),
        )
      return h(
        'div',
        null,
        !hasInternal ? h('div', { className: 'dshg-muted', style: { marginBottom: '8px' } }, t('depsNoInternal')) : null,
        h('div', { className: 'dshg-sectitle' }, t('depsTopIn')),
        (deps.topIn || []).slice(0, 8).map((item, index) => row(item, `in:${index}`)),
        h('div', { className: 'dshg-sectitle' }, t('depsTopOut')),
        (deps.topOut || []).slice(0, 8).map((item, index) => row(item, `out:${index}`)),
        deps.cycles?.length
          ? h(
              'div',
              null,
              h('div', { className: 'dshg-sectitle' }, t('depsCycles')),
              deps.cycles.slice(0, 4).map((cycle, index) =>
                h('div', { key: index, className: 'dshg-mono dshg-row-sub' }, cycle.join(' ↔ ')),
              ),
            )
          : null,
        deps.orphans?.length
          ? h(
              'div',
              null,
              h('div', { className: 'dshg-sectitle' }, `${t('depsOrphans')} (${deps.orphans.length})`),
              deps.orphans.slice(0, 8).map((file) =>
                h('div', { key: file, className: 'dshg-row', onClick: () => select(file, file) }, h('span', { className: 'dshg-row-name dshg-mono' }, file)),
              ),
            )
          : null,
        deps.external?.length
          ? h(
              'div',
              null,
              h('div', { className: 'dshg-sectitle' }, t('depsExternal')),
              deps.external.slice(0, 8).map((item) =>
                h(
                  'div',
                  {
                    key: item.name,
                    className: 'dshg-row',
                    onClick: () => onSelect({ kind: 'external', id: `ext:${item.name}`, label: item.name }),
                  },
                  h('span', { className: 'dshg-row-name dshg-mono' }, item.name),
                  h('span', { className: 'dshg-tsize' }, String(item.count)),
                ),
              ),
            )
          : null,
      )
    }

    /* -------------------------------------------------------------- settings */

    function ExternalsSettings(props) {
      const t = bindT(props)
      const [projects, setProjects] = useState({ items: [], default: '' })
      const [root, setRoot] = useState(() => {
        try {
          return window.localStorage.getItem(SETTINGS_ROOT_KEY) || ''
        } catch {
          return ''
        }
      })
      const [data, setData] = useState(null)
      const [rootDraft, setRootDraft] = useState(root)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [filter, setFilter] = useState('all')
      const [form, setForm] = useState({ name: '', ecosystem: 'npm', range: '' })
      const [busy, setBusy] = useState('')

      useEffect(() => {
        let cancelled = false
        api('/api/graphify.projects')
          .then((value) => {
            if (cancelled) return
            const chosen = root || value.default || value.items?.[0]?.path || ''
            setProjects(value)
            if (!root && chosen) setRoot(chosen)
          })
          .catch((failure) => {
            if (!cancelled) setError(failure.message || String(failure))
          })
        return () => {
          cancelled = true
        }
      }, [])

      const load = useCallback(async () => {
        if (!root) return
        setLoading(true)
        try {
          const value = await api('/api/graphify.externals', { root })
          setData(value)
          setError('')
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setLoading(false)
        }
      }, [root])

      useEffect(() => {
        setRootDraft(root)
      }, [root])

      useEffect(() => {
        void load()
      }, [load])

      const chooseRoot = (value) => {
        const next = String(value || '').trim()
        setRoot(next)
        setRootDraft(next)
        try {
          window.localStorage.setItem(SETTINGS_ROOT_KEY, next)
        } catch {}
      }

      const act = async (action, dep, extra = {}) => {
        if (!dep) return
        setBusy(`${action}:${dep.key}`)
        setNotice('')
        try {
          const value = await postApi('/api/graphify.externals.update', {
            root,
            action,
            name: dep.name,
            ecosystem: dep.ecosystem,
            ...extra,
          })
          setData((current) => (current ? { ...current, deps: value.deps || current.deps } : current))
          setNotice(t(action === 'verify' ? 'statusVerified' : action === 'ignore' ? 'statusIgnored' : 'reset'))
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setBusy('')
        }
      }

      const add = async () => {
        const name = form.name.trim()
        if (!name) return
        setBusy('add')
        setNotice('')
        try {
          const value = await postApi('/api/graphify.externals.update', {
            root,
            action: 'add',
            name,
            ecosystem: form.ecosystem || 'manual',
            range: form.range,
          })
          setData((current) => (current ? { ...current, deps: value.deps || current.deps } : current))
          setForm({ name: '', ecosystem: form.ecosystem, range: '' })
          setNotice(t('addAction'))
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setBusy('')
        }
      }

      const deps = (data?.deps || []).filter((dep) => (filter === 'attention' ? dep.status === 'missing' || dep.status === 'unresolved' : true))
      const attention = (data?.deps || []).filter((dep) => dep.status === 'missing' || dep.status === 'unresolved').length

      return h(
        'div',
        { className: 'dshg-settings' },
        h('h2', null, t('settingsTitle')),
        h('div', { className: 'dshg-muted' }, t('settingsIntro')),
        projects.items.length === 0 && !projects.default
          ? h('div', { className: 'dshg-muted', style: { marginTop: '10px' } }, t('settingsNoProject'))
          : h(
              'div',
              { className: 'dshg-formrow' },
              h('span', { className: 'dshg-muted' }, t('project')),
              h(
                'select',
                {
                  className: 'dshg-select',
                  value: root,
                  onChange: (event) => chooseRoot(event.target.value),
                },
                projects.items.map((item) => h('option', { key: item.id || item.path, value: item.path }, `${item.title || item.path} — ${item.path}`)),
                projects.items.length === 0 && projects.default ? h('option', { value: projects.default }, projects.default) : null,
              ),
              h('input', {
                className: 'dshg-input',
                style: { minWidth: '260px', flex: '1 1 260px' },
                value: rootDraft,
                placeholder: t('rootLabel'),
                onChange: (event) => setRootDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') chooseRoot(rootDraft)
                },
              }),
              h('button', { type: 'button', className: 'dshg-btn', onClick: () => chooseRoot(rootDraft) }, t('applyRoot')),
              h('button', { type: 'button', className: 'dshg-btn', disabled: loading, onClick: () => void load() }, t('rescan')),
              loading ? h('span', { className: 'dshg-muted' }, t('loading')) : null,
            ),
        error ? h('div', { className: 'dshg-formerror' }, error) : null,
        notice ? h('div', { className: 'dshg-notice' }, notice) : null,
        h(
          'div',
          { className: 'dshg-card' },
          h('h3', null, t('runtimeTitle')),
          h(
            'div',
            { className: 'dshg-kv' },
            h('span', null, 'CLI'),
            h('span', { className: 'dshg-mono' }, data?.binary?.available ? `${data.binary.command} · ${data.binary.version || ''}` : t('runtimeMissing')),
            h('span', null, t('graphPath')),
            h('span', { className: 'dshg-mono' }, data?.graph?.path || '—'),
            h('span', null, 'graph.json'),
            h('span', null, data?.graph?.exists ? 'present' : t('graphMissing')),
            h('span', null, t('manifests')),
            h('span', null, data?.manifests?.length ? data.manifests.map((item) => `${item.path} (${item.count})`).join(', ') : t('noManifests')),
          ),
        ),
        h(
          'div',
          { className: 'dshg-card' },
          h('h3', null, t('externalsTitle')),
          h('div', { className: 'dshg-muted' }, t('externalHelp')),
          h(
            'div',
            { className: 'dshg-formrow' },
            h(
              'div',
              { className: 'dshg-tabs' },
              h(
                'button',
                { type: 'button', className: 'dshg-tab', 'data-active': filter === 'all' ? 'true' : 'false', onClick: () => setFilter('all') },
                `${t('filterAll')} (${data?.deps?.length || 0})`,
              ),
              h(
                'button',
                { type: 'button', className: 'dshg-tab', 'data-active': filter === 'attention' ? 'true' : 'false', onClick: () => setFilter('attention') },
                `${t('filterAttention')} (${attention})`,
              ),
            ),
            h('span', { className: 'dshg-spacer' }),
            h('span', { className: 'dshg-muted' }, data ? fill(t('searchResults'), { n: deps.length }) : ''),
          ),
          deps.length === 0
            ? h('div', { className: 'dshg-muted', style: { marginTop: '8px' } }, t('noExternals'))
            : h(
                'div',
                { style: { overflowX: 'auto', marginTop: '8px' } },
                h(
                  'table',
                  { className: 'dshg-table' },
                  h(
                    'thead',
                    null,
                    h(
                      'tr',
                      null,
                      h('th', null, t('addName')),
                      h('th', null, t('addEcosystem')),
                      h('th', null, t('declaredRange')),
                      h('th', null, t('installedVersion')),
                      h('th', null, t('manifest')),
                      h('th', null, t('usage')),
                      h('th', null, t('status')),
                      h('th', null, t('actions')),
                    ),
                  ),
                  h(
                    'tbody',
                    null,
                    deps.map((dep) =>
                      h(
                        'tr',
                        { key: dep.key },
                        h('td', null, h('div', { className: 'dshg-row-name' }, dep.name), dep.note ? h('div', { className: 'dshg-row-sub' }, dep.note) : null),
                        h('td', null, h('span', { className: 'dshg-badge' }, dep.ecosystem)),
                        h('td', { className: 'dshg-mono' }, dep.range || '—'),
                        h('td', { className: 'dshg-mono' }, dep.installed || '—'),
                        h('td', { className: 'dshg-mono' }, dep.manifest || (dep.custom ? t('custom') : '—')),
                        h('td', null, dep.usage ? String(dep.usage) : '—'),
                        h('td', null, h('span', { className: 'dshg-badge', 'data-tone': statusTone(dep.status) }, t(`status${dep.status.charAt(0).toUpperCase()}${dep.status.slice(1)}`) || dep.status)),
                        h(
                          'td',
                          null,
                          h(
                            'div',
                            { className: 'dshg-tablerow-actions' },
                            h(
                              'button',
                              {
                                type: 'button',
                                className: 'dshg-smallbtn',
                                disabled: busy.endsWith(dep.key),
                                onClick: () => void act('verify', dep, { note: dep.note || '' }),
                              },
                              t('verified'),
                            ),
                            h(
                              'button',
                              {
                                type: 'button',
                                className: 'dshg-smallbtn',
                                disabled: busy.endsWith(dep.key),
                                onClick: () => void act('ignore', dep),
                              },
                              t('ignored'),
                            ),
                            h(
                              'button',
                              {
                                type: 'button',
                                className: 'dshg-smallbtn',
                                disabled: busy.endsWith(dep.key),
                                onClick: () => void act('reset', dep),
                              },
                              t('reset'),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          h('h3', { style: { marginTop: '16px' } }, t('addTitle')),
          h(
            'div',
            { className: 'dshg-formrow' },
            h('input', {
              className: 'dshg-input',
              placeholder: t('addName'),
              value: form.name,
              onChange: (event) => setForm((current) => ({ ...current, name: event.target.value })),
            }),
            h(
              'select',
              {
                className: 'dshg-select',
                value: form.ecosystem,
                onChange: (event) => setForm((current) => ({ ...current, ecosystem: event.target.value })),
              },
              ['npm', 'python', 'rust', 'go', 'php', 'system', 'manual'].map((value) => h('option', { key: value, value }, value)),
            ),
            h('input', {
              className: 'dshg-input',
              placeholder: t('addRange'),
              value: form.range,
              onChange: (event) => setForm((current) => ({ ...current, range: event.target.value })),
            }),
            h('button', { type: 'button', className: 'dshg-btn', disabled: busy === 'add' || !form.name.trim(), onClick: () => void add() }, t('addAction')),
          ),
        ),
      )
    }

    /* ------------------------------------------------------------ registration */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        translate = t
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'graphify: dictionaries')
        ctx.effect(() => installStyles(), 'graphify: styles')
        ctx.slots.inject('conversation.view', () =>
          ctx.slots.register(
            {
              name: 'conversation.view',
              id: 'graphify',
              order: 30,
              locale: NS,
              label: () => t('nav'),
            },
            GraphTab,
          ),
        )
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'graphify',
              order: 35,
              locale: NS,
              label: () => t('externalsNav'),
            },
            ExternalsSettings,
          ),
        )
      },
    }
  },
})
