// L4 integration tests: real codegen subprocesses in a sandboxed project.
//
// Covers the Step-8 requirements:
// - full chain context -> command -> event -> information -> prjcase -> on -> job
// - contract test: registry-reader reads what codegen wrote
// - validation failures return ok:false with stderr, never throw
// - hostile arguments cannot reach the shell (execFile, no interpolation)
// - task-comment {files} paths exist on disk
// - tests NEVER run codegen against the repository's own src/domain

import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {existsSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCodegenRunner} from './codegen-runner.js';
import {createSandboxProject, type SandboxProject} from './testing/sandbox-project.js';
import {readRegistrySnapshot} from '../lib/helpers/registry-reader.js';
import {plan, type PlanInput} from './planner.js';
import type {BoardElement, DependencyGraph, RegistrySnapshot} from './model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// A whole subprocess chain takes a while; allow generous timeouts.
const L4_TIMEOUT = 120_000;

function element(id: string, type: BoardElement['type'], name: string, context = 'Crm'): BoardElement {
  return {
    id,
    index: 0,
    type,
    name,
    context,
    chapterId: 'chapter-1',
    chapterName: 'Chapter One',
    description: '',
    details: '',
    icon: '',
    laneId: 'lane-1',
    sliceId: 'slice-1',
    comments: []
  };
}

function node(id: string, type: BoardElement['type'], name: string, context = 'Crm') {
  return {id, type, name, context, chapterId: 'chapter-1', sliceId: 'slice-1'};
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

describe('codegen-runner (L4, sandboxed project)', () => {
  let sandbox: SandboxProject;
  let runner: ReturnType<typeof createCodegenRunner>;

  beforeAll(() => {
    sandbox = createSandboxProject(REPO_ROOT);
    runner = createCodegenRunner({cwd: sandbox.root});
  });

  afterAll(() => {
    sandbox.cleanup();
  });

  it('runs the full codegen chain in the sandbox, never touching the repo src/domain', async () => {
    const chain: string[][] = [
      ['context', 'Crm'],
      ['command', 'Crm', 'CreateUser'],
      ['event', 'Crm', 'CreateUser', 'UserCreated'],
      ['information', 'Crm', 'User'],
      ['prjcase', 'Crm', 'User', 'UserCreated'],
      ['on', 'Crm', 'UserCreated', 'SendWelcome'],
      ['information', 'Crm', 'TodoList'],
      ['job', 'Crm', 'TodoList', 'ProcessTodo']
    ];

    for (const args of chain) {
      const result = await runner.run(args);
      expect(result.ok, `${args.join(' ')} -> ${result.stderr}`).toBe(true);
    }

    // Safety: the sandbox domain is populated ...
    expect(existsSync(join(sandbox.domainPath, 'crm'))).toBe(true);
    // ... and the repository's own src/domain was never written by this test.
    const repoDomain = join(REPO_ROOT, 'src', 'domain', 'crm');
    expect(existsSync(repoDomain)).toBe(false);
  }, L4_TIMEOUT);

  it('reads back generated registrations via registry-reader (contract)', async () => {
    const snapshot = readRegistrySnapshot(sandbox.domainPath);

    expect(snapshot.contexts.has('Crm')).toBe(true);
    expect(snapshot.commands.has('Crm.CreateUser')).toBe(true);
    expect(snapshot.events.has('Crm.UserCreated')).toBe(true);
    expect(snapshot.informationFolders.has('Crm.User')).toBe(true);
    expect(snapshot.queries.has('Crm.User')).toBe(true);
    // prjcase -> apply entry in events.ts
    expect(snapshot.eventApply.get('Crm.UserCreated')?.has('Crm.User')).toBe(true);
    // on -> automate entry in events.ts
    expect(snapshot.eventAutomate.get('Crm.UserCreated')?.has('Crm.SendWelcome')).toBe(true);
    // job -> job-automations.ts with its todo list
    expect(snapshot.jobs.get('Crm.ProcessTodo')?.todoList).toBe('Crm.TodoList');
  }, L4_TIMEOUT);

  it('produces files on disk that the task comments reference ({files})', async () => {
    // Build a plan matching the slice that was generated above and assert
    // every path the planner put into action.files/registryFile exists.
    const elements: BoardElement[] = [
      element('cmd-1', 'command', 'CreateUser'),
      element('evt-1', 'event', 'UserCreated'),
      element('info-user', 'information', 'User'),
      element('info-todo', 'information', 'TodoList'),
      element('auto-1', 'automation', 'SendWelcome'),
      element('auto-2', 'automation', 'ProcessTodo')
    ];

    const evtGraph: DependencyGraph = {
      element: elements[1],
      sources: [node('cmd-1', 'command', 'CreateUser')],
      targets: [
        node('info-user', 'information', 'User'),
        node('auto-1', 'automation', 'SendWelcome')
      ]
    };
    const auto1Graph: DependencyGraph = {
      element: elements[4],
      sources: [node('evt-1', 'event', 'UserCreated')],
      targets: []
    };
    const auto2Graph: DependencyGraph = {
      element: elements[5],
      sources: [node('info-todo', 'information', 'TodoList')],
      targets: []
    };

    const input: PlanInput = {
      slice: {id: 'slice-1', chapterId: 'chapter-1'},
      elements,
      graphs: new Map([
        ['evt-1', evtGraph],
        ['auto-1', auto1Graph],
        ['auto-2', auto2Graph]
      ]),
      registry: emptyRegistry()
    };

    const {actions} = plan(input);
    const referenced = actions.flatMap(a => [...(a.files ?? []), ...(a.registryFile ? [a.registryFile] : [])]);
    expect(referenced.length).toBeGreaterThan(0);

    for (const file of referenced) {
      expect(existsSync(join(sandbox.root, file)), file).toBe(true);
    }
  }, L4_TIMEOUT);

  it('returns ok:false with stderr for invalid invocations and never throws', async () => {
    // command into a context that does not exist in the sandbox
    const result = await runner.run(['command', 'NoSuchContext', 'CreateUser']);

    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);

    // invalid subcommand name reaches the CLI usage error, not a crash
    const bad = await runner.run(['definitely-not-a-command']);
    expect(bad.ok).toBe(false);
  }, L4_TIMEOUT);

  it('passes a hostile argument literally to the CLI - no shell, no file created', async () => {
    // If the runner used a shell, $(touch pwned) would create ./pwned.
    const result = await runner.run(['context', '$(touch pwned)']);

    // CLI rejects the name (not a valid PascalCase context) ...
    expect(result.ok).toBe(false);
    // ... and crucially nothing was executed as a shell command.
    expect(existsSync(join(sandbox.root, 'pwned'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'pwned'))).toBe(false);
  }, L4_TIMEOUT);
});
