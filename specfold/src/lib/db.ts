import Dexie, { type Table } from 'dexie';
import type { Project, UsageHistory } from './types';

class SpecfoldDB extends Dexie {
  projects!: Table<Project, string>;
  usage!: Table<UsageHistory, string>;
  constructor() {
    super('specfold');
    this.version(1).stores({ projects: 'id, updatedAt', usage: 'id' });
  }
}

export const db = new SpecfoldDB();

export async function getUsage(): Promise<UsageHistory> {
  return (await db.usage.get('me')) ?? { id: 'me', fontsUsed: [], primaryHuesUsed: [], themesUsed: [] };
}

/** 다양성 기록: keep the 5 most recent of each (design-prompts §9). */
export async function recordUsage(fonts: string[], hueName: string, theme: string) {
  const u = await getUsage();
  const push = (arr: string[], vals: string[]) => [...vals, ...arr.filter((x) => !vals.includes(x))].slice(0, 5);
  await db.usage.put({
    id: 'me',
    fontsUsed: push(u.fontsUsed, fonts),
    primaryHuesUsed: push(u.primaryHuesUsed, [hueName]),
    themesUsed: push(u.themesUsed, [theme]),
  });
}
