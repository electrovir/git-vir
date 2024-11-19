import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {loadTestCwd} from '../test-cwd.test-helper.js';
import {listOpenPullRequests} from './pull-request-data.js';

describe(listOpenPullRequests.name, () => {
    it('gets pull requests', async () => {
        const testCwd = await loadTestCwd();
        const output = await listOpenPullRequests(testCwd || process.cwd());

        if (testCwd) {
            console.info(output);
            assert.isLengthAtLeast(output, 1);
        }
    });
});
