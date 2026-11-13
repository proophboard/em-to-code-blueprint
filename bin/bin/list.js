#!/usr/bin/env node
import { scanDomain, getDomainPath } from './scanner.js';
import { printScanResult } from './formatter.js';
/**
 * CLI to list all commands and queries in the domain directory
 */
function main() {
    const domainPath = getDomainPath();
    const result = scanDomain(domainPath);
    printScanResult(result);
}
main();
//# sourceMappingURL=list.js.map