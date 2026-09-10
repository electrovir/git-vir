import {awaitedForEach, log} from '@augment-vir/common';
import {runShellCommand} from '@augment-vir/node';
import {type SimpleGit} from 'simple-git';
import {LoggedError} from '../cli/logged.error.js';
import {
    checkout,
    doesBranchExistLocally,
    doesLocalBranchMatchRemote,
    fetchBranch,
    forcePush,
    rebaseOnto,
} from '../git/branch.js';
import {listOpenPullRequestsWithBase, type PullRequest} from './pull-request-data.js';

export async function updateStackedPullRequest({
    cwd,
    git,
    parentPullRequest,
    remoteName,
    isPostMerge,
}: {
    cwd: string;
    git: SimpleGit;
    parentPullRequest: Readonly<PullRequest>;
    remoteName: string;
    /**
     * Set to true only if the parent pull request has just been merged (rather than just been
     * updated). This indicates that any chained pull requests should rebase on that parent pull
     * request's _base_ branch rather than its _head_.
     */
    isPostMerge: boolean;
}): Promise<number> {
    const originalParentRef = parentPullRequest.headRefOid;

    /** Must run before the rebases below, while each child's `headRefOid` is still pre-rebase. */
    const childPullRequests = await listOpenPullRequestsWithBase({
        cwd,
        baseRefName: parentPullRequest.headRefName,
    });
    if (!childPullRequests.length) {
        return 0;
    }

    log.faint(`${childPullRequests.length} child PRs detected.`);

    let updatedChildCount = childPullRequests.length;

    await awaitedForEach(childPullRequests, async (childPullRequest) => {
        const childBranchName = childPullRequest.headRefName;
        log.info(`Updating ${childBranchName}...`);
        await fetchBranch(git, {
            branchName: childBranchName,
            remoteName,
        });
        if (
            (await doesBranchExistLocally(
                git,
                childBranchName,
            )) /** Verify that local branch matches remote branch, or abort. */ &&
            !(await doesLocalBranchMatchRemote({
                git,
                branchName: childBranchName,
                remote: remoteName,
            }))
        ) {
            log.error(
                `Cannot update branch '${childBranchName}'.\nLocal branch does not match remote branch on '${remoteName}'.`,
            );
            throw new LoggedError();
        }

        if (isPostMerge) {
            await fetchBranch(git, {
                branchName: parentPullRequest.baseRefName,
                remoteName,
            });
        }

        await checkout(git, childPullRequest.headRefName);
        await rebaseOnto(
            git,
            isPostMerge
                ? {
                      newRef: [
                          remoteName,
                          parentPullRequest.baseRefName,
                      ].join('/'),
                      oldRef: originalParentRef,
                  }
                : {
                      newRef: parentPullRequest.headRefName,
                      oldRef: originalParentRef,
                  },
        );
        await forcePush(git);
        log.faint(`${childBranchName} updated.`);

        updatedChildCount += await updateStackedPullRequest({
            cwd,
            git,
            parentPullRequest: childPullRequest,
            remoteName,
            /** Only the first update should ever use the base ref. Recursive calls never will. */
            isPostMerge: false,
        });
    });

    return updatedChildCount;
}

export async function mergeCurrentPullRequest({
    cwd,
    pullRequestUrl,
    otherArgs,
}: {
    cwd: string;
    pullRequestUrl: string;
    otherArgs: ReadonlyArray<string>;
}) {
    const commandString = [
        'gh pr merge',
        ...otherArgs,
    ].join(' ');

    const commandResult = await runShellCommand(commandString, {
        cwd,
    });

    if (commandResult.error) {
        if (
            commandResult.stderr.includes(
                'is not mergeable: the base branch policy prohibits the merge',
            )
        ) {
            throw new Error(`Merge checks prevent merging. See ${pullRequestUrl} for details.`);
        } else {
            throw new Error(commandResult.stderr);
        }
    }
}
