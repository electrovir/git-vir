import {type CommandInputs} from './command-inputs.js';
import {convertToWorktreeCommand} from './commands/convert-to-worktree.command.js';
import {mergeCommand} from './commands/merge.command.js';
import {pushCommand} from './commands/push.command.js';

/** Available git-vir command names. To be used as the first argument to the git-vir command. */
export enum GitVirCommandName {
    Push = 'push',
    Merge = 'merge',
    ConvertToWorktree = 'convert-to-worktree',
}

/** All command functions match this type. */
export type CommandFunction = (inputs: CommandInputs) => Promise<void>;

/** Mapping of git-vir commands to their functions. */
export const gitVirCommandFunctionMap: Readonly<Record<GitVirCommandName, CommandFunction>> = {
    [GitVirCommandName.Push]: pushCommand,
    [GitVirCommandName.Merge]: mergeCommand,
    [GitVirCommandName.ConvertToWorktree]: convertToWorktreeCommand,
};
