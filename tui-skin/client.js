window.__ModuleLoader__.load({
  id: '@local/dsh-tui-skin',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* ------------------------------------------------------------------ *
     * Palettes (alias tokens). Gruvbox Soft = the Alacritty scheme.       *
     * ------------------------------------------------------------------ */
    const PALETTES = {
      gruvbox: {
        label: 'Gruvbox Soft',
        accent: '#ed9562',
        tokens: {
          '--dsw-alias-bg-base': { light: '#f6efe8', dark: '#18120e' },
          '--dsw-alias-bg-layer-1': { light: '#fbf7f2', dark: '#1f1813' },
          '--dsw-alias-bg-layer-2': { light: '#f0e5da', dark: '#241c16' },
          '--dsw-alias-bg-overlay': { light: '#fbf7f2', dark: '#1c1511' },
          '--dsw-alias-border-l1': { light: '#e0d0c2', dark: '#353433' },
          '--dsw-alias-border-l2': { light: '#c6b09c', dark: '#4e4238' },
          '--dsw-alias-brand-primary': { light: '#a34f1c', dark: '#ed9562' },
          '--dsw-alias-label-primary': { light: '#241b15', dark: '#ece0d9' },
          '--dsw-alias-label-secondary': { light: '#6d5d51', dark: '#b29f91' },
          '--dsw-alias-state-error-primary': { light: '#b23c00', dark: '#ff8a20' },
          '--dsw-alias-state-idle-primary': { light: '#9b8b7d', dark: '#8c7b6d' },
          '--dsw-alias-state-success-primary': { light: '#6f6420', dark: '#b9ab66' },
          '--dsw-alias-state-warn-primary': { light: '#8a5f00', dark: '#f4c16d' },
          '--dsw-specific-sidebar-fill': { light: '#f0e6dc', dark: '#120d0a' },
        },
      },
      phosphor: {
        label: 'Phosphor',
        accent: '#46e07f',
        tokens: {
          '--dsw-alias-bg-base': { light: '#f2f2ea', dark: '#0a0e0a' },
          '--dsw-alias-bg-layer-1': { light: '#fafaf3', dark: '#10150f' },
          '--dsw-alias-bg-layer-2': { light: '#eeeee3', dark: '#151b14' },
          '--dsw-alias-bg-overlay': { light: '#fafaf3', dark: '#10150f' },
          '--dsw-alias-border-l1': { light: '#d5d5c4', dark: '#26301f' },
          '--dsw-alias-border-l2': { light: '#b5b5a0', dark: '#3a472e' },
          '--dsw-alias-brand-primary': { light: '#1c6b3a', dark: '#46e07f' },
          '--dsw-alias-label-primary': { light: '#14160f', dark: '#d8f3dc' },
          '--dsw-alias-label-secondary': { light: '#565b4a', dark: '#8fa593' },
          '--dsw-alias-state-error-primary': { light: '#a3261b', dark: '#ff6b6b' },
          '--dsw-alias-state-idle-primary': { light: '#868b78', dark: '#6f7f6f' },
          '--dsw-alias-state-success-primary': { light: '#1c6b3a', dark: '#46e07f' },
          '--dsw-alias-state-warn-primary': { light: '#7a5a00', dark: '#e6c86a' },
          '--dsw-specific-sidebar-fill': { light: '#e9e9dd', dark: '#070b07' },
        },
      },
    };

    /* ------------------------------------------------------------------ *
     * Persisted preferences (per browser). Font size is owned by the      *
     * theme service instead, so the host shortcuts keep working.          *
     * ------------------------------------------------------------------ */
    const STORAGE_KEY = 'dsh.tui-skin.v1';
    const DEFAULTS = {
      enabled: true,
      palette: 'gruvbox',
      accent: '',
      fontFamily: 'DM Mono',
      square: true,
      flat: true,
      scaleChrome: true,
      seamlessInput: true,
      hideInputBorder: true,
    };

    // Font sizes are owned by the theme service, not by this store.
    const SIZE_SPECS = {
      text: { min: 10, max: 22, default: 14, field: 'textSize' },
      code: { min: 10, max: 16, default: 11, field: 'codeSize' },
      terminal: { min: 10, max: 20, default: 13, field: 'terminalSize' },
    };
    const state = { ...DEFAULTS, textSize: 14, codeSize: 11, terminalSize: 13 };
    const listeners = new Set();

    function loadSaved() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        for (const key of Object.keys(DEFAULTS)) {
          if (saved && typeof saved[key] === typeof DEFAULTS[key]) state[key] = saved[key];
        }
        if (!PALETTES[state.palette]) state.palette = DEFAULTS.palette;
      } catch (error) {
        /* storage unavailable: keep defaults */
      }
    }

    function persist() {
      const out = {};
      for (const key of Object.keys(DEFAULTS)) out[key] = state[key];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (error) {
        /* storage unavailable: session-only */
      }
    }

    function emit() {
      for (const fn of listeners) {
        try {
          fn();
        } catch (error) {
          /* a broken listener must not stop the others */
        }
      }
    }

    const store = {
      get: () => ({ ...state }),
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      update(patch) {
        let changed = false;
        for (const key of Object.keys(patch)) {
          if (state[key] !== patch[key]) {
            state[key] = patch[key];
            changed = true;
          }
        }
        if (!changed) return;
        persist();
        emit();
      },
      local(patch) {
        let changed = false;
        for (const key of Object.keys(patch)) {
          if (state[key] !== patch[key]) {
            state[key] = patch[key];
            changed = true;
          }
        }
        if (changed) emit();
      },
      reset() {
        this.update({ ...DEFAULTS });
      },
    };

    /* ------------------------------------------------------------------ *
     * Runtime: token layer + attribute-gated stylesheet.                  *
     * ------------------------------------------------------------------ */
    const GENERIC_FAMILIES = new Set([
      'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-monospace',
    ]);

    function fontStack(input) {
      const names = String(input || '')
        .split(',')
        .map((name) => name.replace(/["'\\<>{};]/g, '').trim())
        .filter(Boolean)
        .slice(0, 4);
      const parts = names.map((name) =>
        GENERIC_FAMILIES.has(name.toLowerCase()) ? name : '"' + name + '"');
      if (!names.length) return '"DM Mono", monospace';
      const last = names[names.length - 1].toLowerCase();
      if (!GENERIC_FAMILIES.has(last)) parts.push('monospace');
      return parts.join(', ');
    }

    function buildTokens(s) {
      const preset = PALETTES[s.palette] || PALETTES.gruvbox;
      const tokens = {};
      for (const [name, value] of Object.entries(preset.tokens)) tokens[name] = { ...value };
      if (s.accent) tokens['--dsw-alias-brand-primary'] = { light: s.accent, dark: s.accent };
      return tokens;
    }

    // Fixed UI type scale (menus, buttons, labels, sidebar). Markdown tokens
    // are excluded: content already follows --dsh-content-font-size.
    const CHROME_TOKENS = [
      ['xxxs-11', 400, 11, 14],
      ['xxxs-strong-11', 500, 11, 14],
      ['xxs-12', 400, 12, 18],
      ['xxs-strong-12', 500, 12, 18],
      ['xs-13', 400, 13, 20],
      ['xs-strong-13', 500, 13, 20],
      ['s-14', 400, 14, 22],
      ['s-strong-14', 500, 14, 22],
      ['base-16', 400, 16, 24],
      ['base-strong-16', 500, 16, 24],
      ['m-18', 500, 16, 28],
      ['l-20', 500, 20, 28],
      ['xl-24', 600, 24, 32],
    ];

    function chromeCss(scale) {
      const rules = CHROME_TOKENS.map(([name, weight, size, lh]) =>
        '--dsw-font-' + name + ':' + weight +
        ' calc(' + size + 'px * var(--dsh-ui-scale)) / calc(' + lh + 'px * var(--dsh-ui-scale))' +
        ' var(--dsw-font-family);' +
        '--dsw-font-' + name + '-font-size: calc(' + size + 'px * var(--dsh-ui-scale));' +
        '--dsw-font-' + name + '-line-height: calc(' + lh + 'px * var(--dsh-ui-scale));'
      ).join('');
      return 'body[data-dsh-tui-scale]{--dsh-ui-scale:' + scale + ';' + rules + '}';
    }

    function buildCss(s) {
      const stack = fontStack(s.fontFamily);
      return [
        'body[data-dsh-tui-mono]{' +
          '--dsh-font-family-text: ' + stack + ' !important;' +
          '--dsh-font-family-code: ' + stack + ' !important;' +
          '--dsw-font-family-brand: ' + stack + ';' +
          '--dsw-focus-ring-color: var(--dsw-alias-brand-primary);' +
        '}',
        'body[data-dsh-tui-square]{' +
          '--dsw-radius-xs: 0px; --dsw-radius-sm: 0px; --dsw-radius-md: 0px;' +
          '--dsw-radius-lg: 0px; --dsw-radius-xl: 0px; --dsw-radius-panel: 0px;' +
        '}',
        'body[data-dsh-tui-flat]{' +
          '--dsw-shadow-lv1: none; --dsw-shadow-lv1-blur: none;' +
          '--dsw-shadow-lv2: none; --dsw-shadow-lv3: none;' +
          '--dsw-menu-backdrop-filter: none; --dsw-mask-blur: none;' +
          '--dsw-elevation-stroke-color: var(--dsw-alias-border-l1);' +
        '}',
        'body[data-dsh-tui-motion]{' +
          '--ds-ease-in-out: linear;' +
          '--ds-transition-duration: 0.05s;' +
          '--ds-transition-duration-fast: 0.05s;' +
          '--ds-transition-duration-slow: 0.05s;' +
        '}',
        s.scaleChrome ? chromeCss((s.textSize / 14).toFixed(3)) : '',
        // Composer card: drop the raised fill so it reads as part of the chat.
        'body[data-dsh-tui-seamless] [data-composer-card]{' +
          'background: var(--dsw-alias-bg-base);' +
        '}',
        // The composer "border" is the elevation stroke; removing the shadow
        // removes the hairline and the soft lift together.
        'body[data-dsh-tui-noinputborder] [data-composer-card]{' +
          'box-shadow: none;' +
          '--dsw-elevation-stroke-color: transparent;' +
        '}',
      ].join('\n');
    }

    let themeService = null;
    let translate = (key) => key;
    let styleEl = null;
    let disposeTokens = null;
    let lastTokenKey = null;
    let lastCss = null;

    function toggleAttr(name, on) {
      if (!document.body) return;
      if (on) document.body.setAttribute(name, '');
      else document.body.removeAttribute(name);
    }

    function sync() {
      const s = store.get();
      toggleAttr('data-dsh-tui-mono', s.enabled);
      toggleAttr('data-dsh-tui-square', s.enabled && s.square);
      toggleAttr('data-dsh-tui-flat', s.enabled && s.flat);
      toggleAttr('data-dsh-tui-motion', s.enabled);
      toggleAttr('data-dsh-tui-scale', s.enabled && s.scaleChrome);
      toggleAttr('data-dsh-tui-seamless', s.enabled && s.seamlessInput);
      toggleAttr('data-dsh-tui-noinputborder', s.enabled && s.hideInputBorder);

      if (styleEl) {
        const css = buildCss(s);
        if (css !== lastCss) {
          styleEl.textContent = css;
          lastCss = css;
        }
      }

      // Only restack the token layer when the palette actually changed; a
      // theme/change echo here would otherwise re-enter this function.
      const tokenKey = (s.enabled ? '1' : '0') + '|' + s.palette + '|' + s.accent;
      if (tokenKey === lastTokenKey) return;
      lastTokenKey = tokenKey;
      if (disposeTokens) {
        disposeTokens();
        disposeTokens = null;
      }
      if (s.enabled && themeService) {
        disposeTokens = themeService.overrideTokens('@local/dsh-tui-skin', buildTokens(s));
      }
    }

    /* ------------------------------------------------------------------ *
     * Settings page                                                        *
     * ------------------------------------------------------------------ */
    const PAGE_CSS = `
      .tui-page { max-width: 720px; padding: 8px 0 40px; display: flex; flex-direction: column; gap: 20px; }
      .tui-head h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary); }
      .tui-head p { margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
      .tui-card {
        border: 1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l1));
        border-radius: var(--dsw-radius-md);
        background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2));
        overflow: hidden;
      }
      .tui-row { display: flex; align-items: flex-start; gap: 16px; padding: 13px 16px; }
      .tui-row + .tui-row { border-top: 1px solid var(--dsw-alias-border-l1); }
      .tui-meta { flex: 1 1 auto; min-width: 0; }
      .tui-title { font-size: 13px; color: var(--dsw-alias-label-primary); }
      .tui-desc { margin-top: 3px; font-size: 12px; line-height: 1.45; color: var(--dsw-alias-label-secondary); }
      .tui-ctl { flex: none; display: flex; align-items: center; gap: 8px; }
      .tui-btn {
        appearance: none; border: 1px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
        border-radius: var(--dsw-radius-sm); padding: 4px 9px; font: inherit; font-size: 12px;
        cursor: pointer;
      }
      .tui-btn:hover { border-color: var(--dsw-alias-brand-primary); }
      .tui-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .tui-select, .tui-input {
        appearance: none; border: 1px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
        border-radius: var(--dsw-radius-sm); padding: 5px 8px; font: inherit; font-size: 12px;
        min-width: 120px;
      }
      .tui-input { min-width: 160px; }
      .tui-input:focus-visible, .tui-select:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px;
      }
      .tui-color {
        appearance: none; width: 34px; height: 26px; padding: 0;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-sm);
        background: var(--dsw-alias-bg-layer-1); cursor: pointer;
      }
      .tui-color::-webkit-color-swatch-wrapper { padding: 2px; }
      .tui-color::-webkit-color-swatch { border: none; border-radius: 0; }
      .tui-stepper { display: flex; align-items: center; gap: 6px; }
      .tui-size { min-width: 44px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-primary); }
      .tui-switch {
        position: relative; flex: none; width: 38px; height: 22px; padding: 0;
        border: 1px solid var(--dsw-alias-border-l2); border-radius: 11px;
        background: var(--dsw-alias-bg-base); cursor: pointer;
        transition: border-color 0.12s linear;
      }
      .tui-switch::after {
        content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px;
        border-radius: 7px; background: var(--dsw-alias-label-secondary);
        transition: left 0.12s linear, background 0.12s linear;
      }
      .tui-switch[aria-checked="true"] { border-color: var(--dsw-alias-brand-primary); }
      .tui-switch[aria-checked="true"]::after { left: 19px; background: var(--dsw-alias-brand-primary); }
      .tui-switch:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .tui-foot { display: flex; justify-content: flex-end; }
    `;

    function Switch(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': props.checked ? 'true' : 'false',
        'aria-label': props.label,
        className: 'tui-switch',
        onClick: () => props.onChange(!props.checked),
      });
    }

    function Row(props) {
      return h('div', { className: 'tui-row' },
        h('div', { className: 'tui-meta' },
          h('div', { className: 'tui-title' }, props.title),
          props.desc ? h('div', { className: 'tui-desc' }, props.desc) : null),
        h('div', { className: 'tui-ctl' }, props.control));
    }

    function SettingsPage() {
      const [s, setS] = React.useState(store.get());
      React.useEffect(() => store.subscribe(() => setS(store.get())), []);
      const [draft, setDraft] = React.useState(s.fontFamily);
      React.useEffect(() => setDraft(s.fontFamily), [s.fontFamily]);

      const commitFont = () => {
        const next = draft.trim();
        store.update({ fontFamily: next || DEFAULTS.fontFamily });
      };
      const setSize = (role, next) => {
        const spec = SIZE_SPECS[role];
        const px = Math.max(spec.min, Math.min(spec.max, Math.round(next)));
        store.local({ [spec.field]: px });
        if (themeService) {
          try {
            themeService.setFontSize(role, px);
          } catch (error) {
            /* out of range: keep the displayed value */
          }
        }
      };
      const sizeRow = (role, title, desc) => {
        const field = SIZE_SPECS[role].field;
        return h(Row, {
          title,
          desc,
          control: h('div', { className: 'tui-stepper' },
            h('button', {
              type: 'button',
              className: 'tui-btn',
              'aria-label': translate('smaller'),
              onClick: () => setSize(role, s[field] - 1),
            }, '\u2212'),
            h('span', { className: 'tui-size' }, s[field] + 'px'),
            h('button', {
              type: 'button',
              className: 'tui-btn',
              'aria-label': translate('larger'),
              onClick: () => setSize(role, s[field] + 1),
            }, '+')),
        });
      };

      return h('div', { className: 'tui-page' },
        h('style', null, PAGE_CSS),
        h('div', { className: 'tui-head' },
          h('h2', null, translate('title')),
          h('p', null, translate('intro'))),
        h('div', { className: 'tui-card' },
          h(Row, {
            title: translate('enabled'),
            desc: translate('enabledDesc'),
            control: h(Switch, {
              checked: s.enabled,
              label: translate('enabled'),
              onChange: (value) => store.update({ enabled: value }),
            }),
          }),
          h(Row, {
            title: translate('palette'),
            desc: translate('paletteDesc'),
            control: h('select', {
              className: 'tui-select',
              value: s.palette,
              'aria-label': translate('palette'),
              onChange: (e) => store.update({ palette: e.target.value }),
            }, Object.keys(PALETTES).map((key) =>
              h('option', { key, value: key }, PALETTES[key].label))),
          }),
          h(Row, {
            title: translate('accent'),
            desc: translate('accentDesc'),
            control: [
              h('input', {
                key: 'color',
                type: 'color',
                className: 'tui-color',
                'aria-label': translate('accent'),
                value: s.accent || PALETTES[s.palette].accent,
                onChange: (e) => store.update({ accent: e.target.value }),
              }),
              s.accent
                ? h('button', {
                    key: 'reset',
                    type: 'button',
                    className: 'tui-btn',
                    onClick: () => store.update({ accent: '' }),
                  }, translate('reset'))
                : null,
            ],
          }),
          h(Row, {
            title: translate('font'),
            desc: translate('fontDesc'),
            control: h('input', {
              className: 'tui-input',
              type: 'text',
              value: draft,
              spellCheck: false,
              'aria-label': translate('font'),
              onChange: (e) => setDraft(e.target.value),
              onBlur: commitFont,
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  commitFont();
                  e.currentTarget.blur();
                }
              },
            }),
          }),
          sizeRow('text', translate('interfaceSize'), translate('interfaceSizeDesc')),
          sizeRow('code', translate('codeSize'), translate('codeSizeDesc')),
          sizeRow('terminal', translate('terminalSize'), translate('terminalSizeDesc')),
          h(Row, {
            title: translate('scaleChrome'),
            desc: translate('scaleChromeDesc'),
            control: h(Switch, {
              checked: s.scaleChrome,
              label: translate('scaleChrome'),
              onChange: (value) => store.update({ scaleChrome: value }),
            }),
          }),
          h(Row, {
            title: translate('square'),
            desc: translate('squareDesc'),
            control: h(Switch, {
              checked: s.square,
              label: translate('square'),
              onChange: (value) => store.update({ square: value }),
            }),
          }),
          h(Row, {
            title: translate('seamlessInput'),
            desc: translate('seamlessInputDesc'),
            control: h(Switch, {
              checked: s.seamlessInput,
              label: translate('seamlessInput'),
              onChange: (value) => store.update({ seamlessInput: value }),
            }),
          }),
          h(Row, {
            title: translate('hideInputBorder'),
            desc: translate('hideInputBorderDesc'),
            control: h(Switch, {
              checked: s.hideInputBorder,
              label: translate('hideInputBorder'),
              onChange: (value) => store.update({ hideInputBorder: value }),
            }),
          }),
          h(Row, {
            title: translate('flat'),
            desc: translate('flatDesc'),
            control: h(Switch, {
              checked: s.flat,
              label: translate('flat'),
              onChange: (value) => store.update({ flat: value }),
            }),
          })),
        h('div', { className: 'tui-foot' },
          h('button', {
            type: 'button',
            className: 'tui-btn',
            onClick: () => {
              store.reset();
              setSize('text', SIZE_SPECS.text.default);
              setSize('code', SIZE_SPECS.code.default);
              setSize('terminal', SIZE_SPECS.terminal.default);
            },
          }, translate('resetAll'))));
    }

    /* ------------------------------------------------------------------ *
     * Plugin                                                              *
     * ------------------------------------------------------------------ */
    return {
      inject: ['theme', 'locale', 'slots'],
      apply(ctx) {
        themeService = ctx.theme;
        translate = ctx.locale.bind('tui-skin');
        ctx.locale.register('tui-skin', 'en', {
          sectionTitle: 'TUI Skin',
          title: 'TUI Skin',
          intro: 'A terminal-inspired skin for the Harness. Everything here is reversible: turn the skin off to get the stock look back.',
          enabled: 'Enable skin',
          enabledDesc: 'Apply the palette and the terminal chrome below.',
          palette: 'Palette',
          paletteDesc: 'Color preset. The Gruvbox Soft values match the Alacritty scheme.',
          accent: 'Accent',
          accentDesc: 'Overrides the brand color used by links, focus rings, and active states.',
          reset: 'Reset',
          font: 'Font family',
          fontDesc: 'Comma-separated family names, applied to interface and code text.',
          interfaceSize: 'Interface text',
          interfaceSizeDesc: 'Chat, console, and content text; it also drives the chrome scale below. Same value as Settings → General, so it persists after disabling the skin.',
          codeSize: 'Code',
          codeSizeDesc: 'Code blocks, inline code, and tool output.',
          terminalSize: 'Terminal',
          terminalSizeDesc: 'The sidebar terminal.',
          scaleChrome: 'Scale menus & chrome',
          scaleChromeDesc: 'Menus, buttons, sidebar rows, and labels follow the Interface text size.',
          seamlessInput: 'Seamless input',
          seamlessInputDesc: 'Use the chat background for the composer instead of its raised fill.',
          hideInputBorder: 'Hide input border',
          hideInputBorderDesc: 'Remove the composer hairline and its elevation shadow.',
          smaller: 'Smaller',
          larger: 'Larger',
          square: 'Square corners',
          squareDesc: 'Flatten every corner radius to zero.',
          flat: 'Flat surfaces',
          flatDesc: 'Remove elevation shadows and menu blur.',
          resetAll: 'Reset to defaults',
        });
        ctx.locale.register('tui-skin', 'zh', {
          sectionTitle: 'TUI 皮肤',
          title: 'TUI 皮肤',
          intro: '终端风格的界面皮肤。所有改动均可撤销：关闭皮肤即可恢复默认外观。',
          enabled: '启用皮肤',
          enabledDesc: '应用下方的配色与终端风格。',
          palette: '配色',
          paletteDesc: '颜色预设。Gruvbox Soft 与 Alacritty 配色一致。',
          accent: '强调色',
          accentDesc: '覆盖链接、焦点环与激活状态使用的主色。',
          reset: '重置',
          font: '字体',
          fontDesc: '以逗号分隔的字体名，应用于界面与代码文本。',
          interfaceSize: '界面文字',
          interfaceSizeDesc: '聊天、控制台与内容文字；同时驱动下方的界面缩放。与“设置 → 通用”为同一值，关闭皮肤后仍然生效。',
          codeSize: '代码',
          codeSizeDesc: '代码块、行内代码与工具输出。',
          terminalSize: '终端',
          terminalSizeDesc: '侧边栏终端。',
          scaleChrome: '缩放菜单与界面',
          scaleChromeDesc: '菜单、按钮、侧边栏行与标签跟随“界面文字”大小。',
          seamlessInput: '无缝输入框',
          seamlessInputDesc: '输入框使用聊天背景色，而非凸起的填充色。',
          hideInputBorder: '隐藏输入框边框',
          hideInputBorderDesc: '移除输入框的细边线与浮起阴影。',
          smaller: '减小',
          larger: '增大',
          square: '直角',
          squareDesc: '将所有圆角半径归零。',
          flat: '平面',
          flatDesc: '移除阴影与菜单模糊。',
          resetAll: '恢复默认',
        });

        loadSaved();

        ctx.effect(() => {
          styleEl = document.createElement('style');
          styleEl.setAttribute('data-dsh-tui-skin', '');
          document.head.appendChild(styleEl);

          const offStore = store.subscribe(sync);
          const offTheme = ctx.on('theme/change', () => {
            if (!themeService) return;
            const sizes = themeService.getTheme().fontSizes;
            store.local({ textSize: sizes.text, codeSize: sizes.code, terminalSize: sizes.terminal });
          });
          const initial = ctx.theme.getTheme().fontSizes;
          store.local({ textSize: initial.text, codeSize: initial.code, terminalSize: initial.terminal });
          sync();

          return () => {
            offStore();
            offTheme();
            if (disposeTokens) {
              disposeTokens();
              disposeTokens = null;
            }
            lastTokenKey = null;
            lastCss = null;
            if (styleEl) styleEl.remove();
            styleEl = null;
            toggleAttr('data-dsh-tui-mono', false);
            toggleAttr('data-dsh-tui-square', false);
            toggleAttr('data-dsh-tui-flat', false);
            toggleAttr('data-dsh-tui-motion', false);
            toggleAttr('data-dsh-tui-scale', false);
            toggleAttr('data-dsh-tui-seamless', false);
            toggleAttr('data-dsh-tui-noinputborder', false);
          };
        });

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'tui-skin',
          order: 25,
          label: () => translate('sectionTitle'),
        }, SettingsPage));
      },
    };
  },
});
