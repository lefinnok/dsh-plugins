# dsh-plugins

Plugin bundles for the **DeepSeek Harness** (`dsh`) Web profile. Nine small packages that add
a dashboard, a workspace switcher, a memory system, a knowledge-graph tab, a git panel, a
spend meter, a LeetCode practice panel, a denser TUI-style skin, and a composition workflow
skill.

They are ordinary dsh **bundles**: each directory is a package whose `package.json` declares
`dsh.bundle.patch`, and whose `cordis.patch.yml` inserts the plugin's Loader row. Nothing is
published to npm — the packages keep the `@local/` scope and are installed by linking the
clone into your profile.

## Install

Requires `dsh` 0.2.x on your `PATH` (developed against `0.2.1-rc.5`). The `dsh` launcher
supplies pnpm, so no separate package-manager setup is needed.

```sh
git clone https://github.com/lefinnok/dsh-plugins.git
cd dsh-plugins
./install.sh --profile web --dry-run   # show what would be linked
./install.sh --profile web             # link every bundle, then restart dsh
```

`install.sh` runs `dsh plugin --profile web add <dir>` once per bundle, which links the
package into the profile and appends it to `dsh.profile.bundles`. New code is picked up on
restart.

Remove one with `dsh plugin --profile web remove @local/dsh-jump`. Install a single bundle
with `dsh plugin --profile web add ./jump-to`.

## What is in the box

| Bundle | Package | Adds |
|---|---|---|
| `dashboard` | `@local/dsh-dashboard` | Agent dashboard: usage, live agent cards, attention items, pins, today's agents. First rail icon, `Ctrl+E` toggle. |
| `jump-to` | `@local/dsh-jump` | Two-column workspace catalog with icons, active conversations, live status. |
| `memory` | `@local/dsh-memory` | File-backed Markdown memory with BM25 search, a Memory tab, and `memory_search` / `memory_write` tools. |
| `graphify-tab` | `@local/dsh-graphify` | Knowledge-graph tab with managed `graphify` builds plus a `graphify` tool. Needs the `graphify` CLI. |
| `git-tab` | `@local/dsh-git` | Branch, HEAD, upstream divergence, and staged/unstaged/untracked state for the session directory, with repo init. |
| `budget-monitor` | `@local/dsh-budget-monitor` | DeepSeek balance and a configurable spend budget in the sidebar, read through the credentials service. |
| `leetcode-arena` | `@local/dsh-leetcode` | LeetCode practice: catalog, editor, multi-language runner, trusted tests, tiered coach. |
| `tui-skin` | `@local/dsh-tui-skin` | Denser TUI-like styling and typography for the Web UI. |
| `compose-skill` | `@local/dsh-compose` | Ships the `compose-next` skill: feature docs, task trees, and review gates for multi-step work. |

## Notes

- **graphify tab**: install the CLI first (`uv tool install graphifyy`); the tab reports the
  binary as missing until it is on `PATH` or at `~/.local/bin/graphify`.
- **Edit and reload**: because installs are links, editing a package's `index.js` or
  `client.js` and restarting dsh is enough. No build step — every package is plain ESM.
- **Not included**: the KiCad MCP plugin I use locally lives outside this repo because its
  configuration hardcodes local paths.

## License

MIT — see [LICENSE](LICENSE).
