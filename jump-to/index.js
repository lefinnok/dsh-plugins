/**
 * Host half of the Jump To bundle (`@local/dsh-jump`).
 *
 * The browser half owns the header trigger, the searchable switcher overlay,
 * and the live status strip; this half only keeps the bundle installable.
 */

/** Stable Cordis plugin name. */
export const name = 'ui-jump-to';

/** The browser module reads host state through standard slot hooks. */
export function apply() {}
