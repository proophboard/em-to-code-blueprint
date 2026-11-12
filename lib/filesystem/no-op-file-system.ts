import {Filesystem} from "./fs";

export class NoOpFilesystem implements Filesystem {
  constructor() {

  }

  existsSync(filename: string): boolean {
    return false;
  }

  writeFileSync(filename: string, content: string): void {
    throw new Error('Write to filesystem not supported');
  }
}
