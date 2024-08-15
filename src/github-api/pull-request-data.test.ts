import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {loadTestCwd} from '../test-cwd.test-helper.js';
import {listOpenPullRequests} from './pull-request-data.js';

describe(listOpenPullRequests.name, () => {
    it('gets pull requests', async () => {
        const testCwd = await loadTestCwd();
        const output = await listOpenPullRequests(testCwd || process.cwd());

        if (testCwd) {
            console.info(output);
            assert(output.length > 1);
        }
    });
});
