import {InformationFlowLogger} from "@lib/information-flow-logger/information-flow-logger";

const palette = {
  cColor: (color: string) => `color: ${color};background-color: #3b3b3b;padding: 5px;`,
  cColorBold: (color: string) => `color: ${color};font-weight: bold;background-color: #3b3b3b;padding: 5px`,
  common: {
    grey: '#919191',
  },
  stickyColors: {
    event: '#FF9F4B',
    command: '#26C0E7',
    information: '#73dd8e',
    automation: '#EABFF1',
    hotspot: '#f31d30',
    service: '#ec98ac',
  }
};

export class ConsoleLogger implements InformationFlowLogger {
  private prefix: string;


  constructor(prefix: string) {
    this.prefix = prefix;
  }

  logCommand = (msg: string,...rest: unknown[]) => {
    console.log(`%c[${this.prefix}] ${msg}`, palette.cColor(palette.stickyColors.command), ...rest);
  }

  logEvent = (msg: string,...rest: unknown[]) => {
    console.log(`%c[${this.prefix}] ${msg}`, palette.cColor(palette.stickyColors.event), ...rest);
  }

  logInformation = (msg: string,...rest: unknown[]) => {
    console.log(`%c[${this.prefix}] ${msg}`, palette.cColor(palette.stickyColors.information), ...rest);
  }

  logAutomation = (msg: string,...rest: unknown[]) => {
    console.log(`%c[${this.prefix}] ${msg}`, palette.cColor(palette.stickyColors.automation), ...rest);
  }

  logHotspot = (msg: string,...rest: unknown[]) => {
    console.log(`%c[${this.prefix}] ${msg}`, palette.cColor(palette.stickyColors.hotspot), ...rest);
  }

  logService = (msg: string,...rest: unknown[]) => {
    console.log(`%c[${this.prefix}] ${msg}`, palette.cColor(palette.stickyColors.service), ...rest);
  }

  log = (...rest: unknown[]) => {
    console.log(`[${this.prefix}] `, ...rest);
  }

  error = (...rest: unknown[]) => {
    console.error(`[${this.prefix}] `,...rest);
  }

  warn = (...rest: unknown[]) => {
    console.warn(`[${this.prefix}] `,...rest);
  }
}
