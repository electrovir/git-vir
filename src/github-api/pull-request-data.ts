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

/** Ends the current single quoted section, emits an escaped `'`, and starts a new quoted section. */
const escapedSingleQuote = String.raw`'\''`;

/**
 * Wrap a value in single quotes so that the shell treats it as a single literal argument. Git
 * branch names are allowed to contain plenty of characters that the shell would otherwise interpret
 * (such as `$`, `&`, `;`, and `|`), so any branch name that gets interpolated into a shell command
 * must go through this first.
 */
export function escapeShellArgument(value: string): string {
    return `'${value.replaceAll("'", escapedSingleQuote)}'`;
}

/**
 * The maximum number of pull requests that will be fetched by a single `gh pr list` call. `gh pr
 * list` defaults to a limit of just 30, which silently truncates its output on any repo that has
 * more open pull requests than that, so an explicit (much higher) limit is always passed. Hitting
 * even this limit is treated as an error rather than as a complete list: see
 * {@link listPullRequests}.
 */
export const maxPullRequestListLength = 1000;

/** Build the `gh pr list` command used by all of this file's list functions. */
export function createPullRequestListCommand(
    /** Extra filter arguments to append to the `gh pr list` command. */
    filterArgs: ReadonlyArray<string> = [],
): string {
    return [
        'gh pr list',
        '--state open',
        `--limit ${maxPullRequestListLength}`,
        `--json ${githubJsonPropertiesToList.join(',')}`,
        ...filterArgs,
    ].join(' ');
}

/**
 * `gh pr list` gives no indication that it truncated its output, so a full page of results cannot
 * be distinguished from a truncated one. Refuse to treat such a list as complete rather than
 * silently operating on partial data.
 */
export function assertCompletePullRequestList(
    pullRequests: ReadonlyArray<Readonly<PullRequest>>,
): void {
    if (pullRequests.length >= maxPullRequestListLength) {
        throw new Error(
            `Got ${pullRequests.length} PRs from GitHub, which hits the max list length of ${maxPullRequestListLength}. The list of PRs may be truncated so it cannot be trusted.`,
        );
    }
}

/** Run `gh pr list` with the given extra filter arguments and parse the output. */
async function listPullRequests(
    /** The repo directory to use the GitHub CLI from within. */
    cwd: string,
    /** Extra, already-escaped arguments to append to the `gh pr list` command. */
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

/**
 * Get all currently open pull requests from GitHub from the cwd's git repo.
 *
 * Prefer the filtered {@link listOpenPullRequestsWithHead} and {@link listOpenPullRequestsWithBase}
 * when only a specific branch's pull requests are needed: they're exact and cheap no matter how
 * large the repo is.
 */
export async function listOpenPullRequests(
    /** The repo directory to use the GitHub CLI from within. */
    cwd: string,
): Promise<ReadonlyArray<Readonly<PullRequest>>> {
    return await listPullRequests(cwd, []);
}

/** Get all currently open pull requests from GitHub whose _head_ branch is the given branch. */
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

/** Get all currently open pull requests from GitHub whose _base_ branch is the given branch. */
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

    /**
     * `--head` already filters by exact branch name but a fork's pull request can share a head
     * branch name with one from the current repo, so filter again here to be safe.
     */
    const currentPullRequest: Readonly<PullRequest> | undefined = branchPullRequests.find(
        (pullRequest) => pullRequest.headRefName === currentBranchName,
    );

    return {
        currentPullRequest,
        currentBranchName,
    };
}
