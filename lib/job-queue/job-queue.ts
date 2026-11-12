export interface JobQueue {
  scheduleJobRuns: (todoLists: string[]) => void;
}
