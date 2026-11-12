import {Logger} from "@lib/logger/logger";

export interface InformationFlowLogger extends Logger {
  logCommand: (msg: string, ...rest: unknown[]) => void;
  logEvent: (msg: string,...rest: unknown[]) => void;
  logInformation: (msg: string,...rest: unknown[]) => void;
  logAutomation: (msg: string,...rest: unknown[]) => void;
  logHotspot: (msg: string,...rest: unknown[]) => void;
  logService: (msg: string, ...rest: unknown[]) => void;
}
