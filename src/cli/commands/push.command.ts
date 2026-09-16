import {log} from '@augment-vir/common';
import {checkout, forcePush} from '../../git/branch.js';
import {getCurrentBranchPullRequest} from '../../github-api/pull-request-data.js';
import {updateStackedPullRequest} from '../../github-api/pull-request-updates.js';
import {type CommandInputs} from '../command-inputs.js';

/** Perform the git-vir push command. */
export async function pushCommand({cwd, git, remoteName}: CommandInputs): Promise<void> {
    const {currentPullRequest, currentBranchName} = await getCurrentBranchPullRequest(cwd, git);

    if (!currentPullRequest) {
        log.info(
            `No pull request found for branch '${currentBranchName}'. Performing a force push only.`,
        );
        await forcePush(git);
        return;
    }
    log.faint('Pushing current branch...');
    await forcePush(git);

    log.faint('starting stacked diff update.');
    log.mutate('Do not run any git commands or modify any files.');

    await updateStackedPullRequest({
        cwd,
        git,
        parentPullRequest: currentPullRequest,
        remoteName,
        isPostMerge: false,
    });

    /** Go back to the original branch after it's all done. */
    await checkout(git, currentBranchName);
}
