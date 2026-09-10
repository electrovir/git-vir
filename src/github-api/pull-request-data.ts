import {runShellCommand} from '@augment-vir/node';
import {defineShape, exactShape, parseJsonWithShape} from 'object-shape-tester';
import {type SimpleGit} from 'simple-git';
import {getCurrentBranchName} from '../git/branch.js';

/** Shape for pull request data retrieved from GitHub. */
export const pullRequestShape = defineShape({
    /** The name of the branch that the pull request is merging into. */
    baseRefName: '',
    /** The name of the branch that is getting merged into another branch. */
    headRefName: '',
    /** Hidden ID string for the pull request. */
    id: '',
    title: '',
    isDraft: false,
    /** Issue / pull request number. */
    number: 0,
    /** SHA of the HEAD commit of the pull request. */
    headRefOid: '',
    state: exactShape('OPEN'),
    url: '',
});

/** A pull request from GitHub. */
export type PullRequest = typeof pullRequestShape.runtimeType;

const pullRequestArrayShape = defineShape([pullRequestShape]);

const githubJsonPropertiesToList = Object.keys(pullRequestShape.default);

/** Finds a pull request on GitHub by its PR name. If no PR is found, an error is thrown. */
export async function getPullRequestByNumber(
    cwd: string,
    prNumber: number,
): Promise<Readonly<PullRequest>> {
    const commandResult = await runShellCommand(
        `gh pr view ${prNumber} --json ${githubJsonPropertiesToList.join(',')}`,
        {
            cwd,
        },
    );
    if (commandResult.error) {
        console.error(commandResult.stderr);
        throw new Error(`Failed to find PR '${prNumber}' from GitHub.`);
    }

    return parseJsonWithShape(commandResult.stdout, pullRequestShape);
}

/** Closes the current quote, emits an escaped `'`, then reopens the quote. */
const escapedSingleQuote = String.raw`'\''`;

/** Quote a value for the shell. Branch names may contain `$`, `&`, `;`, and other shell syntax. */
export function escapeShellArgument(value: string): string {
    return `'${value.replaceAll("'", escapedSingleQuote)}'`;
}

/** Explicit `--limit` for `gh pr list`, which otherwise caps its output at 30. */
export const maxPullRequestListLength = 1000;

/** Build the `gh pr list` command shared by the list functions below. */
export function createPullRequestListCommand(filterArgs: ReadonlyArray<string> = []): string {
    return [
        'gh pr list',
        '--state open',
        `--limit ${maxPullRequestListLength}`,
        `--json ${githubJsonPropertiesToList.join(',')}`,
        ...filterArgs,
    ].join(' ');
}

/** Throws if the list may be truncated. `gh` gives no truncation signal of its own. */
export function assertCompletePullRequestList(
    pullRequests: ReadonlyArray<Readonly<PullRequest>>,
): void {
    if (pullRequests.length >= maxPullRequestListLength) {
        throw new Error(
            `Hit the max PR list length (${maxPullRequestListLength}). The PR list may be truncated.`,
        );
    }
}

/** Filter args must already be escaped. */
async function listPullRequests(
    cwd: string,
    filterArgs: ReadonlyArray<string>,
): Promise<ReadonlyArray<Readonly<PullRequest>>> {
    const commandResult = await runShellCommand(createPullRequestListCommand(filterArgs), {
        cwd,
    });
    if (commandResult.error) {
        console.error(commandResult.stderr);
        throw new Error('Failed to list PRs from GitHub.');
    }

    const pullRequests = parseJsonWithShape(commandResult.stdout, pullRequestArrayShape);

    assertCompletePullRequestList(pullRequests);

    return pullRequests;
}

/** Get all current pull requests from GitHub from the cwd's git repo. */
export async function listOpenPullRequests(
    /** The repo directory to use the GitHub CLI from within. */
    cwd: string,
): Promise<ReadonlyArray<Readonly<PullRequest>>> {
    return await listPullRequests(cwd, []);
}

/** Get open pull requests from GitHub with the given head branch. */
export async function listOpenPullRequestsWithHead({
    cwd,
    headRefName,
}: {
    /** The repo directory to use the GitHub CLI from within. */
    cwd: string;
    headRefName: string;
}): Promise<ReadonlyArray<Readonly<PullRequest>>> {
    return await listPullRequests(cwd, [
        `--head ${escapeShellArgument(headRefName)}`,
    ]);
}

/** Get open pull requests from GitHub with the given base branch. */
export async function listOpenPullRequestsWithBase({
    cwd,
    baseRefName,
}: {
    /** The repo directory to use the GitHub CLI from within. */
    cwd: string;
    baseRefName: string;
}): Promise<ReadonlyArray<Readonly<PullRequest>>> {
    return await listPullRequests(cwd, [
        `--base ${escapeShellArgument(baseRefName)}`,
    ]);
}

/** Gets a currently open pull request from GitHub that is using the current git branch. */
export async function getCurrentBranchPullRequest(cwd: string, git: Readonly<SimpleGit>) {
    const currentBranchName = await getCurrentBranchName(git);

    if (!currentBranchName) {
        throw new Error('You are not currently on a branch.');
    }

    const branchPullRequests = await listOpenPullRequestsWithHead({
        cwd,
        headRefName: currentBranchName,
    });

    /** `--head` is not repo scoped: a fork's PR can use the same branch name. */
    const currentPullRequest: Readonly<PullRequest> | undefined = branchPullRequests.find(
        (pullRequest) => pullRequest.headRefName === currentBranchName,
    );

    return {
        currentPullRequest,
        currentBranchName,
    };
}
