import {readFileIfExists} from '@augment-vir/node';
import {join} from 'node:path';
import {notCommittedDir} from './repo-paths.js';

export async function loadTestCwd(): Promise<string | undefined> {
    return await readFileIfExists(join(notCommittedDir, 'test-cwd.txt'));
}
