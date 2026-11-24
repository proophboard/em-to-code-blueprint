// Executor tests - L3 (faked I/O boundaries)
// Covers the "Executor semantics" from specs/bridge/planning-rules.md:
// - registry re-read + skip-when-satisfied
// - CLI success/failure handling and (transitive) dependant skips
// - task comment posting, idempotency via open markers
// - comments on counterpart elements via action.commentTarget
// - dry-run mode

import {describe, it, expect} from 'vitest';
import {
  execute,
  buildArgs,
  isAlreadySatisfied,
  type ExecutorDeps,
  type ActionResult
} from './executor.js';
import type {
  Action,
  BoardElement,
  CodegenRunner,
  DependencyGraph,
  Logger,
  Plan,
  ProophClient,
  RegistryReader,
  RegistrySnapshot
} from './model.js';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeCodegen implements CodegenRunner {
  calls: string[][] = [];
  /** map from args.join(' ') to the failure the runner should produce */
  failures = new Map<string, {exitCode: number; stderr: string}>();

  async run(args: string[]) {
    this.calls.push(args);
    const failure = this.failures.get(args.join(' '));
    if (failure) {
      return {ok: false, exitCode: failure.exitCode, stdout: '', stderr: failure.stderr};
    }
    return {ok: true, exitCode: 0, stdout: 'generated', stderr: ''};
  }
}

class FakeRegistry implements RegistryReader {
  readCount = 0;
  constructor(public snap: RegistrySnapshot) {}
  read() {
    this.readCount++;
    return this.snap;
  }
}

class FakeProoph implements ProophClient {
  comments: {chapterId: string; elementId: string; text: string}[] = [];
  graphs = new Map<string, DependencyGraph>();
  slices = new Map<string, {label: string; elements: BoardElement[]}>();
  sliceCalls: string[] = [];
  commentError: Error | null = null;

  async getSliceElements(chapterId: string, sliceId: string): Promise<{
    slice: { id: string; chapterId: string; label?: string };
    elements: BoardElement[];
    chapterName: string;
  }> {
    this.sliceCalls.push(`${chapterId}/${sliceId}`);
    const s = this.slices.get(`${chapterId}/${sliceId}`);
    if (!s) {
      throw new Error(`Slice ${sliceId} not found in chapter ${chapterId}`);
    }
    return { slice: { id: sliceId, chapterId, label: s.label }, elements: s.elements, chapterName: 'X' };
  }
  async getDependencyGraph(chapterId: string, elementId: string) {
    const graph = this.graphs.get(`${chapterId}/${elementId}`);
    if (!graph) {
      throw new Error('404 Not Found');
    }
    return graph;
  }
  async addTaskComment(chapterId: string, elementId: string, text: string) {
    if (this.commentError) {
      throw this.commentError;
    }
    this.comments.push({chapterId, elementId, text});
  }
}

function createLogger(): Logger & {messages: string[]} {
  const messages: string[] = [];
  return {
    messages,
    info: m => messages.push(`info:${m}`),
    warn: m => messages.push(`warn:${m}`),
    error: m => messages.push(`error:${m}`)
  };
}

function emptyRegistry(): RegistrySnapshot {
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

function createElement(
  id: string,
  type: BoardElement['type'],
  name: string,
  context = 'Crm',
  chapterId = 'chapter-1',
  comments: BoardElement['comments'] = []
): BoardElement {
  return {
    id,
    index: 0,
    type,
    name,
    context,
    chapterId,
    chapterName: 'Chapter One',
    description: '',
    details: '',
    icon: '',
    laneId: 'lane-1',
    sliceId: 'slice-1',
    comments
  };
}

function createDeps(overrides: Partial<{codegen: FakeCodegen; registry: FakeRegistry; prooph: FakeProoph; logger: Logger & {messages: string[]}}> = {}) {
  const codegen = overrides.codegen ?? new FakeCodegen();
  const registry = overrides.registry ?? new FakeRegistry(emptyRegistry());
  const prooph = overrides.prooph ?? new FakeProoph();
  const logger = overrides.logger ?? createLogger();
  const deps: ExecutorDeps = {codegen, registry, prooph, logger};
  return {codegen, registry, prooph, logger, deps};
}

function planOf(actions: Action[]): Plan {
  return {actions, notes: []};
}

// ---------------------------------------------------------------------------
// buildArgs
// ---------------------------------------------------------------------------

describe('buildArgs', () => {
  it('maps each action kind to its codegen subcommand', () => {
    const cases: Array<[Action, string[] | null]> = [
      [{kind: 'context', key: 'context:Crm', context: 'Crm'}, ['context', 'Crm']],
      [{kind: 'command', key: 'command:Crm.CreateUser', context: 'Crm', name: 'CreateUser'}, ['command', 'Crm', 'CreateUser']],
      [{kind: 'event', key: 'event:Crm.UserCreated', context: 'Crm', name: 'UserCreated', targetName: 'CreateUser'}, ['event', 'Crm', 'CreateUser', 'UserCreated']],
      [{kind: 'information', key: 'information:Crm.User', context: 'Crm', name: 'User'}, ['information', 'Crm', 'User']],
      [{kind: 'prjcase', key: 'prjcase:Crm.User<-Crm.UserCreated', context: 'Crm', name: 'User', targetName: 'UserCreated'}, ['prjcase', 'Crm', 'User', 'UserCreated']],
      [{kind: 'on', key: 'on:Crm.Send<-Crm.UserCreated', context: 'Crm', name: 'Send', targetName: 'UserCreated'}, ['on', 'Crm', 'UserCreated', 'Send']],
      [{kind: 'job', key: 'job:Crm.Send<-Crm.Todo', context: 'Crm', name: 'Send', targetName: 'Todo'}, ['job', 'Crm', 'Todo', 'Send']],
      [{kind: 'known', key: 'known:Crm.CreateUser'}, null],
      [{kind: 'blocked', key: 'blocked:Crm.X'}, null]
    ];

    for (const [action, expected] of cases) {
      expect(buildArgs(action, false), `${action.kind}`).toEqual(expected);
    }
  });

  it('adds --event-sourced for context actions', () => {
    expect(buildArgs({kind: 'context', key: 'context:Crm', context: 'Crm'}, true))
      .toEqual(['context', 'Crm', '--event-sourced']);
  });
});

// ---------------------------------------------------------------------------
// isAlreadySatisfied
// ---------------------------------------------------------------------------

describe('isAlreadySatisfied', () => {
  it('detects satisfied effects per action kind', () => {
    const registry = emptyRegistry();
    registry.contexts.add('Crm');
    registry.commands.add('Crm.CreateUser');
    registry.events.add('Crm.UserCreated');
    registry.informationFolders.add('Crm.User');
    registry.jobs.set('Crm.ProcessTodo', {todoList: 'Crm.Todo'});
    registry.eventApply.set('Crm.UserCreated', new Set(['Crm.User']));
    registry.eventAutomate.set('Crm.UserCreated', new Set(['Crm.SendWelcome']));

    const cases: Array<[Action, boolean]> = [
      [{kind: 'context', key: 'context:Crm', context: 'Crm'}, true],
      [{kind: 'context', key: 'context:X', context: 'X'}, false],
      [{kind: 'command', key: 'command:Crm.CreateUser', context: 'Crm', name: 'CreateUser'}, true],
      [{kind: 'command', key: 'command:Crm.Other', context: 'Crm', name: 'Other'}, false],
      [{kind: 'event', key: 'event:Crm.UserCreated', context: 'Crm', name: 'UserCreated'}, true],
      [{kind: 'information', key: 'information:Crm.User', context: 'Crm', name: 'User'}, true],
      [{kind: 'prjcase', key: 'prjcase:Crm.User<-Crm.UserCreated', context: 'Crm', name: 'User', eventFqcn: 'Crm.UserCreated', infoFqcn: 'Crm.User'}, true],
      [{kind: 'prjcase', key: 'prjcase:Crm.Other<-Crm.UserCreated', context: 'Crm', name: 'Other', eventFqcn: 'Crm.UserCreated', infoFqcn: 'Crm.Other'}, false],
      [{kind: 'on', key: 'on:Crm.SendWelcome<-Crm.UserCreated', context: 'Crm', name: 'SendWelcome', eventFqcn: 'Crm.UserCreated', autoFqcn: 'Crm.SendWelcome'}, true],
      [{kind: 'job', key: 'job:Crm.ProcessTodo<-Crm.Todo', context: 'Crm', name: 'ProcessTodo', infoFqcn: 'Crm.Todo', autoFqcn: 'Crm.ProcessTodo'}, true]
    ];

    for (const [action, expected] of cases) {
      expect(isAlreadySatisfied(action, registry), action.key).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// execute()
// ---------------------------------------------------------------------------

describe('execute', () => {
  it('runs codegen per action and posts a task comment', async () => {
    const element = createElement('elem-1', 'command', 'CreateUser');
    const {codegen, registry, prooph, deps} = createDeps();

    const action: Action = {
      kind: 'command',
      key: 'command:Crm.CreateUser',
      context: 'Crm',
      name: 'CreateUser',
      command: 'CreateUser',
      commentTarget: {elementId: 'elem-1', chapterId: 'chapter-1'}
    };

    const result = await execute(planOf([action]), [element], deps, {
      chapterName: 'Chapter One',
      sliceLabel: 'Slice 1'
    });

    expect(result.success).toBe(true);
    expect(codegen.calls).toEqual([['command', 'Crm', 'CreateUser']]);
    expect(prooph.comments).toHaveLength(1);
    expect(prooph.comments[0].chapterId).toBe('chapter-1');
    expect(prooph.comments[0].elementId).toBe('elem-1');
    expect(prooph.comments[0].text).toContain('[em-to-code-blueprint:command:Crm.CreateUser]');
    expect(result.results[0].status).toBe('ok');
    expect(result.results[0].commentPosted).toBe(true);
  });

  it('re-reads the registry before every action and skips satisfied ones', async () => {
    const registry = new FakeRegistry(emptyRegistry());
    registry.snap.contexts.add('Crm');
    registry.snap.commands.add('Crm.CreateUser');
    const {codegen, deps} = createDeps({registry});

    const actions: Action[] = [
      {kind: 'command', key: 'command:Crm.CreateUser', context: 'Crm', name: 'CreateUser',
        commentTarget: {elementId: 'elem-1', chapterId: 'chapter-1'}}
    ];

    const element = createElement('elem-1', 'command', 'CreateUser');
    const result = await execute(planOf(actions), [element], deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(registry.readCount).toBe(1); // re-read before the action
    expect(codegen.calls).toHaveLength(0); // already satisfied -> no CLI
    expect(result.results[0].status).toBe('skipped');
  });

  it('does not post comments for context actions', async () => {
    const {codegen, prooph, deps} = createDeps();
    const action: Action = {kind: 'context', key: 'context:Crm', context: 'Crm'};

    const result = await execute(planOf([action]), [], deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(codegen.calls).toEqual([['context', 'Crm']]);
    expect(prooph.comments).toHaveLength(0);
    expect(result.results[0].status).toBe('ok');
    expect(result.results[0].commentPosted).toBe(false);
  });

  it('skips dependants transitively when an upstream action fails', async () => {
    const codegen = new FakeCodegen();
    codegen.failures.set('command Crm CreateUser', {exitCode: 1, stderr: 'boom'});
    const {deps} = createDeps({codegen});

    const elements = [
      createElement('elem-cmd', 'command', 'CreateUser'),
      createElement('elem-evt', 'event', 'UserCreated'),
      createElement('elem-info', 'information', 'User')
    ];

    const actions: Action[] = [
      {kind: 'command', key: 'command:Crm.CreateUser', context: 'Crm', name: 'CreateUser',
        commentTarget: {elementId: 'elem-cmd', chapterId: 'chapter-1'}},
      {kind: 'event', key: 'event:Crm.UserCreated', context: 'Crm', name: 'UserCreated', targetName: 'CreateUser',
        event: 'UserCreated', command: 'CreateUser', eventFqcn: 'Crm.UserCreated',
        commentTarget: {elementId: 'elem-evt', chapterId: 'chapter-1'}},
      {kind: 'prjcase', key: 'prjcase:Crm.User<-Crm.UserCreated', context: 'Crm', name: 'User', targetName: 'UserCreated',
        information: 'User', event: 'UserCreated', eventFqcn: 'Crm.UserCreated', infoFqcn: 'Crm.User',
        commentTarget: {elementId: 'elem-info', chapterId: 'chapter-1'}}
    ];

    const result = await execute(planOf(actions), elements, deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(result.results.map(r => r.status)).toEqual(['failed', 'dependant-skipped', 'dependant-skipped']);
    // prjcase depends on the event, which itself was skipped -> transitive skip
    expect(codegen.calls).toEqual([['command', 'Crm', 'CreateUser']]);
    expect(result.success).toBe(false);
  });

  it('does not block dependants of a satisfied (skipped) action', async () => {
    const registry = new FakeRegistry(emptyRegistry());
    registry.snap.contexts.add('Crm');
    registry.snap.commands.add('Crm.CreateUser'); // satisfied -> skipped
    const {codegen, prooph, deps} = createDeps({registry});

    const elements = [
      createElement('elem-cmd', 'command', 'CreateUser'),
      createElement('elem-evt', 'event', 'UserCreated')
    ];

    const actions: Action[] = [
      {kind: 'command', key: 'command:Crm.CreateUser', context: 'Crm', name: 'CreateUser',
        commentTarget: {elementId: 'elem-cmd', chapterId: 'chapter-1'}},
      {kind: 'event', key: 'event:Crm.UserCreated', context: 'Crm', name: 'UserCreated', targetName: 'CreateUser',
        event: 'UserCreated', command: 'CreateUser', eventFqcn: 'Crm.UserCreated',
        commentTarget: {elementId: 'elem-evt', chapterId: 'chapter-1'}}
    ];

    const result = await execute(planOf(actions), elements, deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(result.results.map(r => r.status)).toEqual(['skipped', 'ok']);
    expect(codegen.calls).toEqual([['event', 'Crm', 'CreateUser', 'UserCreated']]);
    expect(prooph.comments).toHaveLength(1);
  });

  it('skips comment posting when an open task with the same marker exists', async () => {
    const element = createElement('elem-1', 'command', 'CreateUser', 'Crm', 'chapter-1', [
      {
        id: 'c-1',
        text: '[em-to-code-blueprint:command:Crm.CreateUser]\n\nolder task',
        isTask: true,
        user: 'bridge',
        userId: 'u',
        createdAt: 'x'
      }
    ]);
    const {codegen, prooph, deps} = createDeps();

    const action: Action = {
      kind: 'command',
      key: 'command:Crm.CreateUser',
      context: 'Crm',
      name: 'CreateUser',
      commentTarget: {elementId: 'elem-1', chapterId: 'chapter-1'}
    };

    const result = await execute(planOf([action]), [element], deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(codegen.calls).toHaveLength(1); // codegen still ran
    expect(prooph.comments).toHaveLength(0); // but no duplicate task comment
    expect(result.results[0].status).toBe('ok');
    expect(result.results[0].commentPosted).toBe(false);
  });

  it('posts comments on counterpart elements in other chapters via commentTarget', async () => {
    const {codegen, prooph, deps} = createDeps();

    // The information element lives in another chapter -> not in `elements`.
    const counterpart = createElement('info-other', 'information', 'User', 'Crm', 'chapter-2');
    counterpart.comments = [];
    prooph.slices.set('chapter-2/slice-2', {label: 'Slice 2', elements: [counterpart]});

    const sliceEvent = createElement('elem-evt', 'event', 'UserCreated', 'Crm', 'chapter-1');

    const action: Action = {
      kind: 'prjcase',
      key: 'prjcase:Crm.User<-Crm.UserCreated',
      context: 'Crm',
      name: 'User',
      targetName: 'UserCreated',
      information: 'User',
      event: 'UserCreated',
      eventFqcn: 'Crm.UserCreated',
      infoFqcn: 'Crm.User',
      commentTarget: {elementId: 'info-other', chapterId: 'chapter-2', chapterName: 'Chapter Two', sliceId: 'slice-2'}
    };

    const result = await execute(planOf([action]), [sliceEvent], deps, {chapterName: 'Chapter One', sliceLabel: 'Slice 1'});

    expect(codegen.calls).toEqual([['prjcase', 'Crm', 'User', 'UserCreated']]);
    expect(prooph.sliceCalls).toEqual(['chapter-2/slice-2']);
    expect(prooph.comments).toHaveLength(1);
    // posted to the counterpart's own chapter (api-contracts 2.3)
    expect(prooph.comments[0].chapterId).toBe('chapter-2');
    expect(prooph.comments[0].elementId).toBe('info-other');
    expect(prooph.comments[0].text).toContain('chapter Chapter Two (chapter-2)');
    expect(result.results[0].commentPosted).toBe(true);
  });

  it('honours the open-marker check fetched via the counterpart slice elements', async () => {
    const {codegen, prooph, deps} = createDeps();

    const counterpart = createElement('info-other', 'information', 'User', 'Crm', 'chapter-2', [
      {
        id: 'c-9',
        text: '[em-to-code-blueprint:prjcase:Crm.User<-Crm.UserCreated]\n\nexisting task',
        isTask: true,
        user: 'bridge',
        userId: 'u',
        createdAt: 'x'
      }
    ]);
    // the graph response's element carries no comments — the marker check must
    // fetch the counterpart's slice elements instead (commentTarget.sliceId)
    prooph.graphs.set('chapter-2/info-other', {element: {...counterpart, comments: []}, sources: [], targets: []});
    prooph.slices.set('chapter-2/slice-other', {label: 'Slice Other', elements: [counterpart]});

    const action: Action = {
      kind: 'prjcase',
      key: 'prjcase:Crm.User<-Crm.UserCreated',
      context: 'Crm',
      name: 'User',
      targetName: 'UserCreated',
      eventFqcn: 'Crm.UserCreated',
      infoFqcn: 'Crm.User',
      commentTarget: {elementId: 'info-other', chapterId: 'chapter-2', sliceId: 'slice-other'}
    };

    const result = await execute(planOf([action]), [], deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(codegen.calls).toHaveLength(1); // codegen ran
    expect(prooph.sliceCalls).toEqual(['chapter-2/slice-other']);
    expect(prooph.comments).toHaveLength(0); // marker already open -> no repost
  });

  it('still posts the counterpart comment when the counterpart slice fetch fails', async () => {
    const {codegen, prooph, deps} = createDeps();
    // no slice registered for 'slice-missing' -> getSliceElements throws

    const action: Action = {
      kind: 'on',
      key: 'on:Crm.SendWelcome<-Crm.UserCreated',
      context: 'Crm',
      name: 'SendWelcome',
      targetName: 'UserCreated',
      automation: 'SendWelcome',
      event: 'UserCreated',
      eventFqcn: 'Crm.UserCreated',
      autoFqcn: 'Crm.SendWelcome',
      commentTarget: {elementId: 'auto-elsewhere', chapterId: 'chapter-2', sliceId: 'slice-missing'}
    };

    const result = await execute(planOf([action]), [], deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(codegen.calls).toHaveLength(1);
    expect(prooph.comments).toHaveLength(1); // posted without marker check
    expect(prooph.comments[0].chapterId).toBe('chapter-2');
  });

  it('marks the action failed-comment when the comment POST fails', async () => {
    const prooph = new FakeProoph();
    prooph.commentError = new Error('503 Service Unavailable');
    const {deps} = createDeps({prooph});

    const element = createElement('elem-1', 'command', 'CreateUser');
    const action: Action = {
      kind: 'command',
      key: 'command:Crm.CreateUser',
      context: 'Crm',
      name: 'CreateUser',
      commentTarget: {elementId: 'elem-1', chapterId: 'chapter-1'}
    };

    const result = await execute(planOf([action]), [element], deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(result.results[0].status).toBe('failed-comment');
    expect(result.results[0].commentError).toContain('503');
    expect(result.success).toBe(false);
  });

  it('falls back to FQCN matching when no commentTarget is set', async () => {
    const {codegen, prooph, deps} = createDeps();
    const element = createElement('elem-1', 'command', 'create-user'); // raw board name

    const action: Action = {
      kind: 'command',
      key: 'command:Crm.CreateUser',
      context: 'Crm',
      name: 'CreateUser'
      // no commentTarget
    };

    const result = await execute(planOf([action]), [element], deps, {chapterName: 'C', sliceLabel: 'S'});

    expect(prooph.comments).toHaveLength(1);
    expect(prooph.comments[0].elementId).toBe('elem-1');
  });

  it('dry-run prints the plan and performs no side effects', async () => {
    const {codegen, prooph, logger, deps} = createDeps();
    const action: Action = {kind: 'command', key: 'command:Crm.CreateUser', context: 'Crm', name: 'CreateUser'};

    const result = await execute(planOf([action]), [], deps, {dryRun: true});

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(codegen.calls).toHaveLength(0);
    expect(prooph.comments).toHaveLength(0);
    expect(logger.messages.some(m => m.includes('"dryRun": true'))).toBe(true);
  });
});
