export type Todo = {
  readonly todoId: string;
  readonly title: string;
  readonly owner: string;
  readonly status: 'open' | 'done';
  readonly deadline?: Date;
}
