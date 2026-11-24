// Task comment templates for the bridge module
// Generates comments for implementation agents based on action types

import type { Action } from './model.js';

/**
 * The product owner's wording for known elements (typo fixed: "necessary" not "neccessary")
 */
export const KNOWN_ELEMENT_SENTENCE =
  'Element is known in the app. Compare the information in the Event Model with the implementation and make necessary changes to the implementation when needed.';

/**
 * Shared "where to look" block appended to every generated-code comment
 */
export const WHERE_TO_LOOK_BLOCK = `Before implementing:
- Read this element's description and details on prooph board.
- Check the element's play type and play function.
- If needed, look at the other elements of this slice, the chapter, and the chapter scenarios.
Board reference: chapter {chapterName} ({chapterId}), slice {sliceLabel} ({sliceId}), element {elementId}.
When done, resolve this task.`;

/**
 * Everything a comment needs to render itself: chapter/slice/element
 * coordinates of the element the comment is posted on. For counterpart
 * elements in other chapters these are the counterpart's own ids.
 */
export interface CommentContext {
  chapterId: string;
  chapterName: string;
  sliceLabel: string;
  sliceId: string;
  elementId: string;
}

/**
 * Input accepted by buildComment: the element reference (real BoardElement
 * or a graph counterpart synthesised from ids) plus board context.
 */
export interface BuildCommentInput {
  element: { id: string; sliceId: string };
  chapterId: string;
  chapterName: string;
  sliceLabel: string;
}

/**
 * Builds a task comment for an action
 * @param action - The action to generate a comment for
 * @param input - Context information (element ref, chapter, slice)
 * @returns The complete comment text
 */
export function buildComment(action: Action, input: BuildCommentInput): string {
  const ctx: CommentContext = {
    chapterId: input.chapterId,
    chapterName: input.chapterName,
    sliceLabel: input.sliceLabel,
    sliceId: input.element.sliceId,
    elementId: input.element.id,
  };

  switch (action.kind) {
    case 'known':
      return buildKnownComment(action, ctx);
    case 'command':
      return buildCommandComment(action, ctx);
    case 'event':
      return buildEventComment(action, ctx);
    case 'information':
      return buildInformationComment(action, ctx);
    case 'prjcase':
      return buildPrjcaseComment(action, ctx);
    case 'on':
      return buildOnComment(action, ctx);
    case 'job':
      return buildJobComment(action, ctx);
    case 'blocked':
      return buildBlockedComment(action, ctx);
    case 'context':
      // Context actions don't get task comments (the first element in a new context does)
      return '';
  }
}

/**
 * Builds a comment for known elements
 */
export function buildKnownComment(
  action: Action,
  ctx: CommentContext
): string {
  const { key, files, registryFile } = action;
  const fqcn = key.split(':')[1]; // Extract FQCN from "known:FQCN"

  const fileBlock = files && files.length > 0
    ? files.map(f => `- ${f}`).join('\n')
    : '- No files generated (element already exists)';

  const registryBlock = registryFile ? `\nRegistered in: ${registryFile}` : '';

  return buildCommentText(
    `known:${fqcn}`,
    `${KNOWN_ELEMENT_SENTENCE}\n\nImplementation:\n${fileBlock}${registryBlock}`,
    ctx,
    action
  );
}

/**
 * Builds a comment for new commands
 */
export function buildCommandComment(
  action: Action,
  ctx: CommentContext
): string {
  const { context, command, files } = action;
  const fqcn = context && command ? `${context}.${command}` : '';
  const ctxKebab = context ? toKebab(context) : '';
  const cmdKebab = command ? toKebab(command) : '';

  const fileBlock = files && files.length > 0
    ? files.map(f => `- ${f}`).join('\n')
    : `- src/domain/${ctxKebab}/commands/${cmdKebab}/payload.ts: payload type\n` +
      `- .../prepare.ts: load/prepare state\n` +
      `- .../handle.ts: decision logic, returns events\n` +
      `- .../state.ts: state needed for the decision`;

  return buildCommentText(
    `command:${fqcn}`,
    `Boilerplate for command ${fqcn} was generated with \`npx app codegen command ${context} ${command}\`.\n` +
    `Finalize it:\n${fileBlock}\nRegistered in src/domain/${ctxKebab}/commands.ts.`,
    ctx,
    action
  );
}

/**
 * Builds a comment for new events
 */
export function buildEventComment(
  action: Action,
  ctx: CommentContext
): string {
  const { context, command, event, files, otherCommandSources } = action;
  const fqcn = context && event ? `${context}.${event}` : '';
  const ctxKebab = context ? toKebab(context) : '';
  const cmdKebab = command ? toKebab(command) : '';

  const fileBlock = files && files.length > 0
    ? files.map(f => `- ${f}`).join('\n')
    : `- src/domain/${ctxKebab}/commands/${cmdKebab}/events/${toKebab(event!)}.ts: event payload type\n` +
      `- make command ${context}.${command} return this event where appropriate`;

  // R4: when several command sources exist, the chosen one generated the
  // event; the others are named here so the agent can wire them manually.
  const otherSourcesNote = otherCommandSources && otherCommandSources.length > 0
    ? `\nOther command source(s) connected to this event on the board: ${otherCommandSources.join(', ')}. Codegen used ${context}.${command}.`
    : '';

  return buildCommentText(
    `event:${fqcn}`,
    `Boilerplate for event ${fqcn} was generated with \`npx app codegen event ${context} ${command} ${event}\` (emitted by command ${context}.${command}).\n` +
    `Finalize it:\n${fileBlock}\nRegistered in src/domain/${ctxKebab}/events.ts.${otherSourcesNote}`,
    ctx,
    action
  );
}

/**
 * Builds a comment for new information
 */
export function buildInformationComment(
  action: Action,
  ctx: CommentContext
): string {
  const { context, information, files } = action;
  const fqcn = context && information ? `${context}.${information}` : '';
  const ctxKebab = context ? toKebab(context) : '';
  const infoKebab = information ? toKebab(information) : '';

  const fileBlock = files && files.length > 0
    ? files.map(f => `- ${f}`).join('\n')
    : `- src/domain/${ctxKebab}/information/${infoKebab}/${infoKebab}.ts: information type\n` +
      `- .../query.ts and resolve.ts: query payload and resolution\n` +
      `- .../projection/: filled by projection cases (see separate tasks)`;

  return buildCommentText(
    `information:${fqcn}`,
    `Boilerplate for information ${fqcn} was generated with \`npx app codegen information ${context} ${information}\`.\n` +
    `Finalize it:\n${fileBlock}\nRegistered in src/domain/${ctxKebab}/queries.ts.`,
    ctx,
    action
  );
}

/**
 * Builds a comment for projection cases
 */
export function buildPrjcaseComment(
  action: Action,
  ctx: CommentContext
): string {
  const { context, information, event, files } = action;
  const infoFqcn = context && information ? `${context}.${information}` : '';
  const evtFqcn = context && event ? `${context}.${event}` : '';
  const ctxKebab = context ? toKebab(context) : '';
  const infoKebab = information ? toKebab(information) : '';
  const evtKebab = event ? toKebab(event) : '';

  const fileBlock = files && files.length > 0
    ? files.map(f => `- ${f}`).join('\n')
    : `- src/domain/${ctxKebab}/information/${infoKebab}/projection/${evtKebab}/apply.ts: update the information from the event\n` +
      `- .../prepare.ts, .../state.ts: what state apply needs`;

  return buildCommentText(
    `prjcase:${infoFqcn}<-${evtFqcn}`,
    `Projection case for event ${evtFqcn} was generated with \`npx app codegen prjcase ${context} ${information} ${event}\`.\n` +
    `Finalize it:\n${fileBlock}\nDefaults: inline projection, no todo job. Decide whether it should run async (\`--async\`) or add a todo job (\`--adds-todo\`); regenerate or edit the registration in src/domain/${ctxKebab}/events.ts accordingly.`,
    ctx,
    action
  );
}

/**
 * Builds a comment for event automations (on)
 */
export function buildOnComment(
  action: Action,
  ctx: CommentContext
): string {
  const { context, automation, event, files } = action;
  const autoFqcn = context && automation ? `${context}.${automation}` : '';
  const evtFqcn = context && event ? `${context}.${event}` : '';
  const ctxKebab = context ? toKebab(context) : '';
  const autoKebab = automation ? toKebab(automation) : '';

  const fileBlock = files && files.length > 0
    ? files.map(f => `- ${f}`).join('\n')
    : `- src/domain/${ctxKebab}/automations/events/${autoKebab}/on.ts: what to do on the event (typically dispatch a command)\n` +
      `- .../prepare.ts, .../state.ts`;

  return buildCommentText(
    `on:${autoFqcn}<-${evtFqcn}`,
    `Event automation ${autoFqcn} reacting to event ${evtFqcn} was generated with \`npx app codegen on ${context} ${event} ${automation}\`.\n` +
    `Finalize it:\n${fileBlock}\nRegistered in src/domain/${ctxKebab}/events.ts (inline by default; decide on \`--async\`).`,
    ctx,
    action
  );
}

/**
 * Builds a comment for job automations
 */
export function buildJobComment(
  action: Action,
  ctx: CommentContext
): string {
  const { context, automation, information, files } = action;
  const autoFqcn = context && automation ? `${context}.${automation}` : '';
  const infoFqcn = context && information ? `${context}.${information}` : '';
  const ctxKebab = context ? toKebab(context) : '';
  const autoKebab = automation ? toKebab(automation) : '';

  const fileBlock = files && files.length > 0
    ? files.map(f => `- ${f}`).join('\n')
    : `- src/domain/${ctxKebab}/automations/jobs/${autoKebab}/process.ts: process one todo item\n` +
      `- .../prepare.ts, .../state.ts`;

  return buildCommentText(
    `job:${autoFqcn}<-${infoFqcn}`,
    `Job automation ${autoFqcn} working off todo list ${infoFqcn} was generated with \`npx app codegen job ${context} ${information} ${automation}\`.\n` +
    `Finalize it:\n${fileBlock}\nRegistered in src/domain/${ctxKebab}/job-automations.ts.\nThe projection that fills the todo list must set addsTodoJob (see the information's projection cases).`,
    ctx,
    action
  );
}

/**
 * Builds a comment for blocked actions
 */
export function buildBlockedComment(
  action: Action,
  ctx: CommentContext
): string {
  const { key, reason, hint } = action;
  const name = key ? key.split(':')[1] : 'this element';

  const reasonText = reason || 'an unknown error occurred';
  const hintText = hint ? `\nDecide how to proceed: ${hint}` : '';

  return buildCommentText(
    `blocked:${name}`,
    `The bridge did not generate code for this element: ${reasonText}.${hintText}`,
    ctx,
    action
  );
}

/**
 * Builds the complete comment text with marker, optional context note and
 * the where-to-look block.
 */
function buildCommentText(
  marker: string,
  mainContent: string,
  ctx: CommentContext,
  action: Action
): string {
  // task-comments.md: "the comment of the first element in that context
  // adds: Context {Ctx} was created ..." - only for actions the planner
  // flagged, not for every element that happens to live in a new context.
  const contextNote = action.contextNote && action.context
    ? `\nContext ${action.context} was created (src/domain/${toKebab(action.context)}). Review its services.ts and index.ts.`
    : '';

  const whereToLook = WHERE_TO_LOOK_BLOCK
    .replace('{chapterName}', ctx.chapterName)
    .replace('{chapterId}', ctx.chapterId)
    .replace('{sliceLabel}', ctx.sliceLabel)
    .replace('{sliceId}', ctx.sliceId)
    .replace('{elementId}', ctx.elementId);

  return `[em-to-code-blueprint:${marker}]\n\n${mainContent}${contextNote}\n\n${whereToLook}`;
}

/**
 * Converts a PascalCase string to kebab-case for path generation
 */
function toKebab(name: string): string {
  // Insert hyphens before uppercase letters that follow lowercase letters
  const withHyphens = name.replace(/([a-z])([A-Z])/g, '$1-$2');
  // Also handle sequences of uppercase letters followed by lowercase
  const withDoubleHyphens = withHyphens.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2');
  // Split on non-alphanumeric and convert to lowercase
  const parts = withDoubleHyphens.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return parts.join('-').toLowerCase();
}
