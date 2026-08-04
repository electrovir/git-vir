# git-vir

CLI tool for making life with git and GitHub easier.

Requires the GitHub CLI to be installed and authenticated.

# How to setup

1. Install GitHub CLI: https://github.com/cli/cli#installation
2. Authenticate GitHub CLI: `gh auth login`
3. Install this package (probably globally): `npm i -g git-vir`

# How to use

## Push

Use this instead of `git push` when you have a chain of several PRs that are targeting each other and they all need to be updated after the base PR is updated.

1. Start with the base-most branch (the branch closest to your main dev branch) that needs to be updated.
2. Make the necessary changes to that branch (rebase, commit amend, etc.).
3. Run `git-vir push`.
    - If you use a remote name besides `origin`, you can provide that as well with `git-vir <remote-name-here> push`.
    - If you encounter merge conflicts, resolve them as you would for a normal `git rebase` command. Then, run `git-vir push` to resume updating the chain.
4. Don't do anything else in the repo's directory until the command is finished.
    - The git-vir command will checkout and push all dependent branches, recursively.
    - If you do anything with the repo while this is happening, it'll likely break this process, including pushing changes to incorrect branches.

## Merge

Use this on a branch that has a chained PR which is ready for merge. It will merge the branch's PR and then rebase all chained branches.

Make sure to include a merge type: `--squash`, `--rebase`, or `--merge`. Like this:

```sh
git-vir merge --squash
```

If you use a remote name besides `origin`, you can provide that as well with `git-vir <remote-name-here> merge --squash`.

## Convert to Worktree

Converts a standard git repository into a [git worktree](https://git-scm.com/docs/git-worktree) layout with a bare repository and a branch-specific working directory.

```sh
git-vir convert-to-worktree
```

This is useful when you want to work on multiple branches simultaneously in separate directories without having to stash or commit in-progress work.

### What it does

Given a repo at `~/repos/my-repo` on branch `main`, running `git-vir convert-to-worktree` produces:

```
~/repos/my-repo/
├── my-repo.git/    # bare repository
└── main/           # working tree for the current branch
```

A backup copy of the original repo is saved to a temp directory (printed during execution).

After conversion, add new worktrees with standard git commands from within any existing worktree:

```sh
git worktree add ../new-branch
```

### Restrictions

-   The repo must not already be a worktree.
-   The repo must not have any other worktrees attached. Remove them first with `git worktree remove`.
