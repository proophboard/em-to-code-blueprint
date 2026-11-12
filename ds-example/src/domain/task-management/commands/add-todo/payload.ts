export type Payload = {
  readonly todoId: string;
  readonly title: string;
  readonly owner: string;
  readonly deadline?: Date;
};
