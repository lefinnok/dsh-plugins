/**
 * Host half of `@local/dsh-compose`: ships the `compose-next` skill.
 *
 * The skill body lives in `assets/compose-next/SKILL.md` and is read at apply
 * time, so editing the Markdown and reloading the plugin is the whole update
 * path. The provider is a registry entry, not a tool: the model sees the skill
 * in its catalog and loads it only when the user explicitly asks for the
 * workflow.
 *
 * @module @local/dsh-compose
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The plugin needs the skill registry. */
export const inject = ['skills']

/** Skill identifier used by the catalog and by `/compose-next`. */
const SKILL_NAME = 'compose-next'

/** Bundled skills rank below project and user skills with the same name. */
const BUNDLED_SKILL_RANK = 600

/**
 * Split YAML frontmatter from the instruction body. The frontmatter here is
 * flat `key: value` pairs, which is all a skill manifest needs.
 * @param {string} text
 */
function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return { meta: {}, body: text }
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (pair) meta[pair[1]] = pair[2].trim()
  }
  return { meta, body: text.slice(match[0].length) }
}

export function apply(ctx) {
  const directory = fileURLToPath(new URL('./assets/compose-next/', import.meta.url)).replace(/\/+$/, '')
  const file = join(directory, 'SKILL.md')
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'))

  const summary = {
    name: SKILL_NAME,
    description: parsed.meta.description ?? 'End-to-end feature delivery contract: grill → workspace → spec → implement → verify → review → finalize.',
    invocation: { modelInvocable: true, userInvocable: true },
    provider: 'dsh-compose',
    source: 'bundled',
    path: file,
    resourceBase: { kind: 'directory', path: directory },
  }

  const candidate = { ...summary, rank: BUNDLED_SKILL_RANK, locator: file }

  ctx.skills.registerProvider(() => ({
    name: 'dsh-compose',
    list: async () => [candidate],
    async get() {
      return { ...summary, content: parseFrontmatter(readFileSync(file, 'utf8')).body }
    },
  }))
}
