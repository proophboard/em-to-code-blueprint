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

  readFileSync(filename: string, encoding: BufferEncoding): string {
    throw new Error('Read from filesystem not supported');
  }
}
