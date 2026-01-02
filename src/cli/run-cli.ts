import {check} from '@augment-vir/assert';
import {ensureError, getEnumValues, log} from '@augment-vir/common';
import {extractRelevantArgs} from '@augment-vir/node';
import simpleGit from 'simple-git';
import {type CommandInputs} from './command-inputs.js';
import {GitVirCommandName, gitVirCommandFunctionMap} from './commands-map.js';
import {LoggedError} from './logged.error.js';

/**
 * Inputs required for the CLI to execute. When the CLI is run directly, these are automatically
 * read from command line arguments.
 */
export type CliInput = {
    command: GitVirCommandName;
    cwd: string;
    remoteName: string;
    otherArgs: string[];
};

/** Runs the git-vir CLI. */
export async function runCli({command, cwd, remoteName, otherArgs}: CliInput) {
    const git = simpleGit(cwd);
    const commandFunction = gitVirCommandFunctionMap[command];

    const commandInputs: CommandInputs = {
        cwd,
        git,
        remoteName,
        otherArgs,
    };

    try {
        await commandFunction(commandInputs);
    } catch (caught) {
        const error = ensureError(caught);
        if (!(error instanceof LoggedError)) {
            console.error(error);
            log.error(`${command} failed.`);
        }
        throw error;
    }
}

/** Extracts arguments from a raw string of CLI args. */
export function extractArgs(rawArgs: ReadonlyArray<string>, cliFilePath: string): CliInput {
    const relevantArgs = extractRelevantArgs({
        rawArgs,
        binName: 'git-vir',
        fileName: cliFilePath,
    }).reverse();

    const commandIndex = relevantArgs.findIndex((arg) => check.isEnumValue(arg, GitVirCommandName));

    const command = relevantArgs[commandIndex];

    const [remoteName] = relevantArgs.slice(commandIndex + 1);

    const otherArgs = relevantArgs.slice(0, commandIndex);

    if (!check.isEnumValue(command, GitVirCommandName)) {
        throw new Error(
            `Invalid command given. Expected one of:\n    ${getEnumValues(GitVirCommandName).join('\n    ')}`,
        );
    }
    return {
        command,
        remoteName: remoteName || 'origin',
        cwd: process.cwd(),
        otherArgs,
    };
}
