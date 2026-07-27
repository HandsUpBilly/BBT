import type { Scenario } from '../types';

// Load all scenario JSON files at build time
const modules = import.meta.glob<Scenario>('./*.json', { eager: true });

export const allScenarios: Scenario[] = Object.values(modules).sort((a, b) =>
  a.id.localeCompare(b.id)
);

export const scenarios: Scenario[] = allScenarios.filter(scenario => scenario.published !== false);

export function getScenario(id: string): Scenario | undefined {
  return allScenarios.find(s => s.id === id);
}
