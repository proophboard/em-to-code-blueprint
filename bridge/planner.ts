import {
  RegistrySnapshot,
  BoardElement,
  DependencyGraph,
  Plan,
  Action,
  ActionKind,
  Note,
  DependencyNode
} from './model.js';
import {
  toPascalCase,
  toKebab,
  isValidPascalCase,
  getCommandPath,
  getInformationPath,
  getAutomationPath,
  getProjectionCasePath,
  getRegistryFilePath
} from './naming.js';

/**
 * Plan input for the planner
 */
export type PlanInput = {
  slice: {id: string; chapterId: string};
  elements: BoardElement[];
  graphs: Map<string /*elementId*/, DependencyGraph>;
  registry: RegistrySnapshot;
};

/**
 * Main planner function - pure, deterministic
 * Implements rules R1-R10 from planning-rules.md
 */
export function plan(input: PlanInput): Plan {
  const {slice, elements, graphs, registry} = input;

  const actions: Action[] = [];
  const notes: Note[] = [];
  const seenKeys = new Set<string>();
  // Contexts created by this plan that have not yet been "announced" in a
  // comment; the first element action in such a context gets the note
  // (task-comments.md, "context note").
  const pendingNewContexts = new Set<string>();

  // Sort elements by index (API order) for stable output
  const sortedElements = [...elements].sort((a, b) => a.index - b.index);

  for (const element of sortedElements) {
    // R1: Element relevance - only command | event | information | automation
    if (!isRelevantType(element.type)) {
      continue;
    }

    const contextPascal = toPascalCase(element.context || 'App');
    const namePascal = toPascalCase(element.name);
    const fqcn = `${contextPascal}.${namePascal}`;

    // Names: if the normalised name does not satisfy the CLI pattern, the
    // element is unresolvable -> Note + explanatory task comment, no codegen.
    if (!isValidPascalCase(contextPascal) || !isValidPascalCase(namePascal)) {
      notes.push({
        id: 'unresolvable-name',
        elementId: element.id,
        message: `Element "${element.name}" in context "${element.context || 'App'}" cannot be converted to a valid PascalCase name for codegen.`
      });
      pushUnique(actions, seenKeys, {
        kind: 'blocked',
        key: `blocked:${fqcn}`,
        context: contextPascal,
        name: namePascal || element.name,
        reason: 'invalid name for codegen',
        hint: 'Rename the element or context on the board so it converts to PascalCase',
        commentTarget: {elementId: element.id, chapterId: element.chapterId, sliceId: element.sliceId, chapterName: element.chapterName}
      });
      continue;
    }

    // R10: If graph failed, skip links but process element itself (Note).
    const graph = graphs.get(element.id);
    const needsGraph = element.type === 'event' || element.type === 'information' || element.type === 'automation';
    if (needsGraph && !graph) {
      notes.push({
        id: 'missing-graph',
        elementId: element.id,
        message: `Dependency graph for ${fqcn} could not be loaded; its links were skipped.`
      });
    }

    const emitted: Action[] = [];

    // R2: Registered vs new
    const isRegistered = isElementRegistered(element, registry);

    if (isRegistered) {
      // Emit 'known' action for elements in this slice (R9)
      if (element.chapterId === slice.chapterId) {
        const knownAction: Action = {
          kind: 'known',
          key: `known:${fqcn}`,
          context: contextPascal,
          name: namePascal,
          commentTarget: {elementId: element.id, chapterId: element.chapterId, sliceId: element.sliceId, chapterName: element.chapterName}
        };
        enrichKnownAction(knownAction, element, graph, registry);
        emitted.push(knownAction);
      }
    } else {
      // R3: Context first - check if context exists
      const contextAction = ensureContext(actions, seenKeys, contextPascal, registry);
      if (contextAction) {
        pushUnique(actions, seenKeys, contextAction);
        pendingNewContexts.add(contextPascal);
      }

      // R4: Generate for new elements based on type
      emitted.push(...generateForElement(element, graph, registry));
    }

    // R5-R7: Process links (event->information, event->automation, information->automation).
    // Links are evaluated even for registered elements (R2): a missing link
    // is generated even when both ends are known.
    if (graph) {
      emitted.push(...generateForLinks(graph, registry, slice.chapterId));
    }

    // Attach the "context was created" note to the first action whose comment
    // lands on this element, then dedupe by key into the global action list.
    let markedSelf = false;
    for (const a of emitted) {
      if (pendingNewContexts.has(contextPascal) && !markedSelf && a.kind !== 'context' && isSelfAction(a, element, namePascal)) {
        a.contextNote = true;
        markedSelf = true;
      }
      if (!seenKeys.has(a.key)) {
        actions.push(a);
        seenKeys.add(a.key);
      } else if (a.contextNote) {
        // The surviving action with this key carries the note.
        const existing = actions.find(x => x.key === a.key);
        if (existing) {
          existing.contextNote = true;
        }
      }
    }
    if (markedSelf) {
      pendingNewContexts.delete(contextPascal);
    }
  }

  // Populate the {files}/{registryFile} fields so task comments can list the
  // real paths codegen wrote (task-comments.md "{files} lists real paths").
  for (const a of actions) {
    fillActionFiles(a);
  }

  // R8: Order and deduplicate
  const orderedActions = orderActions(actions);

  return {actions: orderedActions, notes};
}

/**
 * Push an action unless an action with the same key was already emitted.
 */
function pushUnique(actions: Action[], seenKeys: Set<string>, action: Action): void {
  if (!seenKeys.has(action.key)) {
    actions.push(action);
    seenKeys.add(action.key);
  }
}

/**
 * True when the action's task comment lands on `element` itself (not on a
 * dependency counterpart). Used to attach the "context was created" note to
 * the first element in a newly created context.
 */
function isSelfAction(action: Action, element: BoardElement, namePascal: string): boolean {
  if (action.kind === element.type && action.name === namePascal) {
    return true; // command / event / information
  }
  if ((action.kind === 'on' || action.kind === 'job') && action.automation === namePascal) {
    return true; // automation element, comment goes to the automation
  }
  if (action.kind === 'blocked' && action.name === namePascal) {
    return true;
  }
  return false;
}

/**
 * Check if element type is relevant (R1)
 */
function isRelevantType(type: string): type is 'command' | 'event' | 'information' | 'automation' {
  return ['command', 'event', 'information', 'automation'].includes(type);
}

/**
 * Check if element is registered (R2)
 */
function isElementRegistered(element: BoardElement, registry: RegistrySnapshot): boolean {
  const fqcn = toFqcn(element.context || 'App', element.name);

  switch (element.type) {
    case 'command':
      return registry.commands.has(fqcn);
    case 'event':
      return registry.events.has(fqcn);
    case 'information':
      return registry.informationFolders.has(fqcn);
    case 'automation':
      // Automation can be registered as job or event automation
      if (registry.jobs.has(fqcn)) {
        return true;
      }
      // Check if registered as event automation
      for (const [eventFqcn, automateSet] of registry.eventAutomate) {
        if (automateSet.has(fqcn)) {
          return true;
        }
      }
      return false;
  }
}

/**
 * Generate actions for a new element (R4)
 */
function generateForElement(
  element: BoardElement,
  graph: DependencyGraph | undefined,
  registry: RegistrySnapshot
): Action[] {
  const actions: Action[] = [];
  const contextPascal = toPascalCase(element.context || 'App');
  const namePascal = toPascalCase(element.name);
  const fqcn = toFqcn(contextPascal, namePascal);
  const selfTarget = {elementId: element.id, chapterId: element.chapterId, sliceId: element.sliceId, chapterName: element.chapterName};

  switch (element.type) {
    case 'command':
      actions.push({
        kind: 'command',
        key: `command:${fqcn}`,
        context: contextPascal,
        name: namePascal,
        command: namePascal,
        commentTarget: selfTarget,
      });
      break;

    case 'event': {
      // R4: Event needs its command. Prefer the command in the same slice,
      // else the first in graph order. Other command sources are named in
      // the comment.
      const commandSources = graph ? graph.sources.filter(s => s.type === 'command') : [];
      const commandSource = chooseCommandSource(commandSources, element.sliceId);
      if (!commandSource) {
        // No command source found
        actions.push({
          kind: 'blocked',
          key: `blocked:${fqcn}`,
          context: contextPascal,
          name: namePascal,
          reason: 'no command source in the Event Model',
          hint: 'Add the command to the Event Model or implement the external event manually',
          commentTarget: selfTarget,
        });
      } else if (toPascalCase(commandSource.context || 'App') !== contextPascal) {
        // Command found but in a different context -> blocked (R4)
        actions.push({
          kind: 'blocked',
          key: `blocked:${fqcn}`,
          context: contextPascal,
          name: namePascal,
          reason: 'command is in another context, which codegen does not support',
          hint: 'Add a command in the same context to the Event Model',
          commentTarget: selfTarget,
        });
      } else {
        const cmdFqcn = toFqcn(commandSource.context, commandSource.name);
        const cmdNamePascal = toPascalCase(commandSource.name);

        // Check if command is already registered
        if (!registry.commands.has(cmdFqcn)) {
          actions.push({
            kind: 'command',
            key: `command:${cmdFqcn}`,
            context: contextPascal,
            name: cmdNamePascal,
            command: cmdNamePascal,
            commentTarget: {elementId: commandSource.id, chapterId: commandSource.chapterId, sliceId: commandSource.sliceId, chapterName: commandSource.chapterName},
          });
        }

        const otherCommandSources = commandSources
          .filter(s => s !== commandSource)
          .map(s => toFqcn(s.context || 'App', s.name));

        actions.push({
          kind: 'event',
          key: `event:${fqcn}`,
          context: contextPascal,
          name: namePascal,
          event: namePascal,
          command: cmdNamePascal,
          targetType: 'command',
          targetName: cmdNamePascal,
          eventFqcn: fqcn,
          otherCommandSources: otherCommandSources.length > 0 ? otherCommandSources : undefined,
          commentTarget: selfTarget,
        });
      }
      break;
    }

    case 'information':
      actions.push({
        kind: 'information',
        key: `information:${fqcn}`,
        context: contextPascal,
        name: namePascal,
        information: namePascal,
        commentTarget: selfTarget,
      });
      break;

    case 'automation':
      // R4: Automation without sources -> blocked
      if (!graph || (graph.sources.length === 0 && graph.targets.length === 0)) {
        actions.push({
          kind: 'blocked',
          key: `blocked:${fqcn}`,
          context: contextPascal,
          name: namePascal,
          reason: 'cannot tell event automation from job automation; needs a human/agent',
          hint: 'Add at least one event or information source to the automation in the Event Model',
          commentTarget: selfTarget,
        });
      }
      // Links are handled by generateForLinks
      break;
  }

  return actions;
}

/**
 * Choose the command source for an event: prefer a command in the same
 * slice, else the first command in graph order (R4).
 */
function chooseCommandSource(
  sources: DependencyNode[],
  sliceId: string
): DependencyNode | null {
  return sources.find(s => s.sliceId === sliceId) ?? sources[0] ?? null;
}

/**
 * Generate actions for dependency links (R5-R7)
 */
function generateForLinks(
  graph: DependencyGraph,
  registry: RegistrySnapshot,
  currentChapterId: string
): Action[] {
  const actions: Action[] = [];
  const contextPascal = toPascalCase(graph.element.context);

  // R5: Event -> Information (projection case)
  // Check both directions: an event element with an information target, or
  // an information element with an event source.
  if (graph.element.type === 'event') {
    for (const target of graph.targets) {
      if (target.type === 'information') {
        const newActions = createPrjCaseAction(graph, target, registry, currentChapterId, contextPascal);
        actions.push(...newActions);
      }
    }
  }

  if (graph.element.type === 'information') {
    for (const source of graph.sources) {
      if (source.type === 'event') {
        const newActions = createPrjCaseAction(source, graph, registry, currentChapterId, contextPascal);
        actions.push(...newActions);
      }
    }
  }

  // R6: Event -> Automation (event automation)
  if (graph.element.type === 'event') {
    for (const target of graph.targets) {
      if (target.type === 'automation') {
        const action = createOnAction(graph, target, registry, currentChapterId, contextPascal);
        if (action) {
          actions.push(action);
        }
      }
    }

    for (const source of graph.sources) {
      if (source.type === 'automation') {
        const action = createOnAction(source, graph, registry, currentChapterId, contextPascal);
        if (action) {
          actions.push(action);
        }
      }
    }
  }

  // R7: Information -> Automation (job automation)
  if (graph.element.type === 'information') {
    for (const target of graph.targets) {
      if (target.type === 'automation') {
        const action = createJobAction(graph, target, registry, currentChapterId, contextPascal);
        if (action) {
          actions.push(action);
        }
      }
    }

    for (const source of graph.sources) {
      if (source.type === 'automation') {
        const action = createJobAction(source, graph, registry, currentChapterId, contextPascal);
        if (action) {
          actions.push(action);
        }
      }
    }
  }

  // R6/R7 reverse direction: the automation element's own graph tells what
  // feeds it. An event source makes it an event automation (on), an
  // information source makes it a job automation (job). This is also how R4
  // distinguishes the two when the automation has no other graph data.
  if (graph.element.type === 'automation') {
    for (const source of graph.sources) {
      if (source.type === 'event') {
        const action = createOnAction(source, graph, registry, currentChapterId, contextPascal);
        if (action) {
          actions.push(action);
        }
      }
      if (source.type === 'information') {
        const action = createJobAction(source, graph, registry, currentChapterId, contextPascal);
        if (action) {
          actions.push(action);
        }
      }
    }
  }

  return actions;
}

/**
 * Create prjcase action(s) (R5).
 *
 * Returns an array because the information counterpart may not be registered
 * yet (it lives in another slice). In that case an `information` action is
 * prepended so codegen can satisfy it before the prjcase.
 */
function createPrjCaseAction(
  eventSource: DependencyNode | DependencyGraph,
  infoTarget: DependencyNode | DependencyGraph,
  registry: RegistrySnapshot,
  currentChapterId: string,
  contextPascal: string
): Action[] {
  // Get event and info FQCNs
  let eventFqcn = '';
  let infoFqcn = '';
  let eventContextPascal = '';
  let infoContextPascal = '';

  if ('element' in eventSource) {
    // eventSource is a DependencyGraph (event)
    eventFqcn = toFqcn(eventSource.element.context, eventSource.element.name);
    eventContextPascal = toPascalCase(eventSource.element.context);
  } else {
    // eventSource is a DependencyNode
    eventFqcn = toFqcn((eventSource as DependencyNode).context, (eventSource as DependencyNode).name);
    eventContextPascal = toPascalCase((eventSource as DependencyNode).context);
  }

  if ('element' in infoTarget) {
    // infoTarget is a DependencyGraph (information)
    infoFqcn = toFqcn(infoTarget.element.context, infoTarget.element.name);
    infoContextPascal = toPascalCase(infoTarget.element.context);
  } else {
    // infoTarget is a DependencyNode
    infoFqcn = toFqcn((infoTarget as DependencyNode).context, (infoTarget as DependencyNode).name);
    infoContextPascal = toPascalCase((infoTarget as DependencyNode).context);
  }

  // The comment always goes to the information element, using its own
  // chapterId when it is a graph counterpart (R9).
  const infoCommentTarget = !('element' in infoTarget)
    ? {elementId: infoTarget.id, chapterId: infoTarget.chapterId, sliceId: infoTarget.sliceId, chapterName: infoTarget.chapterName}
    : undefined;

  // Same context requirement
  if (eventContextPascal !== infoContextPascal) {
    // Blocked on the information element
    return [{
      kind: 'blocked',
      key: `blocked:${infoFqcn}`,
      context: infoContextPascal,
      name: infoFqcn.split('.')[1],
      reason: 'event and information must be in the same context',
      hint: 'Move the information to the same context as the event',
      commentTarget: infoCommentTarget
    }];
  }

  // Check if projection case already exists
  const existingApply = registry.eventApply.get(eventFqcn);
  if (existingApply && existingApply.has(infoFqcn)) {
    return []; // Already exists, skip
  }

  const result: Action[] = [];

  // R5 prerequisite: ensure the information itself is generated first when
  // it is a graph counterpart not yet in the registry (Q3: generate what the
  // link needs even if the counterpart slice is not planned yet).
  const infoName = infoFqcn.split('.')[1];
  if (
    !registry.informationFolders.has(infoFqcn) &&
    !registry.queries.has(infoFqcn)
  ) {
    result.push({
      kind: 'information',
      key: `information:${infoFqcn}`,
      context: infoContextPascal,
      name: infoName,
      information: infoName,
      commentTarget: infoCommentTarget,
    });
  }

  result.push({
    kind: 'prjcase',
    key: `prjcase:${infoFqcn}<-${eventFqcn}`,
    context: contextPascal,
    name: infoName,
    information: infoName,
    event: eventFqcn.split('.')[1],
    targetType: 'event',
    targetName: eventFqcn.split('.')[1],
    eventFqcn,
    infoFqcn,
    commentTarget: infoCommentTarget
  });

  return result;
}

/**
 * Create on action (R6)
 */
function createOnAction(
  eventSource: DependencyNode | DependencyGraph,
  autoTarget: DependencyNode | DependencyGraph,
  registry: RegistrySnapshot,
  currentChapterId: string,
  contextPascal: string
): Action | null {
  let eventFqcn = '';
  let autoFqcn = '';
  let eventContextPascal = '';
  let autoContextPascal = '';

  if ('element' in eventSource) {
    eventFqcn = toFqcn(eventSource.element.context, eventSource.element.name);
    eventContextPascal = toPascalCase(eventSource.element.context);
  } else {
    eventFqcn = toFqcn((eventSource as DependencyNode).context, (eventSource as DependencyNode).name);
    eventContextPascal = toPascalCase((eventSource as DependencyNode).context);
  }

  if ('element' in autoTarget) {
    autoFqcn = toFqcn(autoTarget.element.context, autoTarget.element.name);
    autoContextPascal = toPascalCase(autoTarget.element.context);
  } else {
    autoFqcn = toFqcn((autoTarget as DependencyNode).context, (autoTarget as DependencyNode).name);
    autoContextPascal = toPascalCase((autoTarget as DependencyNode).context);
  }

  // The comment goes to the automation element, using its own chapterId
  // when it is a graph counterpart (R9).
  const autoCommentTarget = !('element' in autoTarget)
    ? {elementId: autoTarget.id, chapterId: autoTarget.chapterId, sliceId: autoTarget.sliceId, chapterName: autoTarget.chapterName}
    : undefined;

  // Same context requirement
  if (eventContextPascal !== autoContextPascal) {
    return {
      kind: 'blocked',
      key: `blocked:${autoFqcn}`,
      context: autoContextPascal,
      name: autoFqcn.split('.')[1],
      reason: 'event and automation must be in the same context',
      hint: 'Move the automation to the same context as the event',
      commentTarget: autoCommentTarget
    };
  }

  // Check if already registered as event automation
  const existingAutomate = registry.eventAutomate.get(eventFqcn);
  if (existingAutomate && existingAutomate.has(autoFqcn)) {
    return null; // Already exists
  }

  // Check if already registered as job (automation without event source)
  if (registry.jobs.has(autoFqcn)) {
    return null;
  }

  return {
    kind: 'on',
    key: `on:${autoFqcn}<-${eventFqcn}`,
    context: contextPascal,
    name: autoFqcn.split('.')[1],
    automation: autoFqcn.split('.')[1],
    event: eventFqcn.split('.')[1],
    targetType: 'event',
    targetName: eventFqcn.split('.')[1],
    eventFqcn,
    autoFqcn,
    commentTarget: autoCommentTarget
  };
}

/**
 * Create job action (R7)
 */
function createJobAction(
  infoSource: DependencyNode | DependencyGraph,
  autoTarget: DependencyNode | DependencyGraph,
  registry: RegistrySnapshot,
  currentChapterId: string,
  contextPascal: string
): Action | null {
  let infoFqcn = '';
  let autoFqcn = '';
  let infoContextPascal = '';
  let autoContextPascal = '';

  if ('element' in infoSource) {
    infoFqcn = toFqcn(infoSource.element.context, infoSource.element.name);
    infoContextPascal = toPascalCase(infoSource.element.context);
  } else {
    infoFqcn = toFqcn((infoSource as DependencyNode).context, (infoSource as DependencyNode).name);
    infoContextPascal = toPascalCase((infoSource as DependencyNode).context);
  }

  if ('element' in autoTarget) {
    autoFqcn = toFqcn(autoTarget.element.context, autoTarget.element.name);
    autoContextPascal = toPascalCase(autoTarget.element.context);
  } else {
    autoFqcn = toFqcn((autoTarget as DependencyNode).context, (autoTarget as DependencyNode).name);
    autoContextPascal = toPascalCase((autoTarget as DependencyNode).context);
  }

  // The comment goes to the automation element, using its own chapterId
  // when it is a graph counterpart (R9).
  const autoCommentTarget = !('element' in autoTarget)
    ? {elementId: autoTarget.id, chapterId: autoTarget.chapterId, sliceId: autoTarget.sliceId, chapterName: autoTarget.chapterName}
    : undefined;

  // Same context requirement
  if (infoContextPascal !== autoContextPascal) {
    return {
      kind: 'blocked',
      key: `blocked:${autoFqcn}`,
      context: autoContextPascal,
      name: autoFqcn.split('.')[1],
      reason: 'information and automation must be in the same context',
      hint: 'Move the automation to the same context as the information',
      commentTarget: autoCommentTarget
    };
  }

  // Check if already registered as job
  if (registry.jobs.has(autoFqcn)) {
    return null;
  }

  return {
    kind: 'job',
    key: `job:${autoFqcn}<-${infoFqcn}`,
    context: contextPascal,
    name: autoFqcn.split('.')[1],
    automation: autoFqcn.split('.')[1],
    information: infoFqcn.split('.')[1],
    targetType: 'information',
    targetName: infoFqcn.split('.')[1],
    infoFqcn,
    autoFqcn,
    commentTarget: autoCommentTarget
  };
}

/**
 * Ensure context exists (R3)
 */
function ensureContext(
  actions: Action[],
  seenKeys: Set<string>,
  contextPascal: string,
  registry: RegistrySnapshot
): Action | null {
  if (registry.contexts.has(contextPascal)) {
    return null;
  }

  // Also check if we've already added a context action for this context
  const contextKey = `context:${contextPascal}`;
  if (seenKeys.has(contextKey)) {
    return null;
  }

  return {
    kind: 'context',
    key: contextKey,
    context: contextPascal
  };
}

/**
 * Fill files/registryFile for actions that run codegen (task-comments
 * {files}: real paths computed from naming rules; verified on disk by the
 * L4 tests). 'known' actions are enriched by enrichKnownAction instead.
 */
function fillActionFiles(a: Action): void {
  const ctx = a.context;
  if (!ctx) {
    return;
  }
  switch (a.kind) {
    case 'context': {
      const base = `src/domain/${toKebab(ctx)}`;
      a.files = [
        `${base}/index.ts`,
        `${base}/services.ts`,
        `${base}/commands.ts`,
        `${base}/events.ts`,
        `${base}/queries.ts`,
        `${base}/job-automations.ts`
      ];
      break;
    }
    case 'command':
      a.files = ['payload.ts', 'prepare.ts', 'handle.ts', 'state.ts']
        .map(f => `${getCommandPath(ctx, a.name!)}/${f}`);
      a.registryFile = getRegistryFilePath(ctx, 'command');
      break;
    case 'event':
      if (a.targetName) {
        a.files = [`${getCommandPath(ctx, a.targetName)}/events/${toKebab(a.name!)}.ts`];
      }
      a.registryFile = getRegistryFilePath(ctx, 'event');
      break;
    case 'information': {
      const base = getInformationPath(ctx, a.name!);
      a.files = [`${base}/${toKebab(a.name!)}.ts`, `${base}/query.ts`, `${base}/resolve.ts`];
      a.registryFile = getRegistryFilePath(ctx, 'query');
      break;
    }
    case 'prjcase':
      a.files = ['apply.ts', 'prepare.ts', 'state.ts']
        .map(f => `${getProjectionCasePath(ctx, a.name!, a.targetName!)}/${f}`);
      a.registryFile = getRegistryFilePath(ctx, 'event');
      break;
    case 'on':
      a.files = ['on.ts', 'prepare.ts', 'state.ts']
        .map(f => `${getAutomationPath(ctx, a.name!, 'event')}/${f}`);
      a.registryFile = getRegistryFilePath(ctx, 'event');
      break;
    case 'job':
      a.files = ['process.ts', 'prepare.ts', 'state.ts']
        .map(f => `${getAutomationPath(ctx, a.name!, 'job')}/${f}`);
      a.registryFile = getRegistryFilePath(ctx, 'job');
      break;
    default:
      break; // known / blocked
  }
}

/**
 * Fill files/registryFile on a 'known' action so the comment can point the
 * agent at the existing implementation (spec: Implementation: {files}).
 */
function enrichKnownAction(
  a: Action,
  element: BoardElement,
  graph: DependencyGraph | undefined,
  registry: RegistrySnapshot
): void {
  const ctx = toPascalCase(element.context || 'App');
  const name = toPascalCase(element.name);
  const fqcn = `${ctx}.${name}`;

  switch (element.type) {
    case 'command':
      a.files = ['payload.ts', 'prepare.ts', 'handle.ts', 'state.ts']
        .map(f => `${getCommandPath(ctx, name)}/${f}`);
      a.registryFile = getRegistryFilePath(ctx, 'command');
      break;
    case 'event': {
      a.registryFile = getRegistryFilePath(ctx, 'event');
      // The event file lives under its emitting command's folder; recover
      // the command from the element's graph when available.
      const cmd = chooseCommandSource(
        graph ? graph.sources.filter(s => s.type === 'command') : [],
        element.sliceId
      );
      if (cmd) {
        a.files = [`${getCommandPath(ctx, toPascalCase(cmd.name))}/events/${toKebab(name)}.ts`];
      }
      break;
    }
    case 'information': {
      a.registryFile = getRegistryFilePath(ctx, 'query');
      const base = getInformationPath(ctx, name);
      a.files = [`${base}/${toKebab(name)}.ts`, `${base}/query.ts`, `${base}/resolve.ts`];
      // Registered projection cases add their files so the agent can compare.
      for (const [evtFqcn, infos] of registry.eventApply) {
        if (!infos.has(fqcn)) continue;
        const pbase = getProjectionCasePath(ctx, name, evtFqcn.split('.')[1]);
        a.files.push(`${pbase}/apply.ts`, `${pbase}/prepare.ts`, `${pbase}/state.ts`);
      }
      break;
    }
    case 'automation': {
      const asJob = registry.jobs.has(fqcn);
      const base = getAutomationPath(ctx, name, asJob ? 'job' : 'event');
      a.files = asJob
        ? [`${base}/process.ts`, `${base}/prepare.ts`, `${base}/state.ts`]
        : [`${base}/on.ts`, `${base}/prepare.ts`, `${base}/state.ts`];
      a.registryFile = getRegistryFilePath(ctx, asJob ? 'job' : 'event');
      break;
    }
  }
}

/**
 * Order actions by phase (R8)
 */
function orderActions(actions: Action[]): Action[] {
  const phaseOrder: Record<ActionKind, number> = {
    context: 0,
    command: 1,
    event: 2,
    information: 3,
    prjcase: 4,
    on: 5,
    job: 6,
    known: 7,
    blocked: 8
  };

  return actions.sort((a, b) => {
    // First by phase
    const phaseDiff = phaseOrder[a.kind] - phaseOrder[b.kind];
    if (phaseDiff !== 0) return phaseDiff;

    // Then by key for stable ordering
    return a.key.localeCompare(b.key);
  });
}

/**
 * Convert context and name to FQCN
 */
function toFqcn(context: string, name: string): string {
  return `${toPascalCase(context)}.${toPascalCase(name)}`;
}
