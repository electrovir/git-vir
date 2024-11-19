import {check} from '@augment-vir/assert';
import {log} from '@augment-vir/common';
import {SimpleGit} from 'simple-git';
import {LoggedError} from '../cli/logged.error.js';

/** Get the current branch name. */
export async function getCurrentBranchName(git: SimpleGit): Promise<string | undefined> {
    const branchName = (
        await git.raw([
            'branch',
            '--show-current',
        ])
    ).trim();

    return branchName || undefined;
}

/** Force push the current branch. */
export async function forcePush(git: SimpleGit): Promise<void> {
    log.faint('> git push --force-with-lease');
    await git.push([
        '--force-with-lease',
    ]);
}

/** Checkout a new branch locally. Does not fetch the branch from the remote. */
export async function checkout(git: SimpleGit, branchName: string): Promise<void> {
    log.faint(`> git checkout ${branchName}`);
    await git.raw([
        'checkout',
        branchName,
    ]);
}

/** Fetch a branch from remote. */
export async function fetchBranch(
    git: SimpleGit,
    {
        remoteName,
        branchName,
    }: {
        remoteName: string;
        branchName: string;
    },
): Promise<void> {
    log.faint(`> git fetch ${remoteName} ${branchName}`);
    await git.fetch(remoteName, branchName);
}

async function getBranchCommit(
    git: Readonly<SimpleGit>,
    branchName: string,
    remote?: string | undefined,
): Promise<string> {
    const ref = [
        remote,
        branchName,
    ]
        .filter(check.isTruthy)
        .join('/');

    return (await git.revparse(ref)).trim();
}

/** Checks if the local copy of a branch matches its remote copy. */
export async function doesLocalBranchMatchRemote(
    git: Readonly<SimpleGit>,
    branchName: string,
    remote: string,
) {
    const localCommit = await getBranchCommit(git, branchName);
    const remoteCommit = await getBranchCommit(git, branchName, remote);

    return localCommit === remoteCommit;
}

/**
 * Check if a branch exists locally or not. This does not count branches that have been fetched from
 * remote but have never been checked out from remote.
 */
export async function doesBranchExistLocally(git: SimpleGit, branchName: string): Promise<boolean> {
    const output = (
        await git.raw([
            'show-ref',
            '--quiet',
            `refs/heads/${branchName}`,
        ])
    ).trim();
    return !!output;
}

/** Perform a `git rebase --onto` command. */
export async function rebaseOnto(
    git: SimpleGit,
    {oldRef, newRef}: {oldRef: string; newRef: string},
): Promise<void> {
    try {
        log.faint(`> git rebase --onto ${newRef} ${oldRef}`);
        await git.rebase([
            '--onto',
            newRef,
            oldRef,
        ]);
    } catch {
        log.error(
            `'git rebase' failed.\nResolve conflicts like normal (using 'git rebase --continue') and then run 'git-vir push' to resume.`,
        );
        throw new LoggedError();
    }
}
