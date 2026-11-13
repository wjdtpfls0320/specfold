import Dexie, { type Table } from 'dexie';
import type { Project, UsageHistory } from './types';

class SpecfoldDB extends Dexie {
  projects!: Table<Project, string>;
  /** Legacy table from when AI proposed directions (recent fonts/colors). Kept so the schema stays at v1. */
  usage!: Table<UsageHistory, string>;
  constructor() {
    super('specfold');
    this.version(1).stores({ projects: 'id, updatedAt', usage: 'id' });
  }
}

export const db = new SpecfoldDB();
