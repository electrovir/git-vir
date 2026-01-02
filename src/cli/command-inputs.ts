import {type SimpleGit} from 'simple-git';

/** Inputs that each git-vir command requires. */
export type CommandInputs = {
    cwd: string;
    git: SimpleGit;
    remoteName: string;
    otherArgs: ReadonlyArray<string>;
};
