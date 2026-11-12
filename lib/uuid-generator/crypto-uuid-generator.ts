import {UuidGenerator} from "@lib/uuid-generator/uuid-generator";

export class CryptoUuidGenerator implements UuidGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}


let generator: UuidGenerator;

export const uuid = (): UuidGenerator => {
  if(!generator) {
    generator = new CryptoUuidGenerator();
  }

  return generator;
}
