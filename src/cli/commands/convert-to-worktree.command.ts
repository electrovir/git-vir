import {log} from '@augment-vir/common';
import {runShellCommand} from '@augment-vir/node';
import {existsSync} from 'node:fs';
import {cp, mkdir, mkdtemp, rename, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {getCurrentBranchName} from '../../git/branch.js';
import {type CommandInputs} from '../command-inputs.js';
import {LoggedError} from '../logged.error.js';

async function movePathWithFallback({
    source,
    destination,
}: Readonly<{source: string; destination: string}>): Promise<void> {
    try {
        await rename(source, destination);
    } catch {
        /** Falls back to copy + remove when rename fails (e.g. cross-filesystem). */
        await cp(source, destination, {
            recursive: true,
            verbatimSymlinks: true,
        });
        await rm(source, {
            recursive: true,
        });
    }
}

/** Perform the git-vir convert-to-worktree command. */
export async function convertToWorktreeCommand({
    git,
    remoteName,
}: Readonly<CommandInputs>): Promise<void> {
    /** Step 1: Find the git repo root. */
    const repoRoot = (await git.revparse(['--show-toplevel'])).trim();
    log.faint(`Repo root: ${repoRoot}`);

    /** Step 2: Check if already a worktree. */
    const gitPath = join(repoRoot, '.git');
    const gitPathStat = await stat(gitPath);

    if (!gitPathStat.isDirectory()) {
        log.error('This repo is already a worktree. Nothing to do.');
        throw new LoggedError();
    }

    /** Step 3: Check if the repo has existing worktrees attached. */
    const worktreeListOutput = (
        await git.raw([
            'worktree',
            'list',
            '--porcelain',
        ])
    ).trim();
    const worktreeCount = worktreeListOutput
        .split('\n')
        .filter((line) => line.startsWith('worktree ')).length;

    if (worktreeCount > 1) {
        log.error(
            'This repo has other worktrees attached. Remove them with `git worktree remove` before converting.',
        );
        throw new LoggedError();
    }

    const currentBranchName = await getCurrentBranchName(git);

    if (!currentBranchName) {
        log.error('Could not determine the current branch.');
        throw new LoggedError();
    }

    /** Step 4: Create a temp directory. */
    const tempDir = await mkdtemp(join(tmpdir(), 'git-vir-'));
    const tempRepoPath = join(tempDir, basename(repoRoot));
    log.faint(`Temp directory: ${tempDir}`);

    /** Step 5: Move the repo into the temp directory. */
    log.faint(`Moving repo to ${tempRepoPath}`);
    await movePathWithFallback({
        source: repoRoot,
        destination: tempRepoPath,
    });

    /** Step 6: Recreate the original folder. */
    await mkdir(repoRoot);

    /** Step 7: Move the existing .git directory to become the bare repo. */
    const bareRepoDir = join(repoRoot, `${basename(repoRoot)}.git`);
    log.faint(`Converting .git to bare repo at ${bareRepoDir}`);
    await movePathWithFallback({
        source: join(tempRepoPath, '.git'),
        destination: bareRepoDir,
    });

    /** Step 8: Configure the bare repo. */
    log.faint('Configuring bare repo...');
    await runShellCommand('git config core.bare true', {
        cwd: bareRepoDir,
        hookUpToConsole: true,
        rejectOnError: true,
    });
    await runShellCommand('git config fetch.prune true', {
        cwd: bareRepoDir,
        hookUpToConsole: true,
        rejectOnError: true,
    });
    await runShellCommand(
        `git config remote.${remoteName}.fetch '+refs/heads/*:refs/remotes/${remoteName}/*'`,
        {
            cwd: bareRepoDir,
            hookUpToConsole: true,
            rejectOnError: true,
        },
    );

    /** Step 9: Create branch folder and copy working files. */
    const branchDir = join(repoRoot, currentBranchName);
    await mkdir(branchDir, {
        recursive: true,
    });

    log.faint(`Copying working files to ${branchDir}`);
    await cp(tempRepoPath, branchDir, {
        recursive: true,
        verbatimSymlinks: true,
    });

    /** Step 10: Set up worktree metadata so the branch folder is a registered git worktree. */
    const worktreeMetaDir = join(bareRepoDir, 'worktrees', currentBranchName);
    await mkdir(worktreeMetaDir, {
        recursive: true,
    });

    const originalIndex = join(bareRepoDir, 'index');

    if (existsSync(originalIndex)) {
        /** Move the index to preserve staged changes. */
        await movePathWithFallback({
            source: originalIndex,
            destination: join(worktreeMetaDir, 'index'),
        });
    }

    /** Write commondir so git can find the shared bare repo objects/refs. */
    await writeFile(join(worktreeMetaDir, 'commondir'), '../..\n');

    /** Write HEAD for the worktree. */
    await writeFile(join(worktreeMetaDir, 'HEAD'), `ref: refs/heads/${currentBranchName}\n`);

    /** Write gitdir pointing from the worktree metadata back to the working directory. */
    await writeFile(join(worktreeMetaDir, 'gitdir'), `${branchDir}/.git\n`);

    /** Write .git file in the branch directory pointing to the worktree metadata. */
    await writeFile(join(branchDir, '.git'), `gitdir: ${worktreeMetaDir}\n`);

    log.faint(`Converted to worktree layout at ${repoRoot}`);
    log.faint(`  Bare repo:        ${bareRepoDir}`);
    log.faint(`  Working tree:     ${branchDir}`);
    log.faint(`  Copy of original: ${tempRepoPath}`);

    log.info(`\n\ncd to your new worktree at: ${branchDir}\n\n`);
}
