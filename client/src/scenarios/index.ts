import type { Scenario } from '../types';

// Load all scenario JSON files at build time. This is the static fallback used
// before the runtime fetch (see runtime.ts) resolves, and if it fails — it
// reflects whatever was last published-and-committed, not necessarily the
// current live state on Netlify.
const modules = import.meta.glob<Scenario>('./*.json', { eager: true });

export const allScenarios: Scenario[] = Object.values(modules).sort((a, b) =>
  a.id.localeCompare(b.id)
);

export const scenarios: Scenario[] = allScenarios.filter(scenario => scenario.published !== false);
