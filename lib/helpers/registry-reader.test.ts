import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import {readFileSync, mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync} from 'fs';
import {join, resolve, dirname} from 'path';
import {tmpdir} from 'os';
import {fileURLToPath} from 'url';
import {randomUUID} from 'crypto';
import {
  readRegistrySnapshot,
  toKebab,
  parseJobAutomations,
  RegistrySnapshot
} from './registry-reader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test fixtures for registry files
const fixtures = {
  emptyCommands: `import {CommandRegistry} from "@lib/types/command-registry";

export const commands: CommandRegistry = {
};`,
  singleCommand: `import {CommandRegistry} from "@lib/types/command-registry";
import prepareAddTodo from "./commands/add-todo/prepare";
import handleAddTodo from "./commands/add-todo/handle";

export const commands: CommandRegistry = {
  "TaskManagement.AddTodo": {
    prepare: prepareAddTodo,
    exec: handleAddTodo
  },
};`,
  twoCommands: `import {CommandRegistry} from "@lib/types/command-registry";
import prepareAddTodo from "./commands/add-todo/prepare";
import handleAddTodo from "./commands/add-todo/handle";
import prepareUpdateTodo from "./commands/update-todo/prepare";
import handleUpdateTodo from "./commands/update-todo/handle";

export const commands: CommandRegistry = {
  "TaskManagement.AddTodo": {
    prepare: prepareAddTodo,
    exec: handleAddTodo
  },
  "TaskManagement.UpdateTodo": {
    prepare: prepareUpdateTodo,
    exec: handleUpdateTodo
  },
};`,
  emptyQueries: `import {QueryRegistry} from "@lib/types/query-registry";

export const queries: QueryRegistry = {
};`,
  singleQuery: `import {QueryRegistry} from "@lib/types/query-registry";
import resolveTodoList from "./information/todo-list/resolve";

export const queries: QueryRegistry = {
  "TaskManagement.TodoList": {
    resolve: resolveTodoList,
  },
};`,
  twoQueries: `import {QueryRegistry} from "@lib/types/query-registry";
import resolveTodoList from "./information/todo-list/resolve";
import resolveTodoById from "./information/todo-by-id/resolve";

export const queries: QueryRegistry = {
  "TaskManagement.TodoList": {
    resolve: resolveTodoList,
  },
  "TaskManagement.TodoById": {
    resolve: resolveTodoById,
  },
};`,
  emptyEvents: `import {EventRegistry} from "@lib/types/event-registry";

export const events: EventRegistry = {
};`,
  singleEventWithApply: `import {EventRegistry} from "@lib/types/event-registry";
import prepareTodoAdded from "./information/todo-list/projection/todo-added/prepare";
import applyTodoAdded from "./information/todo-list/projection/todo-added/apply";

export const events: EventRegistry = {
  "TaskManagement.TodoAdded": {
    apply: [
      {
        information: "TaskManagement.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoAdded,
        exec: applyTodoAdded
      }
    ],
    automate: []
  }
};`,
  eventWithApplyAndAutomate: `import {EventRegistry} from "@lib/types/event-registry";
import prepareTodoAdded from "./information/todo-list/projection/todo-added/prepare";
import applyTodoAdded from "./information/todo-list/projection/todo-added/apply";
import prepareSendNotification from "./automations/events/send-notification/prepare";
import onSendNotification from "./automations/events/send-notification/on";

export const events: EventRegistry = {
  "TaskManagement.TodoAdded": {
    apply: [
      {
        information: "TaskManagement.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoAdded,
        exec: applyTodoAdded
      }
    ],
    automate: [
      {
        automation: "TaskManagement.SendNotification",
        inline: false,
        prepare: prepareSendNotification,
        exec: onSendNotification
      }
    ]
  }
};`,
  twoEvents: `import {EventRegistry} from "@lib/types/event-registry";
import prepareTodoAdded from "./information/todo-list/projection/todo-added/prepare";
import applyTodoAdded from "./information/todo-list/projection/todo-added/apply";
import prepareTodoCompleted from "./information/statistics/projection/todo-completed/prepare";
import applyTodoCompleted from "./information/statistics/projection/todo-completed/apply";

export const events: EventRegistry = {
  "TaskManagement.TodoAdded": {
    apply: [
      {
        information: "TaskManagement.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoAdded,
        exec: applyTodoAdded
      }
    ],
    automate: []
  },
  "TaskManagement.TodoCompleted": {
    apply: [
      {
        information: "TaskManagement.Statistics",
        inline: false,
        addsTodoJob: true,
        prepare: prepareTodoCompleted,
        exec: applyTodoCompleted
      }
    ],
    automate: []
  }
};`,
  emptyJobs: `import {JobAutomationRegistry} from "@lib/types/job-automation-registry";

export const jobs: JobAutomationRegistry = {
};`,
  singleJob: `import {JobAutomationRegistry} from "@lib/types/job-automation-registry";

export const jobs: JobAutomationRegistry = {
  "TaskManagement.SendDailyReminder": {
    todoList: "TaskManagement.TodoList",
    prepare: prepareSendDailyReminder,
    exec: onSendDailyReminder
  },
};`,
  twoJobs: `import {JobAutomationRegistry} from "@lib/types/job-automation-registry";

export const jobs: JobAutomationRegistry = {
  "TaskManagement.SendDailyReminder": {
    todoList: "TaskManagement.TodoList",
    prepare: prepareSendDailyReminder,
    exec: onSendDailyReminder
  },
  "TaskManagement.SendWeeklySummary": {
    todoList: "TaskManagement.TodoList",
    prepare: prepareSendWeeklySummary,
    exec: onSendWeeklySummary
  },
};`
};

describe('Registry Reader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'registry-reader-test-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, {recursive: true, force: true});
    }
  });

  describe('toKebab', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(toKebab('TaskManagement')).toBe('task-management');
      expect(toKebab('Crm')).toBe('crm');
      expect(toKebab('UserManagement')).toBe('user-management');
      expect(toKebab('PaymentProcessor')).toBe('payment-processor');
    });

    it('should handle single word names', () => {
      expect(toKebab('Crm')).toBe('crm');
      expect(toKebab('Todo')).toBe('todo');
    });

    it('should handle empty string', () => {
      expect(toKebab('')).toBe('');
    });
  });

  describe('parseJobAutomations', () => {
    it('should parse single job with todoList', () => {
      const result = parseJobAutomations(fixtures.singleJob);
      expect(result.size).toBe(1);
      expect(result.has('TaskManagement.SendDailyReminder')).toBe(true);
      expect(result.get('TaskManagement.SendDailyReminder')?.todoList).toBe('TaskManagement.TodoList');
    });

    it('should parse multiple jobs', () => {
      const result = parseJobAutomations(fixtures.twoJobs);
      expect(result.size).toBe(2);
      expect(result.get('TaskManagement.SendDailyReminder')?.todoList).toBe('TaskManagement.TodoList');
      expect(result.get('TaskManagement.SendWeeklySummary')?.todoList).toBe('TaskManagement.TodoList');
    });

    it('should return empty map for empty file', () => {
      const result = parseJobAutomations(fixtures.emptyJobs);
      expect(result.size).toBe(0);
    });
  });

  describe('readRegistrySnapshot', () => {
    describe('context detection', () => {
      it('should return empty snapshot for non-existent path', () => {
        const snapshot = readRegistrySnapshot('/nonexistent/path');
        expect(snapshot.contexts).toEqual(new Set());
        expect(snapshot.commands).toEqual(new Set());
      });

      it('should detect context folder (kebab-case -> PascalCase)', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.contexts).toContain('TaskManagement');
      });

      it('should detect multiple context folders', () => {
        mkdirSync(join(tempDir, 'task-management'), {recursive: true});
        mkdirSync(join(tempDir, 'crm'), {recursive: true});
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.contexts).toContain('TaskManagement');
        expect(snapshot.contexts).toContain('Crm');
        expect(snapshot.contexts.size).toBe(2);
      });

      it('should ignore hidden folders', () => {
        mkdirSync(join(tempDir, 'task-management'), {recursive: true});
        mkdirSync(join(tempDir, '.git'), {recursive: true});
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.contexts).toContain('TaskManagement');
        expect(snapshot.contexts).not.toContain('.git');
      });
    });

    describe('command registry', () => {
      it('should parse empty commands.ts', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'commands.ts'), fixtures.emptyCommands);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.commands).toEqual(new Set());
      });

      it('should parse single command from commands.ts', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'commands.ts'), fixtures.singleCommand);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.commands).toContain('TaskManagement.AddTodo');
      });

      it('should parse multiple commands from commands.ts', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'commands.ts'), fixtures.twoCommands);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.commands).toContain('TaskManagement.AddTodo');
        expect(snapshot.commands).toContain('TaskManagement.UpdateTodo');
        expect(snapshot.commands.size).toBe(2);
      });
    });

    describe('event registry', () => {
      it('should parse empty events.ts', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'events.ts'), fixtures.emptyEvents);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.events).toEqual(new Set());
        expect(snapshot.eventApply.size).toBe(0);
        expect(snapshot.eventAutomate.size).toBe(0);
      });

      it('should parse single event with apply mapping', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'events.ts'), fixtures.singleEventWithApply);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.events).toContain('TaskManagement.TodoAdded');
        
        // Check apply mapping
        const applySet = snapshot.eventApply.get('TaskManagement.TodoAdded');
        expect(applySet).toBeDefined();
        expect(applySet).toContain('TaskManagement.TodoList');
      });

      it('should parse event with both apply and automate mappings', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'events.ts'), fixtures.eventWithApplyAndAutomate);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.events).toContain('TaskManagement.TodoAdded');
        
        // Check apply mapping
        const applySet = snapshot.eventApply.get('TaskManagement.TodoAdded');
        expect(applySet).toContain('TaskManagement.TodoList');
        
        // Check automate mapping
        const automateSet = snapshot.eventAutomate.get('TaskManagement.TodoAdded');
        expect(automateSet).toContain('TaskManagement.SendNotification');
      });

      it('should parse multiple events with their mappings', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'events.ts'), fixtures.twoEvents);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.events).toContain('TaskManagement.TodoAdded');
        expect(snapshot.events).toContain('TaskManagement.TodoCompleted');
        
        // Check first event's apply mapping
        const applySet1 = snapshot.eventApply.get('TaskManagement.TodoAdded');
        expect(applySet1).toContain('TaskManagement.TodoList');
        
        // Check second event's apply mapping
        const applySet2 = snapshot.eventApply.get('TaskManagement.TodoCompleted');
        expect(applySet2).toContain('TaskManagement.Statistics');
      });
    });

    describe('query registry', () => {
      it('should parse empty queries.ts', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'queries.ts'), fixtures.emptyQueries);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.queries).toEqual(new Set());
      });

      it('should parse single query from queries.ts', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'queries.ts'), fixtures.singleQuery);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.queries).toContain('TaskManagement.TodoList');
      });

      it('should parse multiple queries from queries.ts', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'queries.ts'), fixtures.twoQueries);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.queries).toContain('TaskManagement.TodoList');
        expect(snapshot.queries).toContain('TaskManagement.TodoById');
        expect(snapshot.queries.size).toBe(2);
      });
    });

    describe('job automations', () => {
      it('should parse empty job-automations.ts', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'job-automations.ts'), fixtures.emptyJobs);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.jobs.size).toBe(0);
      });

      it('should parse single job with todoList', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        const filePath = join(contextPath, 'job-automations.ts');
        writeFileSync(filePath, fixtures.singleJob, 'utf-8');

        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.jobs.has('TaskManagement.SendDailyReminder')).toBe(true);
        expect(snapshot.jobs.get('TaskManagement.SendDailyReminder')?.todoList).toBe('TaskManagement.TodoList');
      });

      it('should parse multiple jobs with todoLists', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'job-automations.ts'), fixtures.twoJobs);
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.jobs.size).toBe(2);
        expect(snapshot.jobs.get('TaskManagement.SendDailyReminder')?.todoList).toBe('TaskManagement.TodoList');
        expect(snapshot.jobs.get('TaskManagement.SendWeeklySummary')?.todoList).toBe('TaskManagement.TodoList');
      });
    });

    describe('information folders', () => {
      it('should detect information folders', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        mkdirSync(join(contextPath, 'information', 'todo-list'), {recursive: true});
        mkdirSync(join(contextPath, 'information', 'statistics'), {recursive: true});
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.informationFolders).toContain('TaskManagement.TodoList');
        expect(snapshot.informationFolders).toContain('TaskManagement.Statistics');
      });

      it('should handle information folder with kebab-case name', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        mkdirSync(join(contextPath, 'information', 'user-by-id'), {recursive: true});
        
        const snapshot = readRegistrySnapshot(tempDir);
        expect(snapshot.informationFolders).toContain('TaskManagement.UserById');
      });
    });

    describe('job-to-information link check', () => {
      it('should link job to information via todoList', () => {
        const contextPath = join(tempDir, 'task-management');
        mkdirSync(contextPath, {recursive: true});
        writeFileSync(join(contextPath, 'job-automations.ts'), fixtures.singleJob);
        
        const snapshot = readRegistrySnapshot(tempDir);
        const jobConfig = snapshot.jobs.get('TaskManagement.SendDailyReminder');
        expect(jobConfig).toBeDefined();
        expect(jobConfig?.todoList).toBe('TaskManagement.TodoList');
      });
    });
  });
});
