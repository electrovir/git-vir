import {assert} from '@augment-vir/assert';
import {shellQuote} from '@augment-vir/common';
import {describe, it, itCases} from '@augment-vir/test';
import {loadTestCwd} from '../test-cwd.test-helper.js';
import {createPullRequestListCommand, listPullRequests} from './pull-request-data.js';

const baseCommand =
    'gh pr list --state open --limit 1000 --json baseRefName,headRefName,id,title,isDraft,number,headRefOid,state,url';

describe(createPullRequestListCommand.name, () => {
    itCases(createPullRequestListCommand, [
        {
            it: 'sets an explicit limit and open state',
            input: [],
            expect: baseCommand,
        },
        {
            it: 'appends a head filter',
            input: [
                `--head ${shellQuote('my-branch')}`,
            ],
            expect: `${baseCommand} --head 'my-branch'`,
        },
        {
            it: 'appends a base filter',
            input: [
                `--base ${shellQuote("it's")}`,
            ],
            expect: String.raw`${baseCommand} --base 'it'\''s'`,
        },
    ]);
});

describe(listPullRequests.name, () => {
    it('gets pull requests', async () => {
        const testCwd = await loadTestCwd();
        const output = await listPullRequests(testCwd || process.cwd(), []);

        if (testCwd) {
            console.info(output);
            assert.isLengthAtLeast(output, 1);
        }
    });

    it('only gets the given head branch', async () => {
        const testCwd = await loadTestCwd();

        if (!testCwd) {
            return;
        }

        const allPullRequests = await listPullRequests(testCwd, []);
        assert.isLengthAtLeast(allPullRequests, 1);
        const expectedHeadRefName = allPullRequests[0].headRefName;

        const output = await listPullRequests(testCwd, [
            `--head ${shellQuote(expectedHeadRefName)}`,
        ]);

        assert.isLengthAtLeast(output, 1);
        assert.isTrue(
            output.every((pullRequest) => pullRequest.headRefName === expectedHeadRefName),
        );
    });

    it('only gets the given base branch', async () => {
        const testCwd = await loadTestCwd();

        if (!testCwd) {
            return;
        }

        const allPullRequests = await listPullRequests(testCwd, []);
        assert.isLengthAtLeast(allPullRequests, 1);
        const expectedBaseRefName = allPullRequests[0].baseRefName;

        const output = await listPullRequests(testCwd, [
            `--base ${shellQuote(expectedBaseRefName)}`,
        ]);

        assert.isLengthAtLeast(output, 1);
        assert.isTrue(
            output.every((pullRequest) => pullRequest.baseRefName === expectedBaseRefName),
        );
    });

    it('returns nothing for a branch with no PR', async () => {
        const testCwd = await loadTestCwd();

        if (!testCwd) {
            return;
        }

        assert.deepEquals(
            await listPullRequests(testCwd, [
                `--head ${shellQuote('git-vir-branch-that-does-not-exist')}`,
            ]),
            [],
        );
    });
});
