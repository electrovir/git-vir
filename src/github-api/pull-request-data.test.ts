import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {loadTestCwd} from '../test-cwd.test-helper.js';
import {
    assertCompletePullRequestList,
    createPullRequestListCommand,
    escapeShellArgument,
    listOpenPullRequests,
    listOpenPullRequestsWithBase,
    listOpenPullRequestsWithHead,
    maxPullRequestListLength,
    pullRequestShape,
    type PullRequest,
} from './pull-request-data.js';

function createTestPullRequests(count: number): ReadonlyArray<Readonly<PullRequest>> {
    return Array.from(
        {
            length: count,
        },
        (unusedEntry, index): PullRequest => {
            return {
                ...pullRequestShape.default,
                headRefName: `branch-${index}`,
                number: index,
            };
        },
    );
}

describe(escapeShellArgument.name, () => {
    it('wraps a plain branch name in quotes', () => {
        assert.strictEquals(escapeShellArgument('my-branch'), "'my-branch'");
    });

    it('neutralizes shell expansions that are legal in branch names', () => {
        assert.strictEquals(escapeShellArgument('a$(b)&c;d|e'), "'a$(b)&c;d|e'");
    });

    it('escapes embedded single quotes', () => {
        assert.strictEquals(escapeShellArgument("it's"), String.raw`'it'\''s'`);
    });
});

describe(createPullRequestListCommand.name, () => {
    it('always sets an explicit limit so that gh does not silently truncate at 30', () => {
        assert.isTrue(
            createPullRequestListCommand().includes(`--limit ${maxPullRequestListLength}`),
        );
    });

    it('only lists open PRs', () => {
        assert.isTrue(createPullRequestListCommand().includes('--state open'));
    });

    it('appends filter args', () => {
        assert.isTrue(
            createPullRequestListCommand([
                `--head ${escapeShellArgument('my-branch')}`,
            ]).endsWith("--head 'my-branch'"),
        );
    });
});

describe(assertCompletePullRequestList.name, () => {
    it('accepts a list that did not hit the limit', () => {
        assert.doesNotThrow(() =>
            assertCompletePullRequestList(createTestPullRequests(maxPullRequestListLength - 1)),
        );
    });

    it('rejects a list that hit the limit because it may be truncated', () => {
        assert.throws(() =>
            assertCompletePullRequestList(createTestPullRequests(maxPullRequestListLength)),
        );
    });
});

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

describe(listOpenPullRequestsWithHead.name, () => {
    it('only gets pull requests with the given head branch', async () => {
        const testCwd = await loadTestCwd();

        if (!testCwd) {
            return;
        }

        const allPullRequests = await listOpenPullRequests(testCwd);
        assert.isLengthAtLeast(allPullRequests, 1);
        const expectedPullRequest = allPullRequests[0];

        const output = await listOpenPullRequestsWithHead({
            cwd: testCwd,
            headRefName: expectedPullRequest.headRefName,
        });

        assert.isLengthAtLeast(output, 1);
        assert.isTrue(
            output.every(
                (pullRequest) => pullRequest.headRefName === expectedPullRequest.headRefName,
            ),
        );
        assert.isTrue(
            output.some((pullRequest) => pullRequest.number === expectedPullRequest.number),
        );
    });

    it('returns nothing for a branch with no pull request', async () => {
        const testCwd = await loadTestCwd();

        if (!testCwd) {
            return;
        }

        assert.deepEquals(
            await listOpenPullRequestsWithHead({
                cwd: testCwd,
                headRefName: 'git-vir-branch-that-does-not-exist',
            }),
            [],
        );
    });
});

describe(listOpenPullRequestsWithBase.name, () => {
    it('only gets pull requests with the given base branch', async () => {
        const testCwd = await loadTestCwd();

        if (!testCwd) {
            return;
        }

        const allPullRequests = await listOpenPullRequests(testCwd);
        assert.isLengthAtLeast(allPullRequests, 1);
        const expectedBaseRefName = allPullRequests[0].baseRefName;

        const output = await listOpenPullRequestsWithBase({
            cwd: testCwd,
            baseRefName: expectedBaseRefName,
        });

        assert.isLengthAtLeast(output, 1);
        assert.isTrue(
            output.every((pullRequest) => pullRequest.baseRefName === expectedBaseRefName),
        );
    });
});
