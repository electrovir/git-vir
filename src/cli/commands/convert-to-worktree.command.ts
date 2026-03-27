import {check} from '@augment-vir/assert';
import {log} from '@augment-vir/common';
import {runShellCommand} from '@augment-vir/node';
import {cp, mkdir, mkdtemp, rename, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {getCurrentBranchName} from '../../git/branch.js';
import {type CommandInputs} from '../command-inputs.js';
import {LoggedError} from '../logged.error.js';

/** Perform the git-vir convert-to-worktree command. */
export async function convertToWorktreeCommand({
    git,
    remoteName,
}: Readonly<CommandInputs>): Promise<void> {
    /** Step 1: Find the git repo root. */
    const repoRoot = (await git.revparse(['--show-toplevel'])).trim();
    log.info(`Repo root: ${repoRoot}`);

    /** Step 2: Check if already a worktree. */
    const gitPath = join(repoRoot, '.git');
    const gitPathStat = await stat(gitPath);

    if (!gitPathStat.isDirectory()) {
        log.error('This repo is already a worktree. Nothing to do.');
        throw new LoggedError();
    }

    /** Step 3: Check for unstaged changes, uncommitted changes, unpushed commits/branches. */
    const statusResult = await git.status();

    const unstagedFiles = statusResult.files.filter(
        (file) => file.working_dir !== ' ' && file.working_dir !== '?',
    );
    const stagedFiles = statusResult.files.filter(
        (file) => file.index !== ' ' && file.index !== '?',
    );

    const branchTrackingOutput = (
        await git.raw([
            'for-each-ref',
            '--format=%(refname:short)|%(upstream:short)|%(upstream:trackshort)',
            'refs/heads/',
        ])
    ).trim();

    const issues = [
        ...(unstagedFiles.length
            ? [
                  `Unstaged changes: ${unstagedFiles.map((file) => file.path).join(', ')}`,
              ]
            : []),
        ...(stagedFiles.length
            ? [
                  `Uncommitted staged changes: ${stagedFiles.map((file) => file.path).join(', ')}`,
              ]
            : []),
        ...branchTrackingOutput
            .split('\n')
            .filter(check.isTruthy)
            .flatMap((line) => {
                const parts = line.split('|');

                if (!parts[1]) {
                    return [
                        `Unpushed branch: ${parts[0]}`,
                    ];
                }
                if (parts[2]?.includes('>')) {
                    return [
                        `Unpushed commits on branch: ${parts[0]}`,
                    ];
                }
                return [];
            }),
    ];

    if (issues.length) {
        issues.forEach((issue) => log.error(issue));
        log.error('Resolve the above issues before converting to a worktree.');
        throw new LoggedError();
    }

    /** Gather info needed after the move. */
    const currentBranchName = await getCurrentBranchName(git);

    if (!currentBranchName) {
        log.error('Could not determine the current branch.');
        throw new LoggedError();
    }

    const remoteUrl = (
        await git.remote([
            'get-url',
            remoteName,
        ])
    )?.trim();

    if (!remoteUrl) {
        log.error(`Could not get URL for remote '${remoteName}'.`);
        throw new LoggedError();
    }

    /** Step 4: Create a temp directory. */
    const tempDir = await mkdtemp(join(tmpdir(), 'git-vir-'));
    const tempRepoPath = join(tempDir, basename(repoRoot));
    log.faint(`Temp directory: ${tempDir}`);

    /** Step 5: Move the repo into the temp directory. */
    log.faint(`Moving repo to ${tempRepoPath}`);
    try {
        await rename(repoRoot, tempRepoPath);
    } catch {
        /** Falls back to copy + remove when rename fails (e.g. cross-filesystem). */
        await cp(repoRoot, tempRepoPath, {
            recursive: true,
        });
        await rm(repoRoot, {
            recursive: true,
        });
    }

    /** Step 6: Recreate the original folder. */
    await mkdir(repoRoot);

    /** Step 7: Clone bare repo. */
    log.faint(`Cloning bare repo from ${remoteUrl}`);
    await runShellCommand(`git clone --bare --filter=blob:none '${remoteUrl}'`, {
        cwd: repoRoot,
        hookUpToConsole: true,
        rejectOnError: true,
    });

    /** Step 8-9: Configure the bare repo. */
    const bareRepoDir = join(repoRoot, `${basename(remoteUrl, '.git')}.git`);
    log.faint('Configuring bare repo...');
    await runShellCommand('git config fetch.prune true', {
        cwd: bareRepoDir,
        hookUpToConsole: true,
        rejectOnError: true,
    });
    await runShellCommand("git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'", {
        cwd: bareRepoDir,
        hookUpToConsole: true,
        rejectOnError: true,
    });

    /** Step 10: Create branch folder next to the bare repo. */
    const branchDir = join(repoRoot, currentBranchName);
    await mkdir(branchDir, {recursive: true});

    /** Step 11: Copy working files from temp repo, excluding .git. */
    log.faint(`Copying working files to ${branchDir}`);
    const gitDirInTemp = join(tempRepoPath, '.git');
    await cp(tempRepoPath, branchDir, {
        recursive: true,
        filter: (source) => source !== gitDirInTemp,
    });

    log.info(`Converted to worktree layout at ${repoRoot}`);
    log.info(`  Bare repo:        ${bareRepoDir}`);
    log.info(`  Working tree:     ${branchDir}`);
    log.info(`  Copy of original: ${tempRepoPath}`);
}
