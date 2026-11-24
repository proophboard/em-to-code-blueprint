// Core types for the bridge module

// Board element types from prooph board API
export type BoardElementType = 'command' | 'event' | 'information' | 'automation';
export type AutomationType = 'event' | 'job';

export interface BoardElement {
  id: string;
  type: BoardElementType;
  name: string;
  description: string;
  details: string;
  icon: string;
  laneId: string;
  sliceId: string;
  index: number;
  comments: BoardComment[];
  context: string; // Falls back to "App" if not set
  chapterId: string;
  chapterName: string;
  sliceStatus?: string;
}

export interface BoardComment {
  id: string;
  userId: string;
  user: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  isTask: boolean;
  resolved?: {
    at: string;
    by: string;
  };
}

// Dependency node - source or target of a link
export interface DependencyNode {
  id: string;
  type: BoardElementType;
  name: string;
  context: string;
  chapterId: string;
  sliceId?: string;
  chapterName?: string;
}

export interface DependencyGraph {
  element: BoardElement;
  sources: DependencyNode[];
  targets: DependencyNode[];
}

// Registry snapshot - what already exists in the blueprint
export interface RegistrySnapshot {
  contexts: Set<string>;                      // PascalCase names that exist
  commands: Set<string>;                      // "Ctx.Name"
  events: Set<string>;
  queries: Set<string>;
  informationFolders: Set<string>;            // "Ctx.Name" derived from folder name
  jobs: Map<string, { todoList: string }>;    // automation FQCN -> todoList
  eventApply: Map<string, Set<string>>;       // event FQCN -> information FQCNs
  eventAutomate: Map<string, Set<string>>;    // event FQCN -> automation FQCNs
}

// Action types for planning
export type ActionKind =
  | 'context'
  | 'command'
  | 'event'
  | 'information'
  | 'prjcase'
  | 'on'
  | 'job'
  | 'known'
  | 'blocked';

export interface Action {
  kind: ActionKind;
  key: string; // e.g., "command:Crm.CreateUser" or "prjcase:Crm.UserList<-Crm.UserCreated"
  context?: string; // PascalCase context name
  name?: string; // PascalCase name (for command, event, information, blocked)
  command?: string; // for command actions
  event?: string; // for event actions
  commandName?: string; // for event actions (command name without context)
  eventName?: string; // for event actions (event name without context)
  information?: string; // for information/prjcase actions
  automation?: string; // for on/job actions
  targetContext?: string; // for cross-context links
  targetType?: 'event' | 'command' | 'information' | 'automation'; // for prjcase, on, job
  targetName?: string; // PascalCase target name
  reason?: string; // for blocked actions
  hint?: string; // for blocked actions
  eventFqcn?: string; // for prjcase/on: event FQCN
  infoFqcn?: string; // for prjcase/job: information FQCN
  autoFqcn?: string; // for on/job: automation FQCN
  files?: string[]; // generated file paths
  registryFile?: string; // registry file path
  contextNote?: boolean; // comment should carry the "context was created" note
  otherCommandSources?: string[]; // other command source FQCNs not chosen for an event
  commentTarget?: { elementId: string; chapterId: string; sliceId?: string; chapterName?: string }; // explicit comment target (counterpart elements)
}

export interface Note {
  id: string;
  elementId: string;
  message: string;
}

export interface Plan {
  actions: Action[];
  notes: Note[];
}

// Invocation config from CLI args, env, and stdin
export interface Invocation {
  chapterId?: string;
  sliceId?: string;
  endpoint: string;
  apiKey: string;
  dryRun: boolean;
  eventSourced: boolean;
  inputText?: string; // from stdin
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface BridgeDeps {
  prooph: ProophClient;
  codegen: CodegenRunner;
  registry: RegistryReader;
  logger: Logger;
}

export interface ProophClient {
  getSliceElements(chapterId: string, sliceId: string): Promise<{
    slice: { id: string; chapterId: string; label?: string };
    elements: BoardElement[];
    chapterName: string;
  }>;
  getDependencyGraph(chapterId: string, elementId: string): Promise<DependencyGraph>;
  addTaskComment(chapterId: string, elementId: string, text: string): Promise<void>;
}

export interface CodegenRunner {
  run(args: string[]): Promise<{
    ok: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
}

export interface RegistryReader {
  read(): RegistrySnapshot;
}

// Action execution result
export interface ExecutionResult {
  success: boolean;
  action: Action;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  commentPosted?: boolean;
  commentError?: string;
}
