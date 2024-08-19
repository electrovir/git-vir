#!/usr/bin/env -S npx tsx

import {fileURLToPath} from 'node:url';
import {extractArgs, runCli} from './run-cli.js';

runCli(extractArgs(process.argv, fileURLToPath(import.meta.url))).catch(() => {
    process.exit(1);
});
