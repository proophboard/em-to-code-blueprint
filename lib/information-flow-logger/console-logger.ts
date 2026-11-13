import {InformationFlowLogger} from "@lib/information-flow-logger/information-flow-logger";

const ANSI = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  // Foreground colors
  orange: "\x1b[38;5;208m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  pink: "\x1b[38;5;218m",
};

const stickyColors = {
  event: ANSI.orange,
  command: ANSI.cyan,
  information: ANSI.green,
  automation: ANSI.magenta,
  hotspot: ANSI.red,
  service: ANSI.pink,
};

export class ConsoleLogger implements InformationFlowLogger {
  private prefix: string;
  private verbose: boolean;

  constructor(prefix: string, verbose = true) {
    this.prefix = prefix;
    this.verbose = verbose;
  }

  logCommand = (msg: string, ...rest: unknown[]) => {
    if(!this.verbose) return;
    console.log(`${ANSI.cyan}[${this.prefix}] ${msg}`, ...rest, `${ANSI.reset}`);
  };

  logEvent = (msg: string, ...rest: unknown[]) => {
    if(!this.verbose) return;
    console.log(`${ANSI.orange}[${this.prefix}] ${msg}`, ...rest, `${ANSI.reset}`);
  };

  logInformation = (msg: string, ...rest: unknown[]) => {
    if(!this.verbose) return;
    console.log(`${ANSI.green}[${this.prefix}] ${msg}`, ...rest, `${ANSI.reset}`);
  };

  logAutomation = (msg: string, ...rest: unknown[]) => {
    if(!this.verbose) return;
    console.log(`${ANSI.magenta}[${this.prefix}] ${msg}`, ...rest, `${ANSI.reset}`);
  };

  logHotspot = (msg: string, ...rest: unknown[]) => {
    if(!this.verbose) return;
    console.log(`${ANSI.red}[${this.prefix}] ${msg}`, ...rest, `${ANSI.reset}`);
  };

  logService = (msg: string, ...rest: unknown[]) => {
    if(!this.verbose) return;
    console.log(`${ANSI.pink}[${this.prefix}] ${msg}`, ...rest, `${ANSI.reset}`);
  };

  log = (...rest: unknown[]) => {
    console.log(`[${this.prefix}] `, ...rest);
  };

  error = (...rest: unknown[]) => {
    console.error(`[${this.prefix}] `, ...rest);
  };

  warn = (...rest: unknown[]) => {
    console.warn(`[${this.prefix}] `, ...rest);
  };
}
