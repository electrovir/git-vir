import {ensureError, getEnumTypedValues, isEnumValue} from '@augment-vir/common';
import {log} from '@augment-vir/node-js';
import {extractRelevantArgs} from 'cli-args-vir';
import simpleGit from 'simple-git';
import {CommandInputs} from './command-inputs.js';
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
export function extractArgs(rawArgs: ReadonlyArray<string>): CliInput {
    const relevantArgs = extractRelevantArgs({
        rawArgs,
        binName: 'git-vir',
        fileName: import.meta.filename,
    }).reverse();

    const commandIndex = relevantArgs.findIndex((arg) => isEnumValue(arg, GitVirCommandName));

    const command = relevantArgs[commandIndex];

    const [remoteName] = relevantArgs.slice(commandIndex + 1);

    const otherArgs = relevantArgs.slice(0, commandIndex);

    if (!isEnumValue(command, GitVirCommandName)) {
        throw new Error(
            `Invalid command given. Expected one of:\n    ${getEnumTypedValues(GitVirCommandName).join('\n    ')}`,
        );
    }
    return {
        command,
        remoteName: remoteName || 'origin',
        cwd: process.cwd(),
        otherArgs,
    };
}
