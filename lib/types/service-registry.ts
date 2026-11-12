export type ServiceRegistry = {
  get: <T>(name: string) => T;
  set: <T>(name: string, service: T) => void;
};
