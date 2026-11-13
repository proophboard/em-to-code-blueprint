#!/usr/bin/env tsx
import { scanDomain, getDomainPath } from './scanner';
import { printScanResult } from './formatter';

function main() {
  const domainPath = getDomainPath();
  const result = scanDomain(domainPath);
  printScanResult(result);
}

main();
