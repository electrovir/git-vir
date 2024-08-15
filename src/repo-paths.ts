import {dirname, join} from 'node:path';

export const repoRootDir = dirname(import.meta.dirname);
export const notCommittedDir = join(repoRootDir, '.not-committed');
