export interface Filesystem {
  existsSync: (filename: string) => boolean;
  writeFileSync: (filename: string, content: string) => void;
  readFileSync: (filename: string, encoding: BufferEncoding) => string;
}
