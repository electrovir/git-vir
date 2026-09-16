import {log} from '@augment-vir/common';
import {checkout} from '../../git/branch.js';
import {getCurrentBranchPullRequest} from '../../github-api/pull-request-data.js';
import {
    mergeCurrentPullRequest,
    updateStackedPullRequest,
} from '../../github-api/pull-request-updates.js';
import {type CommandInputs} from '../command-inputs.js';

/** Perform the git-vir push command. */
export async function mergeCommand({
    cwd,
    git,
    remoteName,
    otherArgs,
}: Readonly<CommandInputs>): Promise<void> {
    const {currentPullRequest, currentBranchName} = await getCurrentBranchPullRequest(cwd, git);

    if (!currentPullRequest) {
        throw new Error(
            `Cannot merge: no pull request found for current branch: ${currentBranchName}.`,
        );
    }

    log.faint(`Merging PR #${currentPullRequest.number}...`);
    await mergeCurrentPullRequest({
        cwd,
        pullRequestUrl: currentPullRequest.url,
        otherArgs,
    });

    log.faint('Starting stacked diff update.');
    log.mutate('Do not run any git commands or modify any files.');

    await updateStackedPullRequest({
        cwd,
        git,
        parentPullRequest: currentPullRequest,
        remoteName,
        isPostMerge: true,
    });

    /** Go back to the original branch after it's all done. */
    await checkout(git, currentBranchName);
}
