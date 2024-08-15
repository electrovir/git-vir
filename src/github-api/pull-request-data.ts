import {runShellCommand} from '@augment-vir/node-js';
import {defineShape, exact} from 'object-shape-tester';
import {SimpleGit} from 'simple-git';
import {parseJsonWithShape} from '../augments/json.js';
import {getCurrentBranchName} from '../git/branch.js';

/** Shape for pull request data retrieved from GitHub. */
export const pullRequestShape = defineShape(
    {
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
        state: exact('OPEN'),
        url: '',
    },
    true,
);

/** A pull request from GitHub. */
export type PullRequest = typeof pullRequestShape.runTimeType;

const pullRequestArrayShape = defineShape([pullRequestShape], true);

const githubJsonPropertiesToList = Object.keys(pullRequestShape.defaultValue);

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

/** Get all current pull requests from GitHub from the cwd's git repo. */
export async function listOpenPullRequests(
    /** The repo directory to use the GitHub CLI from within. */
    cwd: string,
): Promise<ReadonlyArray<Readonly<PullRequest>>> {
    const commandResult = await runShellCommand(
        `gh pr list --state open --json ${githubJsonPropertiesToList.join(',')}`,
        {
            cwd,
        },
    );
    if (commandResult.error) {
        console.error(commandResult.stderr);
        throw new Error('Failed to list PRs from GitHub.');
    }

    return parseJsonWithShape(commandResult.stdout, pullRequestArrayShape);
}

/** Gets a currently open pull request from GitHub that is using the current git branch. */
export async function getCurrentBranchPullRequest(cwd: string, git: Readonly<SimpleGit>) {
    const currentBranchName = await getCurrentBranchName(git);

    if (!currentBranchName) {
        throw new Error('You are not currently on a branch.');
    }

    const openPullRequests = await listOpenPullRequests(cwd);

    const currentPullRequest: Readonly<PullRequest> | undefined = openPullRequests.find(
        (pullRequest) => pullRequest.headRefName === currentBranchName,
    );

    return {
        currentPullRequest,
        openPullRequests,
        currentBranchName,
    };
}
