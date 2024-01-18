import {parseJson} from '@augment-vir/common';
import {runShellCommand} from '@augment-vir/node-js';
import {defineShape, exact} from 'object-shape-tester';

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
    },
    true,
);

/** A pull request from GitHub. */
export type PullRequest = typeof pullRequestShape.runTimeType;

const pullRequestArrayShape = defineShape([pullRequestShape], true);

const githubJsonKeys = Object.keys(pullRequestShape.defaultValue);

/** Get all current pull requests from GitHub from the cwd's git repo. */
export async function listOpenPullRequests(
    /** The repo directory to use the GitHub CLI from within. */
    cwd: string,
): Promise<ReadonlyArray<Readonly<PullRequest>>> {
    const commandResult = await runShellCommand(
        `gh pr list --state open --json ${githubJsonKeys.join(',')}`,
        {
            cwd,
        },
    );
    if (commandResult.error) {
        console.error(commandResult.stderr);
        throw new Error('Failed to list PRs from GitHub.');
    }

    const pullRequests = parseJson({
        jsonString: commandResult.stdout,
        shapeMatcher: pullRequestArrayShape.defaultValue,
    });

    return pullRequests;
}
