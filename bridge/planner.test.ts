// Planner tests - table-driven
// Mapping to rules:
// R1: non-relevant element types (ui/hotspot/...) are skipped entirely
// R2: registered vs new - tests for each element type registered/not registered; links of registered elements still evaluated
// R3: context first - context missing -> one context action ordered first
// R4: event with command in same slice; command in other chapter (same context -> generated); two command sources; none -> blocked; command in other context -> blocked
// R5: event->information both directions give one prjcase; link already exists -> none; information not registered -> information + prjcase; cross-context -> blocked
// R6/R7: event->automation gives on; information->automation gives job; automation with both; automation without sources -> blocked; automation already registered as job suppresses on; cross-context -> blocked
// R8: ordering and de-duplication; stable output (snapshot)
// R9: counterparts of other chapters receive comment targets with their own chapterId
// R10: missing graph -> degraded plan + note
// Names: unresolvable element names -> blocked + note

import {describe, it, expect, beforeEach} from 'vitest';
import {plan, PlanInput} from './planner.js';
import {Action, BoardElement, DependencyGraph} from "./model";

// Helper to create elements
function createElement(id: string, type: 'command' | 'event' | 'information' | 'automation', name: string, context: string = 'App', index: number = 0, chapterId: string = 'chapter1'): BoardElement {
  return {
    id,
    index,
    type,
    name,
    context,
    chapterId,
    description: '',
    details: '',
    icon: '',
    laneId: 'lane1',
    sliceId: 'slice1',
    comments: [],
    chapterName: 'Chapter 1'
  };
}

// Helper to create a graph
function createGraph(elementId: string, type: 'command' | 'event' | 'information' | 'automation', name: string, context: string = 'App'): DependencyGraph {
  return {
    element: createElement(elementId, type, name, context),
    sources: [],
    targets: []
  }
}

// Helper to create a registry snapshot
function createRegistry(): {contexts: Set<string>; commands: Set<string>; events: Set<string>; queries: Set<string>; informationFolders: Set<string>; jobs: Map<string, {todoList: string}>; eventApply: Map<string, Set<string>>; eventAutomate: Map<string, Set<string>>} {
  return {
    contexts: new Set(),
    commands: new Set(),
    events: new Set(),
    queries: new Set(),
    informationFolders: new Set(),
    jobs: new Map(),
    eventApply: new Map(),
    eventAutomate: new Map()
  };
}

// Helper to check if an action exists with specific properties
function findAction(actions: Action[], partial: Partial<Action>): Action | undefined {
  return actions.find(a =>
    (partial.kind === undefined || a.kind === partial.kind) &&
    (partial.context === undefined || a.context === partial.context) &&
    (partial.name === undefined || a.name === partial.name) &&
    (partial.targetType === undefined || a.targetType === partial.targetType) &&
    (partial.reason === undefined || a.reason === partial.reason)
  );
}

describe('Planner', () => {
  describe('R1: Element relevance', () => {
    it('should skip elements that are not command/event/information/automation', () => {
      const registry = createRegistry();

      const uiElement = createElement('elem-ui', 'command', 'a-button', 'Crm', 0);
      (uiElement as {type: string}).type = 'ui';
      const hotspot = createElement('elem-hs', 'command', 'a-hotspot', 'Crm', 1);
      (hotspot as {type: string}).type = 'hotspot';

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [uiElement, hotspot, createElement('elem1', 'command', 'create-user', 'Crm', 2)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      // only the command element produced actions (context + command)
      expect(result.actions.filter(a => a.kind === 'command')).toHaveLength(1);
      expect(result.actions.find(a => a.name === 'AButton')).toBeUndefined();
      expect(result.actions.find(a => a.name === 'AHotspot')).toBeUndefined();
    });
  });

  describe('R2: Registered vs. new', () => {
    it('should mark command as known when registered', () => {
      const registry = createRegistry();
      registry.commands.add('Crm.CreateUser');

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'command', 'create-user', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('known');
      expect(result.actions[0].key).toBe('known:Crm.CreateUser');
    });

    it('should generate command when not registered', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'command', 'create-user', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      expect(result.actions).toHaveLength(2); // context + command
      expect(result.actions[0].kind).toBe('context');
      expect(result.actions[1].kind).toBe('command');
    });

    it('should mark event as known when registered', () => {
      const registry = createRegistry();
      registry.events.add('Crm.UserCreated');

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('known');
      expect(result.actions[0].key).toBe('known:Crm.UserCreated');
    });

    it('should mark information as known when registered', () => {
      const registry = createRegistry();
      registry.informationFolders.add('Crm.User');

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'information', 'user', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('known');
      expect(result.actions[0].key).toBe('known:Crm.User');
    });

    it('should mark automation as known when registered as job', () => {
      const registry = createRegistry();
      registry.jobs.set('Crm.SendWelcomeEmail', {todoList: 'Crm.TodoList'});

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'automation', 'send-welcome-email', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('known');
      expect(result.actions[0].key).toBe('known:Crm.SendWelcomeEmail');
    });

    it('should mark automation as known when registered as event automation', () => {
      const registry = createRegistry();
      registry.events.add('Crm.UserCreated');
      const automateSet = new Set<string>();
      automateSet.add('Crm.SendWelcomeEmail');
      registry.eventAutomate.set('Crm.UserCreated', automateSet);

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'automation', 'send-welcome-email', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('known');
      expect(result.actions[0].key).toBe('known:Crm.SendWelcomeEmail');
    });

    it('should still evaluate links of a registered element (missing link generated)', () => {
      // R2: a missing link is generated even when both ends are known.
      const registry = createRegistry();
      registry.contexts.add('Crm');
      registry.events.add('Crm.UserCreated');
      registry.informationFolders.add('Crm.User');
      // no eventApply entry -> the link itself is not in the registry yet

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'info-elem',
        type: 'information',
        name: 'user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'information', 'user', 'Crm', 1)
        ],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      const prjcaseAction = result.actions.find(a => a.kind === 'prjcase' && a.name === 'User');
      expect(prjcaseAction).toBeDefined();
      // But no information regeneration - it is already registered
      expect(result.actions.find(a => a.kind === 'information')).toBeUndefined();
    });
  });

  describe('R3: Context first', () => {
    it('should emit context action when context is missing', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'command', 'create-user', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      expect(result.actions[0].kind).toBe('context');
      expect(result.actions[0].context).toBe('Crm');
    });

    it('should share context action for multiple elements in same context', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'command', 'create-user', 'Crm', 0),
          createElement('elem2', 'command', 'update-user', 'Crm', 1)
        ],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      const contextActions = result.actions.filter(a => a.kind === 'context');
      expect(contextActions).toHaveLength(1);
    });
  });

  describe('R4: Per-type generation for new elements', () => {
    it('should generate command for command element', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'command', 'create-user', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      const commandAction = result.actions.find(a => a.kind === 'command');
      expect(commandAction).toBeDefined();
      expect(commandAction!.context).toBe('Crm');
      expect(commandAction!.name).toBe('CreateUser');
    });

    it('should generate event with command when command in same slice', () => {
      const registry = createRegistry();

      const graph = createGraph('elem1', 'event', 'user-created', 'Crm');
      graph.sources.push({
        id: 'cmd-elem',
        type: 'command',
        name: 'create-user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map([['elem1', graph]]),
        registry
      };

      const result = plan(input);
      const commandAction = result.actions.find(a => a.kind === 'command' && a.name === 'CreateUser');
      expect(commandAction).toBeDefined();
      const eventAction = result.actions.find(a => a.kind === 'event' && a.name === 'UserCreated');
      expect(eventAction).toBeDefined();
    });

    it('should block event when no command source', () => {
      const registry = createRegistry();

      const graph = createGraph('elem1', 'event', 'user-created', 'Crm');
      graph.sources = [];

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map([['elem1', graph]]),
        registry
      };

      const result = plan(input);
      const blockedAction = result.actions.find(a => a.kind === 'blocked' && a.name === 'UserCreated');
      expect(blockedAction).toBeDefined();
      expect(blockedAction!.reason).toBe('no command source in the Event Model');
    });

    it('should generate event when command is in another chapter but same context', () => {
      const registry = createRegistry();

      const graph = createGraph('elem1', 'event', 'user-created', 'Crm');
      graph.sources.push({
        id: 'cmd-elem',
        type: 'command',
        name: 'create-user',
        context: 'Crm',
        chapterId: 'other-chapter'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map([['elem1', graph]]),
        registry
      };

      const result = plan(input);
      expect(result.actions.find(a => a.kind === 'event' && a.name === 'UserCreated')).toBeDefined();
      expect(result.actions.find(a => a.kind === 'blocked')).toBeUndefined();
    });

    it('should block event when command is in another context', () => {
      const registry = createRegistry();

      const graph = createGraph('elem1', 'event', 'user-created', 'Crm');
      graph.sources.push({
        id: 'cmd-elem',
        type: 'command',
        name: 'create-user',
        context: 'Other',
        chapterId: 'other-chapter'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map([['elem1', graph]]),
        registry
      };

      const result = plan(input);
      const blockedAction = result.actions.find(a => a.kind === 'blocked' && a.name === 'UserCreated');
      expect(blockedAction).toBeDefined();
      expect(blockedAction!.reason).toBe('command is in another context, which codegen does not support');
    });

    it('should prefer the command source from the same slice and list the others', () => {
      const registry = createRegistry();

      const graph = createGraph('elem1', 'event', 'user-created', 'Crm');
      graph.sources.push(
        {
          id: 'cmd-other',
          type: 'command',
          name: 'register-user',
          context: 'Crm',
          chapterId: 'other-chapter',
          sliceId: 'other-slice'
        },
        {
          id: 'cmd-same',
          type: 'command',
          name: 'create-user',
          context: 'Crm',
          chapterId: 'chapter1',
          sliceId: 'slice1'
        }
      );

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map([['elem1', graph]]),
        registry
      };

      const result = plan(input);
      const eventAction = result.actions.find(a => a.kind === 'event' && a.name === 'UserCreated');
      expect(eventAction).toBeDefined();
      expect(eventAction!.command).toBe('CreateUser');
      expect(eventAction!.otherCommandSources).toEqual(['Crm.RegisterUser']);
    });

    it('should generate information for information element', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'information', 'user', 'Crm', 0)],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      const infoAction = result.actions.find(a => a.kind === 'information' && a.name === 'User');
      expect(infoAction).toBeDefined();
    });

    it('should block automation without sources', () => {
      const registry = createRegistry();

      const graph = createGraph('elem1', 'automation', 'send-email', 'Crm');
      graph.sources = [];
      graph.targets = [];

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'automation', 'send-email', 'Crm', 0)],
        graphs: new Map([['elem1', graph]]),
        registry
      };

      const result = plan(input);
      const blockedAction = result.actions.find(a => a.kind === 'blocked' && a.name === 'SendEmail');
      expect(blockedAction).toBeDefined();
      expect(blockedAction!.reason).toBe('cannot tell event automation from job automation; needs a human/agent');
    });
  });

  describe('R5: Event -> Information (projection case)', () => {
    it('should generate prjcase when event and information in same context', () => {
      const registry = createRegistry();

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'info-elem',
        type: 'information',
        name: 'user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'information', 'user', 'Crm', 1)
        ],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      const prjcaseAction = result.actions.find(a => a.kind === 'prjcase' && a.name === 'User');
      expect(prjcaseAction).toBeDefined();
    });

    it('should generate prjcase from information->event direction', () => {
      const registry = createRegistry();

      const infoGraph = createGraph('elem1', 'information', 'user', 'Crm');
      infoGraph.sources.push({
        id: 'event-elem',
        type: 'event',
        name: 'user-created',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'information', 'user', 'Crm', 0),
          createElement('elem2', 'event', 'user-created', 'Crm', 1)
        ],
        graphs: new Map([['elem1', infoGraph]]),
        registry
      };

      const result = plan(input);
      const prjcaseAction = result.actions.find(a => a.kind === 'prjcase' && a.name === 'User');
      expect(prjcaseAction).toBeDefined();
    });

    it('should not generate prjcase when link already exists', () => {
      const registry = createRegistry();
      const applySet = new Set<string>();
      applySet.add('Crm.User');
      registry.eventApply.set('Crm.UserCreated', applySet);

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'info-elem',
        type: 'information',
        name: 'user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'information', 'user', 'Crm', 1)
        ],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      const prjcaseActions = result.actions.filter(a => a.kind === 'prjcase');
      expect(prjcaseActions).toHaveLength(0);
    });

    it('should generate the information itself before the prjcase when the counterpart is not registered', () => {
      // R5 prerequisite: the information counterpart lives in another slice
      // and is not in the registry -> information action precedes prjcase.
      const registry = createRegistry();

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'info-other-slice',
        type: 'information',
        name: 'user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      const infoAction = result.actions.find(a => a.kind === 'information' && a.name === 'User');
      const prjcaseAction = result.actions.find(a => a.kind === 'prjcase' && a.name === 'User');
      expect(infoAction).toBeDefined();
      expect(prjcaseAction).toBeDefined();
      expect(result.actions.indexOf(infoAction!)).toBeLessThan(result.actions.indexOf(prjcaseAction!));
    });

    it('should not re-generate the information when the counterpart is registered', () => {
      const registry = createRegistry();
      registry.informationFolders.add('Crm.User');

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'info-other-slice',
        type: 'information',
        name: 'user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      expect(result.actions.find(a => a.kind === 'information' && a.name === 'User')).toBeUndefined();
      expect(result.actions.find(a => a.kind === 'prjcase' && a.name === 'User')).toBeDefined();
    });

    it('should block prjcase when cross-context', () => {
      const registry = createRegistry();

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'info-elem',
        type: 'information',
        name: 'user',
        context: 'Other',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'information', 'user', 'Other', 1)
        ],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      const blockedAction = result.actions.find(a => a.kind === 'blocked' && a.name === 'User');
      expect(blockedAction).toBeDefined();
      expect(blockedAction!.reason).toBe('event and information must be in the same context');
    });
  });

  describe('R6: Event -> Automation (event automation)', () => {
    it('should generate on action when event -> automation', () => {
      const registry = createRegistry();

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'auto-elem',
        type: 'automation',
        name: 'send-welcome',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'automation', 'send-welcome', 'Crm', 1)
        ],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      const onAction = result.actions.find(a => a.kind === 'on' && a.name === 'SendWelcome');
      expect(onAction).toBeDefined();
    });

    it('should not generate on when automation already registered as job', () => {
      const registry = createRegistry();
      registry.jobs.set('Crm.SendWelcome', {todoList: 'Crm.TodoList'});

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'auto-elem',
        type: 'automation',
        name: 'send-welcome',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'automation', 'send-welcome', 'Crm', 1)
        ],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      const onActions = result.actions.filter(a => a.kind === 'on');
      expect(onActions).toHaveLength(0);
    });

    it('should block automation when cross-context', () => {
      const registry = createRegistry();

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'auto-elem',
        type: 'automation',
        name: 'send-welcome',
        context: 'Other',
        chapterId: 'chapter1'
      });

      // The automation also needs a graph with an event source so R4 doesn't
      // fire "no sources → blocked" before R6 gets to check cross-context.
      const autoGraph = createGraph('elem2', 'automation', 'send-welcome', 'Other');
      autoGraph.sources.push({
        id: 'elem1',
        type: 'event',
        name: 'user-created',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'automation', 'send-welcome', 'Other', 1)
        ],
        graphs: new Map([['elem1', eventGraph], ['elem2', autoGraph]]),
        registry
      };

      const result = plan(input);
      const blockedAction = result.actions.find(a => a.kind === 'blocked' && a.name === 'SendWelcome');
      expect(blockedAction).toBeDefined();
      expect(blockedAction!.reason).toBe('event and automation must be in the same context');
    });
  });

  describe('R7: Information -> Automation (job automation)', () => {
    it('should generate job action when information -> automation', () => {
      const registry = createRegistry();

      const infoGraph = createGraph('elem1', 'information', 'todo-list', 'Crm');
      infoGraph.targets.push({
        id: 'auto-elem',
        type: 'automation',
        name: 'process-todo',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'information', 'todo-list', 'Crm', 0),
          createElement('elem2', 'automation', 'process-todo', 'Crm', 1)
        ],
        graphs: new Map([['elem1', infoGraph]]),
        registry
      };

      const result = plan(input);
      const jobAction = result.actions.find(a => a.kind === 'job' && a.name === 'ProcessTodo');
      expect(jobAction).toBeDefined();
    });

    it('should block job when information and automation are in different contexts', () => {
      const registry = createRegistry();

      const infoGraph = createGraph('elem1', 'information', 'todo-list', 'Crm');
      infoGraph.targets.push({
        id: 'auto-elem',
        type: 'automation',
        name: 'process-todo',
        context: 'Other',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'information', 'todo-list', 'Crm', 0),
          createElement('elem2', 'automation', 'process-todo', 'Other', 1)
        ],
        graphs: new Map([['elem1', infoGraph]]),
        registry
      };

      const result = plan(input);
      const blockedAction = result.actions.find(a => a.kind === 'blocked' && a.name === 'ProcessTodo');
      expect(blockedAction).toBeDefined();
      expect(blockedAction!.reason).toBe('information and automation must be in the same context');
      expect(result.actions.find(a => a.kind === 'job')).toBeUndefined();
    });

    it('should generate both on and job when automation has both sources', () => {
      const registry = createRegistry();

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'auto-elem',
        type: 'automation',
        name: 'send-welcome',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const infoGraph = createGraph('elem2', 'information', 'todo-list', 'Crm');
      infoGraph.targets.push({
        id: 'auto-elem',
        type: 'automation',
        name: 'send-welcome',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'information', 'todo-list', 'Crm', 1),
          createElement('elem3', 'automation', 'send-welcome', 'Crm', 2)
        ],
        graphs: new Map([
          ['elem1', eventGraph],
          ['elem2', infoGraph]
        ]),
        registry
      };

      const result = plan(input);
      const onActions = result.actions.filter(a => a.kind === 'on');
      const jobActions = result.actions.filter(a => a.kind === 'job');
      expect(onActions).toHaveLength(1);
      expect(jobActions).toHaveLength(1);
    });
  });

  describe('R8: Ordering and de-duplication', () => {
    it('should order actions by phase', () => {
      const registry = createRegistry();

      // Create event graph with command source
      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.sources.push({
        id: 'cmd-elem',
        type: 'command',
        name: 'create-user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      // Create information graph with event source for prjcase
      const infoGraph = createGraph('elem2', 'information', 'user', 'Crm');
      infoGraph.sources.push({
        id: 'elem1',
        type: 'event',
        name: 'user-created',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'information', 'user', 'Crm', 1)
        ],
        graphs: new Map([
          ['elem1', eventGraph],
          ['elem2', infoGraph]
        ]),
        registry
      };

      const result = plan(input);
      const phases = result.actions.map(a => a.kind);
      expect(phases).toEqual(['context', 'command', 'event', 'information', 'prjcase']);
    });

    it('should deduplicate actions by key', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'command', 'create-user', 'Crm', 0),
          createElement('elem2', 'command', 'create-user', 'Crm', 1) // duplicate
        ],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      const commandActions = result.actions.filter(a => a.kind === 'command');
      expect(commandActions).toHaveLength(1);
    });
  });

  describe('R9: Slice-local scope for known', () => {
    it('should only emit known for elements in the triggering slice', () => {
      const registry = createRegistry();
      registry.commands.add('Crm.CreateUser');

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'command', 'create-user', 'Crm', 0, 'chapter1')
        ],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      const knownAction = result.actions.find(a => a.kind === 'known' && a.name === 'CreateUser');
      expect(knownAction).toBeDefined();
    });

    it('should set commentTarget to the counterpart element with its own chapterId', () => {
      const registry = createRegistry();

      // The information counterpart lives in another chapter; the prjcase
      // comment must be posted there, not in the triggering chapter.
      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'info-other-chapter',
        type: 'information',
        name: 'user',
        context: 'Crm',
        chapterId: 'chapter-2'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [createElement('elem1', 'event', 'user-created', 'Crm', 0)],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      const prjcaseAction = result.actions.find(a => a.kind === 'prjcase');
      expect(prjcaseAction).toBeDefined();
      expect(prjcaseAction!.commentTarget).toEqual({
        elementId: 'info-other-chapter',
        chapterId: 'chapter-2',
        sliceId: undefined,
        chapterName: undefined
      });
    });
  });

  describe('R10: Skips for missing graph', () => {
    it('should generate plan without links when graph is missing', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'automation', 'send-welcome', 'Crm', 0)
        ],
        graphs: new Map(), // No graph
        registry
      };

      const result = plan(input);
      const blockedAction = result.actions.find(a => a.kind === 'blocked' && a.name === 'SendWelcome');
      expect(blockedAction).toBeDefined();
    });

    it('should record a note when a graph is missing (degraded plan)', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0)
        ],
        graphs: new Map(), // graph call failed
        registry
      };

      const result = plan(input);
      const note = result.notes.find(n => n.id === 'missing-graph' && n.elementId === 'elem1');
      expect(note).toBeDefined();
    });
  });

  describe('Names: unresolvable elements', () => {
    it('should block an element whose name cannot be converted to a valid PascalCase identifier and record a note', () => {
      const registry = createRegistry();

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'command', '!!!', 'Crm', 0) // normalises to ''
        ],
        graphs: new Map(),
        registry
      };

      const result = plan(input);
      const blockedAction = result.actions.find(a => a.kind === 'blocked');
      expect(blockedAction).toBeDefined();
      expect(blockedAction!.reason).toBe('invalid name for codegen');
      // no codegen action for the element
      expect(result.actions.find(a => a.kind === 'command')).toBeUndefined();
      // note recorded
      const note = result.notes.find(n => n.id === 'unresolvable-name' && n.elementId === 'elem1');
      expect(note).toBeDefined();
    });
  });

  describe('Idempotency', () => {
    it('should produce empty action list when re-planning after applying plan', () => {
      const registry = createRegistry();
      registry.contexts.add('Crm');
      registry.commands.add('Crm.CreateUser');
      registry.events.add('Crm.UserCreated');
      registry.informationFolders.add('Crm.User');
      const applySet = new Set<string>();
      applySet.add('Crm.User');
      registry.eventApply.set('Crm.UserCreated', applySet);

      const graph = createGraph('elem1', 'event', 'user-created', 'Crm');
      graph.targets.push({
        id: 'info-elem',
        type: 'information',
        name: 'user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'information', 'user', 'Crm', 1)
        ],
        graphs: new Map([['elem1', graph]]),
        registry
      };

      const result = plan(input);
      // All actions should be 'known' since everything is registered
      expect(result.actions.every(a => a.kind === 'known')).toBe(true);
    });
  });

  describe('Snapshot test for stable output', () => {
    it('should produce consistent output for a typical slice', () => {
      const registry = createRegistry();

      const eventGraph = createGraph('elem1', 'event', 'user-created', 'Crm');
      eventGraph.targets.push({
        id: 'info-elem',
        type: 'information',
        name: 'user',
        context: 'Crm',
        chapterId: 'chapter1'
      });

      const input: PlanInput = {
        slice: {id: 'slice1', chapterId: 'chapter1'},
        elements: [
          createElement('elem1', 'event', 'user-created', 'Crm', 0),
          createElement('elem2', 'information', 'user', 'Crm', 1)
        ],
        graphs: new Map([['elem1', eventGraph]]),
        registry
      };

      const result = plan(input);
      expect(result).toMatchSnapshot();
    });
  });
});
