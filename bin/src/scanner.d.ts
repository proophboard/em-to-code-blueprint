export interface DomainContext {
    name: string;
    commands: string[];
    queries: string[];
}
export interface ScanResult {
    [context: string]: {
        commands: string[];
        queries: string[];
    };
}
/**
 * Scans domain directory for contexts with commands.ts and queries.ts
 */
export declare function scanDomain(domainPath: string): ScanResult;
/**
 * Gets the domain path relative to the current working directory
 */
export declare function getDomainPath(projectRoot?: string): string;
//# sourceMappingURL=scanner.d.ts.map