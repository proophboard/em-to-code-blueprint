// Task-comment template tests
// Mapping to task-comments.md templates:
// - marker format [em-to-code-blueprint:<action-key>]: asserted in every builder test
// - where-to-look block incl. real chapterId/sliceLabel/elementId: every builder test + "renders the real chapter id"
// - known: KNOWN_ELEMENT_SENTENCE constant, files + registryFile variants, inline snapshot
// - command: files block, registry line, context note (only when flagged), inline snapshot
// - event: files block, other-command-sources note (present/absent), inline snapshot
// - information / prjcase / on / job: files block + registration line, inline snapshots
// - blocked: reason + optional hint, inline snapshot
// - context note ("Context X was created"): gated on action.contextNote, covered for
//   command and asserted absent otherwise
// - context actions produce no comment

import { describe, it, expect } from 'vitest';
import {
  KNOWN_ELEMENT_SENTENCE,
  WHERE_TO_LOOK_BLOCK,
  buildComment,
  buildKnownComment,
  buildCommandComment,
  buildEventComment,
  buildInformationComment,
  buildPrjcaseComment,
  buildOnComment,
  buildJobComment,
  buildBlockedComment
} from './task-comments.js';
import type { Action, BoardElement } from './model.js';

// Mock element for testing
const mockElement: BoardElement = {
  id: 'element-123',
  type: 'command',
  name: 'CreateUser',
  description: 'Create a new user',
  details: '',
  icon: 'user-plus',
  laneId: 'lane-1',
  sliceId: 'slice-1',
  index: 0,
  comments: [],
  context: 'App',
  chapterId: 'chapter-1',
  chapterName: 'Test Chapter',
  sliceStatus: 'planned'
};

const ctx = {
  element: mockElement,
  chapterId: 'chapter-1',
  chapterName: 'Test Chapter',
  sliceLabel: 'Test Slice'
};

// CommentContext for the per-kind builder functions
const CCTX = {
  chapterId: 'chapter-1',
  chapterName: 'Test Chapter',
  sliceLabel: 'Test Slice',
  sliceId: 'slice-1',
  elementId: 'element-123'
};

const CCTX_SNAPSHOT = {
  chapterId: 'chapter-1',
  chapterName: 'User Management',
  sliceLabel: 'Slice 1',
  sliceId: 'slice-1',
  elementId: 'element-123'
};

describe('task-comments', () => {
  describe('constants', () => {
    it('KNOWN_ELEMENT_SENTENCE has correct wording', () => {
      expect(KNOWN_ELEMENT_SENTENCE).toBe(
        'Element is known in the app. Compare the information in the Event Model with the implementation and make necessary changes to the implementation when needed.'
      );
    });

    it('WHERE_TO_LOOK_BLOCK has correct structure', () => {
      expect(WHERE_TO_LOOK_BLOCK).toContain('Before implementing:');
      expect(WHERE_TO_LOOK_BLOCK).toContain('Read this element\'s description and details on prooph board.');
      expect(WHERE_TO_LOOK_BLOCK).toContain('Check the element\'s play type and play function.');
      expect(WHERE_TO_LOOK_BLOCK).toContain('When done, resolve this task.');
    });
  });

  describe('buildKnownComment', () => {
    it('generates comment for known element', () => {
      const action: Action = {
        kind: 'known',
        key: 'command:Crm.CreateUser',
        files: ['src/domain/crm/commands/create-user/handle.ts'],
        registryFile: 'src/domain/crm/commands.ts'
      };

      const comment = buildKnownComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:known:Crm.CreateUser]');
      expect(comment).toContain(KNOWN_ELEMENT_SENTENCE);
      expect(comment).toContain('src/domain/crm/commands/create-user/handle.ts');
      expect(comment).toContain('src/domain/crm/commands.ts');
      expect(comment).toContain('Before implementing:');
      expect(comment).toContain('When done, resolve this task.');
    });

    it('handles known element without files', () => {
      const action: Action = {
        kind: 'known',
        key: 'event:Crm.UserCreated',
        registryFile: 'src/domain/crm/events.ts'
      };

      const comment = buildKnownComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:known:Crm.UserCreated]');
      expect(comment).toContain('No files generated');
    });
  });

  describe('buildCommandComment', () => {
    it('generates comment for new command', () => {
      const action: Action = {
        kind: 'command',
        key: 'command:Crm.CreateUser',
        context: 'Crm',
        command: 'CreateUser',
        files: ['src/domain/crm/commands/create-user/handle.ts'],
        registryFile: 'src/domain/crm/commands.ts'
      };

      const comment = buildCommandComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:command:Crm.CreateUser]');
      expect(comment).toContain('Boilerplate for command Crm.CreateUser was generated');
      expect(comment).toContain('npx app codegen command Crm CreateUser');
      expect(comment).toContain('src/domain/crm/commands/create-user/handle.ts');
      expect(comment).toContain('src/domain/crm/commands.ts');
    });

    it('includes context note when new context created', () => {
      const action: Action = {
        kind: 'command',
        key: 'command:Crm.CreateUser',
        context: 'Crm',
        command: 'CreateUser',
        files: ['src/domain/crm/commands/create-user/handle.ts'],
        registryFile: 'src/domain/crm/commands.ts',
        contextNote: true
      };

      const comment = buildCommandComment(action, CCTX);

      expect(comment).toContain('Context Crm was created');
      expect(comment).toContain('src/domain/crm');
      expect(comment).toContain('services.ts');
      expect(comment).toContain('index.ts');
    });

    it('does not include context note for elements in an existing context', () => {
      const action: Action = {
        kind: 'command',
        key: 'command:Crm.CreateUser',
        context: 'Crm',
        command: 'CreateUser',
        files: ['src/domain/crm/commands/create-user/handle.ts'],
        registryFile: 'src/domain/crm/commands.ts'
        // no contextNote flag
      };

      const comment = buildCommandComment(action, CCTX);

      expect(comment).not.toContain('was created');
    });

    it('renders the real chapter id in the board reference', () => {
      const action: Action = {
        kind: 'command',
        key: 'command:Crm.CreateUser',
        context: 'Crm',
        command: 'CreateUser',
        files: [],
        registryFile: 'src/domain/crm/commands.ts'
      };

      const comment = buildCommandComment(action, CCTX);

      expect(comment).toContain('chapter Test Chapter (chapter-1)');
      expect(comment).not.toContain('(...)');
    });
  });

  describe('buildEventComment', () => {
    it('generates comment for new event', () => {
      const action: Action = {
        kind: 'event',
        key: 'event:Crm.UserCreated',
        context: 'Crm',
        command: 'CreateUser',
        event: 'UserCreated',
        files: ['src/domain/crm/events/user-created/apply.ts'],
        registryFile: 'src/domain/crm/events.ts'
      };

      const comment = buildEventComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:event:Crm.UserCreated]');
      expect(comment).toContain('Boilerplate for event Crm.UserCreated was generated');
      expect(comment).toContain('npx app codegen event Crm CreateUser UserCreated');
      expect(comment).toContain('emitted by command Crm.CreateUser');
      expect(comment).toContain('src/domain/crm/events/user-created/apply.ts');
      expect(comment).toContain('src/domain/crm/events.ts');
    });

    it('mentions other command sources when the board has several', () => {
      const action: Action = {
        kind: 'event',
        key: 'event:Crm.UserCreated',
        context: 'Crm',
        command: 'CreateUser',
        event: 'UserCreated',
        files: ['src/domain/crm/commands/create-user/events/user-created.ts'],
        registryFile: 'src/domain/crm/events.ts',
        otherCommandSources: ['Crm.RegisterUser']
      };

      const comment = buildEventComment(action, CCTX);

      expect(comment).toContain('Other command source(s)');
      expect(comment).toContain('Crm.RegisterUser');
      expect(comment).toContain('Codegen used Crm.CreateUser');
    });

    it('omits the other-command-sources note when there is only one', () => {
      const action: Action = {
        kind: 'event',
        key: 'event:Crm.UserCreated',
        context: 'Crm',
        command: 'CreateUser',
        event: 'UserCreated',
        files: [],
        registryFile: 'src/domain/crm/events.ts'
      };

      const comment = buildEventComment(action, CCTX);

      expect(comment).not.toContain('Other command source');
    });
  });

  describe('buildInformationComment', () => {
    it('generates comment for new information', () => {
      const action: Action = {
        kind: 'information',
        key: 'information:Crm.UserList',
        context: 'Crm',
        information: 'UserList',
        files: ['src/domain/crm/information/user-list/user-list.ts'],
        registryFile: 'src/domain/crm/queries.ts'
      };

      const comment = buildInformationComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:information:Crm.UserList]');
      expect(comment).toContain('Boilerplate for information Crm.UserList was generated');
      expect(comment).toContain('npx app codegen information Crm UserList');
      expect(comment).toContain('src/domain/crm/information/user-list/user-list.ts');
      expect(comment).toContain('src/domain/crm/queries.ts');
    });
  });

  describe('buildPrjcaseComment', () => {
    it('generates comment for projection case', () => {
      const action: Action = {
        kind: 'prjcase',
        key: 'prjcase:Crm.UserList<-Crm.UserCreated',
        context: 'Crm',
        information: 'UserList',
        event: 'UserCreated',
        files: ['src/domain/crm/information/user-list/projection/user-created/apply.ts'],
        registryFile: 'src/domain/crm/events.ts'
      };

      const comment = buildPrjcaseComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:prjcase:Crm.UserList<-Crm.UserCreated]');
      expect(comment).toContain('Projection case for event Crm.UserCreated was generated');
      expect(comment).toContain('npx app codegen prjcase Crm UserList UserCreated');
      expect(comment).toContain('src/domain/crm/information/user-list/projection/user-created/apply.ts');
      expect(comment).toContain('--async');
      expect(comment).toContain('--adds-todo');
    });
  });

  describe('buildOnComment', () => {
    it('generates comment for event automation', () => {
      const action: Action = {
        kind: 'on',
        key: 'on:Crm.SendNotification<-Crm.UserCreated',
        context: 'Crm',
        automation: 'SendNotification',
        event: 'UserCreated',
        files: ['src/domain/crm/automations/events/send-notification/on.ts'],
        registryFile: 'src/domain/crm/events.ts'
      };

      const comment = buildOnComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:on:Crm.SendNotification<-Crm.UserCreated]');
      expect(comment).toContain('Event automation Crm.SendNotification reacting to event Crm.UserCreated was generated');
      expect(comment).toContain('npx app codegen on Crm UserCreated SendNotification');
      expect(comment).toContain('src/domain/crm/automations/events/send-notification/on.ts');
      expect(comment).toContain('src/domain/crm/events.ts');
      expect(comment).toContain('--async');
    });
  });

  describe('buildJobComment', () => {
    it('generates comment for job automation', () => {
      const action: Action = {
        kind: 'job',
        key: 'job:Crm.ProcessTodo<-Crm.TodoList',
        context: 'Crm',
        automation: 'ProcessTodo',
        information: 'TodoList',
        files: ['src/domain/crm/automations/jobs/process-todo/process.ts'],
        registryFile: 'src/domain/crm/job-automations.ts'
      };

      const comment = buildJobComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:job:Crm.ProcessTodo<-Crm.TodoList]');
      expect(comment).toContain('Job automation Crm.ProcessTodo working off todo list Crm.TodoList was generated');
      expect(comment).toContain('npx app codegen job Crm TodoList ProcessTodo');
      expect(comment).toContain('src/domain/crm/automations/jobs/process-todo/process.ts');
      expect(comment).toContain('src/domain/crm/job-automations.ts');
      expect(comment).toContain('addsTodoJob');
    });
  });

  describe('buildBlockedComment', () => {
    it('generates comment for blocked action', () => {
      const action: Action = {
        kind: 'blocked',
        key: 'blocked:Crm.CreateUser',
        reason: 'invalid name for codegen',
        hint: 'use a valid PascalCase name'
      };

      const comment = buildBlockedComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:blocked:Crm.CreateUser]');
      expect(comment).toContain('The bridge did not generate code for this element: invalid name for codegen');
      expect(comment).toContain('use a valid PascalCase name');
    });

    it('handles blocked action without hint', () => {
      const action: Action = {
        kind: 'blocked',
        key: 'blocked:Event.WithoutCommand',
        reason: 'event without command source'
      };

      const comment = buildBlockedComment(action, CCTX);

      expect(comment).toContain('[em-to-code-blueprint:blocked:Event.WithoutCommand]');
      expect(comment).toContain('event without command source');
      // Should not include "Decide how to proceed:" when no hint
      expect(comment).not.toContain('Decide how to proceed:');
    });
  });

  describe('buildComment', () => {
    it('routes to correct builder for known action', () => {
      const action: Action = {
        kind: 'known',
        key: 'command:Crm.CreateUser',
        files: [],
        registryFile: 'src/domain/crm/commands.ts'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toContain('[em-to-code-blueprint:known:Crm.CreateUser]');
      expect(comment).toContain(KNOWN_ELEMENT_SENTENCE);
    });

    it('routes to correct builder for command action', () => {
      const action: Action = {
        kind: 'command',
        key: 'command:Crm.CreateUser',
        context: 'Crm',
        command: 'CreateUser',
        files: [],
        registryFile: 'src/domain/crm/commands.ts'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toContain('[em-to-code-blueprint:command:Crm.CreateUser]');
    });

    it('routes to correct builder for event action', () => {
      const action: Action = {
        kind: 'event',
        key: 'event:Crm.UserCreated',
        context: 'Crm',
        command: 'CreateUser',
        event: 'UserCreated',
        files: [],
        registryFile: 'src/domain/crm/events.ts'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toContain('[em-to-code-blueprint:event:Crm.UserCreated]');
    });

    it('routes to correct builder for information action', () => {
      const action: Action = {
        kind: 'information',
        key: 'information:Crm.UserList',
        context: 'Crm',
        information: 'UserList',
        files: [],
        registryFile: 'src/domain/crm/queries.ts'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toContain('[em-to-code-blueprint:information:Crm.UserList]');
    });

    it('routes to correct builder for prjcase action', () => {
      const action: Action = {
        kind: 'prjcase',
        key: 'prjcase:Crm.UserList<-Crm.UserCreated',
        context: 'Crm',
        information: 'UserList',
        event: 'UserCreated',
        files: [],
        registryFile: 'src/domain/crm/events.ts'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toContain('[em-to-code-blueprint:prjcase:Crm.UserList<-Crm.UserCreated]');
    });

    it('routes to correct builder for on action', () => {
      const action: Action = {
        kind: 'on',
        key: 'on:Crm.SendNotification<-Crm.UserCreated',
        context: 'Crm',
        automation: 'SendNotification',
        event: 'UserCreated',
        files: [],
        registryFile: 'src/domain/crm/events.ts'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toContain('[em-to-code-blueprint:on:Crm.SendNotification<-Crm.UserCreated]');
    });

    it('routes to correct builder for job action', () => {
      const action: Action = {
        kind: 'job',
        key: 'job:Crm.ProcessTodo<-Crm.TodoList',
        context: 'Crm',
        automation: 'ProcessTodo',
        information: 'TodoList',
        files: [],
        registryFile: 'src/domain/crm/job-automations.ts'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toContain('[em-to-code-blueprint:job:Crm.ProcessTodo<-Crm.TodoList]');
    });

    it('routes to correct builder for blocked action', () => {
      const action: Action = {
        kind: 'blocked',
        key: 'blocked:Crm.CreateUser',
        reason: 'cross-context link',
        hint: 'see README todo "External Events"'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toContain('[em-to-code-blueprint:blocked:Crm.CreateUser]');
    });

    it('returns empty string for context action', () => {
      const action: Action = {
        kind: 'context',
        key: 'context:Crm',
        context: 'Crm'
      };

      const comment = buildComment(action, ctx);

      expect(comment).toBe('');
    });
  });

  describe('idempotency', () => {
    it('marker format follows convention', () => {
      // All markers should start with [em-to-code-blueprint:
      const markers = [
        '[em-to-code-blueprint:known:Crm.CreateUser]',
        '[em-to-code-blueprint:command:Crm.CreateUser]',
        '[em-to-code-blueprint:event:Crm.UserCreated]',
        '[em-to-code-blueprint:information:Crm.UserList]',
        '[em-to-code-blueprint:prjcase:Crm.UserList<-Crm.UserCreated]',
        '[em-to-code-blueprint:on:Crm.SendNotification<-Crm.UserCreated]',
        '[em-to-code-blueprint:job:Crm.ProcessTodo<-Crm.TodoList]',
        '[em-to-code-blueprint:blocked:Crm.CreateUser]'
      ];

      markers.forEach(marker => {
        expect(marker).toMatch(/^\[em-to-code-blueprint:.+\]$/);
      });
    });

    it('all templates include where-to-look block', () => {
      const actions: Action[] = [
        { kind: 'known', key: 'known:Crm.CreateUser', files: [], registryFile: '' },
        { kind: 'command', key: 'command:Crm.CreateUser', context: 'Crm', command: 'CreateUser', files: [], registryFile: '' },
        { kind: 'event', key: 'event:Crm.UserCreated', context: 'Crm', command: 'CreateUser', event: 'UserCreated', files: [], registryFile: '' },
        { kind: 'information', key: 'information:Crm.UserList', context: 'Crm', information: 'UserList', files: [], registryFile: '' },
        { kind: 'prjcase', key: 'prjcase:Crm.UserList<-Crm.UserCreated', context: 'Crm', information: 'UserList', event: 'UserCreated', files: [], registryFile: '' },
        { kind: 'on', key: 'on:Crm.SendNotification<-Crm.UserCreated', context: 'Crm', automation: 'SendNotification', event: 'UserCreated', files: [], registryFile: '' },
        { kind: 'job', key: 'job:Crm.ProcessTodo<-Crm.TodoList', context: 'Crm', automation: 'ProcessTodo', information: 'TodoList', files: [], registryFile: '' },
        { kind: 'blocked', key: 'blocked:Crm.CreateUser', reason: 'test', hint: 'test' }
      ];

      actions.forEach(action => {
        if (action.kind !== 'context') {
          const comment = buildComment(action, ctx);
          expect(comment).toContain('Before implementing:');
          expect(comment).toContain('When done, resolve this task.');
          expect(comment).toContain('element element-123');
        }
      });
    });
  });

  describe('snapshot tests', () => {
    it('known comment snapshot', () => {
      const action: Action = {
        kind: 'known',
        key: 'command:Crm.CreateUser',
        files: ['src/domain/crm/commands/create-user/handle.ts', 'src/domain/crm/commands/create-user/prepare.ts'],
        registryFile: 'src/domain/crm/commands.ts'
      };

      expect(buildKnownComment(action, CCTX_SNAPSHOT)).toMatchInlineSnapshot(`
        "[em-to-code-blueprint:known:Crm.CreateUser]

        Element is known in the app. Compare the information in the Event Model with the implementation and make necessary changes to the implementation when needed.

        Implementation:
        - src/domain/crm/commands/create-user/handle.ts
        - src/domain/crm/commands/create-user/prepare.ts
        Registered in: src/domain/crm/commands.ts

        Before implementing:
        - Read this element's description and details on prooph board.
        - Check the element's play type and play function.
        - If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
        Board reference: chapter User Management (chapter-1), slice Slice 1 (slice-1), element element-123.
        When done, resolve this task."
      `);
    });

    it('command comment snapshot', () => {
      const action: Action = {
        kind: 'command',
        key: 'command:Crm.CreateUser',
        context: 'Crm',
        command: 'CreateUser',
        files: ['src/domain/crm/commands/create-user/handle.ts', 'src/domain/crm/commands/create-user/prepare.ts', 'src/domain/crm/commands/create-user/payload.ts', 'src/domain/crm/commands/create-user/state.ts'],
        registryFile: 'src/domain/crm/commands.ts'
      };

      expect(buildCommandComment(action, CCTX_SNAPSHOT)).toMatchInlineSnapshot(`
        "[em-to-code-blueprint:command:Crm.CreateUser]

        Boilerplate for command Crm.CreateUser was generated with \`npx app codegen command Crm CreateUser\`.
        Finalize it:
        - src/domain/crm/commands/create-user/handle.ts
        - src/domain/crm/commands/create-user/prepare.ts
        - src/domain/crm/commands/create-user/payload.ts
        - src/domain/crm/commands/create-user/state.ts
        Registered in src/domain/crm/commands.ts.

        Before implementing:
        - Read this element's description and details on prooph board.
        - Check the element's play type and play function.
        - If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
        Board reference: chapter User Management (chapter-1), slice Slice 1 (slice-1), element element-123.
        When done, resolve this task."
      `);
    });

    it('event comment snapshot', () => {
      const action: Action = {
        kind: 'event',
        key: 'event:Crm.UserCreated',
        context: 'Crm',
        command: 'CreateUser',
        event: 'UserCreated',
        files: ['src/domain/crm/events/user-created/apply.ts'],
        registryFile: 'src/domain/crm/events.ts'
      };

      expect(buildEventComment(action, CCTX_SNAPSHOT)).toMatchInlineSnapshot(`
        "[em-to-code-blueprint:event:Crm.UserCreated]

        Boilerplate for event Crm.UserCreated was generated with \`npx app codegen event Crm CreateUser UserCreated\` (emitted by command Crm.CreateUser).
        Finalize it:
        - src/domain/crm/events/user-created/apply.ts
        Registered in src/domain/crm/events.ts.

        Before implementing:
        - Read this element's description and details on prooph board.
        - Check the element's play type and play function.
        - If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
        Board reference: chapter User Management (chapter-1), slice Slice 1 (slice-1), element element-123.
        When done, resolve this task."
      `);
    });

    it('information comment snapshot', () => {
      const action: Action = {
        kind: 'information',
        key: 'information:Crm.UserList',
        context: 'Crm',
        information: 'UserList',
        files: ['src/domain/crm/information/user-list/user-list.ts', 'src/domain/crm/information/user-list/query.ts', 'src/domain/crm/information/user-list/resolve.ts'],
        registryFile: 'src/domain/crm/queries.ts'
      };

      expect(buildInformationComment(action, CCTX_SNAPSHOT)).toMatchInlineSnapshot(`
        "[em-to-code-blueprint:information:Crm.UserList]

        Boilerplate for information Crm.UserList was generated with \`npx app codegen information Crm UserList\`.
        Finalize it:
        - src/domain/crm/information/user-list/user-list.ts
        - src/domain/crm/information/user-list/query.ts
        - src/domain/crm/information/user-list/resolve.ts
        Registered in src/domain/crm/queries.ts.

        Before implementing:
        - Read this element's description and details on prooph board.
        - Check the element's play type and play function.
        - If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
        Board reference: chapter User Management (chapter-1), slice Slice 1 (slice-1), element element-123.
        When done, resolve this task."
      `);
    });

    it('prjcase comment snapshot', () => {
      const action: Action = {
        kind: 'prjcase',
        key: 'prjcase:Crm.UserList<-Crm.UserCreated',
        context: 'Crm',
        information: 'UserList',
        event: 'UserCreated',
        files: ['src/domain/crm/information/user-list/projection/user-created/apply.ts', 'src/domain/crm/information/user-list/projection/user-created/prepare.ts', 'src/domain/crm/information/user-list/projection/user-created/state.ts'],
        registryFile: 'src/domain/crm/events.ts'
      };

      expect(buildPrjcaseComment(action, CCTX_SNAPSHOT)).toMatchInlineSnapshot(`
        "[em-to-code-blueprint:prjcase:Crm.UserList<-Crm.UserCreated]

        Projection case for event Crm.UserCreated was generated with \`npx app codegen prjcase Crm UserList UserCreated\`.
        Finalize it:
        - src/domain/crm/information/user-list/projection/user-created/apply.ts
        - src/domain/crm/information/user-list/projection/user-created/prepare.ts
        - src/domain/crm/information/user-list/projection/user-created/state.ts
        Defaults: inline projection, no todo job. Decide whether it should run async (\`--async\`) or add a todo job (\`--adds-todo\`); regenerate or edit the registration in src/domain/crm/events.ts accordingly.

        Before implementing:
        - Read this element's description and details on prooph board.
        - Check the element's play type and play function.
        - If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
        Board reference: chapter User Management (chapter-1), slice Slice 1 (slice-1), element element-123.
        When done, resolve this task."
      `);
    });

    it('on comment snapshot', () => {
      const action: Action = {
        kind: 'on',
        key: 'on:Crm.SendNotification<-Crm.UserCreated',
        context: 'Crm',
        automation: 'SendNotification',
        event: 'UserCreated',
        files: ['src/domain/crm/automations/events/send-notification/on.ts', 'src/domain/crm/automations/events/send-notification/prepare.ts', 'src/domain/crm/automations/events/send-notification/state.ts'],
        registryFile: 'src/domain/crm/events.ts'
      };

      expect(buildOnComment(action, CCTX_SNAPSHOT)).toMatchInlineSnapshot(`
        "[em-to-code-blueprint:on:Crm.SendNotification<-Crm.UserCreated]

        Event automation Crm.SendNotification reacting to event Crm.UserCreated was generated with \`npx app codegen on Crm UserCreated SendNotification\`.
        Finalize it:
        - src/domain/crm/automations/events/send-notification/on.ts
        - src/domain/crm/automations/events/send-notification/prepare.ts
        - src/domain/crm/automations/events/send-notification/state.ts
        Registered in src/domain/crm/events.ts (inline by default; decide on \`--async\`).

        Before implementing:
        - Read this element's description and details on prooph board.
        - Check the element's play type and play function.
        - If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
        Board reference: chapter User Management (chapter-1), slice Slice 1 (slice-1), element element-123.
        When done, resolve this task."
      `);
    });

    it('job comment snapshot', () => {
      const action: Action = {
        kind: 'job',
        key: 'job:Crm.ProcessTodo<-Crm.TodoList',
        context: 'Crm',
        automation: 'ProcessTodo',
        information: 'TodoList',
        files: ['src/domain/crm/automations/jobs/process-todo/process.ts', 'src/domain/crm/automations/jobs/process-todo/prepare.ts', 'src/domain/crm/automations/jobs/process-todo/state.ts'],
        registryFile: 'src/domain/crm/job-automations.ts'
      };

      expect(buildJobComment(action, CCTX_SNAPSHOT)).toMatchInlineSnapshot(`
        "[em-to-code-blueprint:job:Crm.ProcessTodo<-Crm.TodoList]

        Job automation Crm.ProcessTodo working off todo list Crm.TodoList was generated with \`npx app codegen job Crm TodoList ProcessTodo\`.
        Finalize it:
        - src/domain/crm/automations/jobs/process-todo/process.ts
        - src/domain/crm/automations/jobs/process-todo/prepare.ts
        - src/domain/crm/automations/jobs/process-todo/state.ts
        Registered in src/domain/crm/job-automations.ts.
        The projection that fills the todo list must set addsTodoJob (see the information's projection cases).

        Before implementing:
        - Read this element's description and details on prooph board.
        - Check the element's play type and play function.
        - If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
        Board reference: chapter User Management (chapter-1), slice Slice 1 (slice-1), element element-123.
        When done, resolve this task."
      `);
    });

    it('blocked comment snapshot', () => {
      const action: Action = {
        kind: 'blocked',
        key: 'blocked:Crm.CreateUser',
        reason: 'cross-context link',
        hint: 'see README todo "External Events"'
      };

      expect(buildBlockedComment(action, CCTX_SNAPSHOT)).toMatchInlineSnapshot(`
        "[em-to-code-blueprint:blocked:Crm.CreateUser]

        The bridge did not generate code for this element: cross-context link.
        Decide how to proceed: see README todo "External Events"

        Before implementing:
        - Read this element's description and details on prooph board.
        - Check the element's play type and play function.
        - If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
        Board reference: chapter User Management (chapter-1), slice Slice 1 (slice-1), element element-123.
        When done, resolve this task."
      `);
    });
  });
});
