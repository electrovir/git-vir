#!/usr/bin/env -S npx tsx

import {extractArgs, runCli} from './run-cli.js';

runCli(extractArgs(process.argv)).catch(() => {
    process.exit(1);
});
