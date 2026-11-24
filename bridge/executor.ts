/**
 * Executor: runs the codegen plan produced by the planner.
 *
 * Per "Executor semantics" in specs/bridge/planning-rules.md:
 * 1. Re-read registry before each action; skip if the action's effect already exists.
 * 2. Run CLI subprocess. Non-zero exit -> `failed`; skip dependants of this action.
 * 3. On success, post task comment unless the same marker already exists (open) on the element.
 * 4. Comment POST failure -> `failed-comment` (code generated, exit 1, logged).
 *
 * `--dry-run`: resolve plan input, print plan as JSON, skip codegen and comment POSTs.
 */

import type {
  Action,
  ActionKind,
  BoardElement,
  BridgeDeps,
  CodegenRunner,
  Logger,
  Plan,
  ProophClient,
  RegistryReader,
  RegistrySnapshot,
} from './model.js';
import { buildComment } from './task-comments.js';
import { toPascalCase } from './naming.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ActionStatus =
  | 'ok'
  | 'skipped'       // registry already satisfied before running
  | 'failed'        // CLI exited non-zero
  | 'failed-comment' // CLI succeeded but comment POST failed after retries
  | 'dependant-skipped'; // an earlier action failed so this action was skipped

export interface ActionResult {
  action: Action;
  status: ActionStatus;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  commentPosted?: boolean;
  commentError?: string;
}

export interface ExecuteResult {
  /** True iff every action is ok, skipped, or dependant-skipped cleanly (no failures). */
  success: boolean;
  results: ActionResult[];
}

/** Everything the executor needs wired in. */
export interface ExecutorDeps {
  codegen: CodegenRunner;
  registry: RegistryReader;
  prooph: ProophClient;
  logger: Logger;
}

// ---------------------------------------------------------------------------
// Helpers: build CLI arg array from action
// ---------------------------------------------------------------------------

/**
 * Returns the `codegen` subcommand arg array for a given action, or `null`
 * when the action produces no CLI invocation (context, known, blocked).
 */
export function buildArgs(action: Action, eventSourced: boolean): string[] | null {
  switch (action.kind) {
    case 'context':
      return eventSourced
        ? ['context', action.context!, '--event-sourced']
        : ['context', action.context!];

    case 'command':
      return ['command', action.context!, action.name!];

    case 'event':
      // `codegen event <Ctx> <Cmd> <Name>`
      // The planner stores the command name in `targetName`.
      return ['event', action.context!, action.targetName!, action.name!];

    case 'information':
      return ['information', action.context!, action.name!];

    case 'prjcase':
      // `codegen prjcase <Ctx> <Info> <Evt>`
      // action.name = information name, action.targetName = event name
      return ['prjcase', action.context!, action.name!, action.targetName!];

    case 'on':
      // `codegen on <Ctx> <Evt> <Auto>`
      // action.targetName = event name, action.name = automation name
      return ['on', action.context!, action.targetName!, action.name!];

    case 'job':
      // `codegen job <Ctx> <Info> <Auto>`
      // action.targetName = information name, action.name = automation name
      return ['job', action.context!, action.targetName!, action.name!];

    case 'known':
    case 'blocked':
      return null; // No CLI invocation; still posts a comment.
  }
}

// ---------------------------------------------------------------------------
// Helpers: idempotency check
// ---------------------------------------------------------------------------

/**
 * Returns true if the action's effect is already present in the registry,
 * meaning we can skip the CLI call.
 */
export function isAlreadySatisfied(action: Action, registry: RegistrySnapshot): boolean {
  switch (action.kind) {
    case 'context': {
      // Satisfied when the context folder exists (tracked via contexts set).
      return registry.contexts.has(action.context!);
    }
    case 'command': {
      const fqcn = `${action.context}.${action.name}`;
      return registry.commands.has(fqcn);
    }
    case 'event': {
      const fqcn = `${action.context}.${action.name}`;
      return registry.events.has(fqcn);
    }
    case 'information': {
      const fqcn = `${action.context}.${action.name}`;
      return registry.informationFolders.has(fqcn) || registry.queries.has(fqcn);
    }
    case 'prjcase': {
      // Satisfied when eventApply[eventFqcn] contains infoFqcn.
      const applies = registry.eventApply.get(action.eventFqcn!);
      return applies?.has(action.infoFqcn!) ?? false;
    }
    case 'on': {
      // Satisfied when eventAutomate[eventFqcn] contains autoFqcn.
      const automates = registry.eventAutomate.get(action.eventFqcn!);
      return automates?.has(action.autoFqcn!) ?? false;
    }
    case 'job': {
      // Satisfied when jobs contains autoFqcn.
      return registry.jobs.has(action.autoFqcn!);
    }
    case 'known':
    case 'blocked':
      // These never run codegen; they are always "not satisfied" in the CLI
      // sense but we don't block on them.
      return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers: comment idempotency
// ---------------------------------------------------------------------------

/** Marker prefix pattern used in buildComment (see task-comments.ts). */
function commentMarker(actionKey: string): string {
  return `[em-to-code-blueprint:${actionKey}]`;
}

/**
 * Returns true when the element already has an open task comment with the
 * same marker (i.e. a task comment that has not been resolved).
 */
function hasOpenMarker(element: BoardElement, actionKey: string): boolean {
  const marker = commentMarker(actionKey);
  return element.comments.some(c => c.isTask && !c.resolved && c.text.startsWith(marker));
}

// ---------------------------------------------------------------------------
// Helpers: target element for comment
// ---------------------------------------------------------------------------

interface CommentTarget {
  /** chapterId + elementId to POST the comment to */
  elementId: string;
  chapterId: string;
  /** element ref for buildComment ({id, sliceId}) */
  elementRef: { id: string; sliceId: string };
  /** element to run the open-marker check on; null when not fetchable */
  markerCheckElement: BoardElement | null;
  /** board context for the comment's "where to look" block */
  chapterName: string;
  sliceLabel: string;
}

/**
 * Resolve where an action's task comment goes.
 *
 * Preferred source is `action.commentTarget`, set by the planner for every
 * action: slice elements point at themselves, counterpart actions
 * (prjcase/on/job and their blocked variants) point at the counterpart
 * element with its own chapterId (api-contracts 2.3: post to the chapter
 * that owns the element).
 *
 * Counterpart elements are not part of the triggering slice's element list.
 * For the open-marker check we fetch their slice's elements via
 * `commentTarget.sliceId` — slice elements carry `comments`, while the
 * dependency-graph response's `element` does not. Counterpart slices are
 * cached per (chapterId, sliceId) since several actions (e.g. information +
 * prjcase) often target the same counterpart slice. When the fetch fails or
 * no sliceId is known we post anyway and log a warning.
 */
async function resolveCommentTarget(
  action: Action,
  elements: BoardElement[],
  prooph: ProophClient,
  opts: { sliceLabel: string; chapterName: string },
  logger: Logger,
  sliceElementCache: Map<string, {elements: BoardElement[]; sliceLabel: string}>
): Promise<CommentTarget | null> {
  if (action.commentTarget) {
    const t = action.commentTarget;
    const inSlice = elements.find(e => e.id === t.elementId && e.chapterId === t.chapterId);

    let markerCheckElement: BoardElement | null = inSlice ?? null;
    let counterpartSliceLabel: string | undefined;
    if (!markerCheckElement && t.sliceId) {
      const cacheKey = `${t.chapterId}:${t.sliceId}`;
      try {
        let cached = sliceElementCache.get(cacheKey);
        if (!cached) {
          const res = await prooph.getSliceElements(t.chapterId, t.sliceId);
          cached = { elements: res.elements, sliceLabel: res.slice.label ?? t.sliceId };
          sliceElementCache.set(cacheKey, cached);
        }
        markerCheckElement = cached.elements.find(e => e.id === t.elementId) ?? null;
        counterpartSliceLabel = cached.sliceLabel;
      } catch {
        logger.warn(
          `Could not fetch counterpart slice ${t.sliceId} for marker check; posting without idempotency check.`
        );
      }
    } else if (!markerCheckElement) {
      logger.warn(
        `No sliceId for counterpart element ${t.elementId}; posting without idempotency check.`
      );
    }

    return {
      elementId: t.elementId,
      chapterId: t.chapterId,
      elementRef: inSlice ?? { id: t.elementId, sliceId: t.sliceId ?? '' },
      markerCheckElement,
      chapterName: t.chapterName || inSlice?.chapterName || opts.chapterName,
      sliceLabel: inSlice ? opts.sliceLabel : (counterpartSliceLabel ?? t.sliceId ?? opts.sliceLabel),
    };
  }

  // Fallback for actions without a planner-provided target: match the FQCN
  // in the action key against the slice elements.
  const keyBody = action.key.slice(action.kind.length + 1); // strip "kind:"
  const fqcnForComment = keyBody.split('<-')[0]; // for prjcase/on/job, take the left side
  for (const el of elements) {
    const fqcn = `${toPascalCase(el.context)}.${toPascalCase(el.name)}`;
    if (fqcn === fqcnForComment) {
      return {
        elementId: el.id,
        chapterId: el.chapterId,
        elementRef: el,
        markerCheckElement: el,
        chapterName: el.chapterName || opts.chapterName,
        sliceLabel: opts.sliceLabel,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dependant tracking
// ---------------------------------------------------------------------------

/**
 * Determine if `downstream` depends on a failed `upstream` action.
 *
 * A downstream action is a dependant when:
 * - upstream = command   → downstream = event with same context.Name
 * - upstream = event     → downstream = prjcase or on with that eventFqcn
 * - upstream = context   → downstream = any action in that context
 * - upstream = information → downstream = prjcase, job with that infoFqcn
 *
 * This is conservative: we skip anything that could not succeed without the
 * failed prerequisite, mirroring the planning-rules dependency ordering.
 */
function isDependant(upstream: Action, downstream: Action): boolean {
  if (upstream.kind === 'context') {
    return downstream.context === upstream.context &&
      downstream.kind !== 'context' &&
      downstream.kind !== 'known' &&
      downstream.kind !== 'blocked';
  }

  if (upstream.kind === 'command') {
    // Events whose command matches the failed command.
    if (downstream.kind === 'event') {
      return (
        downstream.context === upstream.context &&
        downstream.targetName === upstream.name
      );
    }
    return false;
  }

  if (upstream.kind === 'event') {
    const upstreamFqcn = `${upstream.context}.${upstream.name}`;
    if (downstream.kind === 'prjcase') {
      return downstream.eventFqcn === upstreamFqcn;
    }
    if (downstream.kind === 'on') {
      return downstream.eventFqcn === upstreamFqcn;
    }
    return false;
  }

  if (upstream.kind === 'information') {
    const upstreamFqcn = `${upstream.context}.${upstream.name}`;
    if (downstream.kind === 'prjcase') {
      return downstream.infoFqcn === upstreamFqcn;
    }
    if (downstream.kind === 'job') {
      return downstream.infoFqcn === upstreamFqcn;
    }
    return false;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main execute function
// ---------------------------------------------------------------------------

export interface ExecuteOptions {
  dryRun?: boolean;
  eventSourced?: boolean;
  /** Slice label (name) for comment context */
  sliceLabel?: string;
  /** Chapter name for comment context */
  chapterName?: string;
}

/**
 * Execute a plan.
 *
 * @param plan     - The ordered plan from `plan()`.
 * @param elements - Slice elements (needed to look up comment targets).
 * @param deps     - Wired I/O dependencies.
 * @param options  - Runtime flags.
 */
export async function execute(
  plan: Plan,
  elements: BoardElement[],
  deps: ExecutorDeps,
  options: ExecuteOptions = {}
): Promise<ExecuteResult> {
  const {
    dryRun = false,
    eventSourced = false,
    sliceLabel = '',
    chapterName = '',
  } = options;
  const { codegen, registry, prooph, logger } = deps;

  if (dryRun) {
    logger.info(JSON.stringify({ dryRun: true, plan }, null, 2));
    return { success: true, results: [] };
  }

  const results: ActionResult[] = [];
  // Counterpart slices fetched for the open-marker check, keyed
  // `${chapterId}:${sliceId}` — several actions often share one counterpart
  // slice (e.g. information + prjcase on the same information element).
  const sliceElementCache = new Map<string, {elements: BoardElement[]; sliceLabel: string}>();

  for (const action of plan.actions) {
    // -----------------------------------------------------------------------
    // 0. Skip dependants of failed actions (transitively: a skipped dependant
    //    did not produce its effect either, so it blocks its own dependants)
    // -----------------------------------------------------------------------
    const failedUpstream = results.find(r =>
      (r.status === 'failed' || r.status === 'dependant-skipped') &&
      isDependant(r.action, action)
    );

    if (failedUpstream) {
      logger.warn(`Skipping ${action.key}: upstream action ${failedUpstream.action.key} failed or was skipped.`);
      results.push({ action, status: 'dependant-skipped' });
      continue;
    }

    // -----------------------------------------------------------------------
    // 1. Re-read registry; skip if effect already present
    // -----------------------------------------------------------------------
    const snap = registry.read();

    if (isAlreadySatisfied(action, snap)) {
      logger.info(`Skipping ${action.key}: already satisfied in registry.`);
      results.push({ action, status: 'skipped' });
      continue;
    }

    // -----------------------------------------------------------------------
    // 2. Run CLI (unless action has no CLI invocation)
    // -----------------------------------------------------------------------
    const args = buildArgs(action, eventSourced);

    if (args !== null) {
      logger.info(`Running codegen: ${action.key}`);
      const runResult = await codegen.run(args);

      if (!runResult.ok) {
        const stderr = runResult.stderr.slice(0, 2048);
        logger.error(
          `Codegen failed for ${action.key} (exit ${runResult.exitCode}): ${stderr}`
        );
        results.push({
          action,
          status: 'failed',
          exitCode: runResult.exitCode,
          stdout: runResult.stdout,
          stderr,
        });
        continue;
      }

      logger.info(`Codegen succeeded: ${action.key}`);
    }

    // -----------------------------------------------------------------------
    // 3. Post task comment
    // -----------------------------------------------------------------------
    if (action.kind === 'context') {
      // Context actions don't get their own comment.
      results.push({ action, status: 'ok', commentPosted: false });
      continue;
    }

    const target = await resolveCommentTarget(
      action,
      elements,
      prooph,
      { sliceLabel, chapterName },
      logger,
      sliceElementCache
    );
    if (!target) {
      // Cannot find the element to comment on (e.g. a cross-slice element we
      // don't have in our elements list). Log and move on.
      logger.warn(`No comment target found for ${action.key}; skipping comment.`);
      results.push({ action, status: 'ok', commentPosted: false });
      continue;
    }

    // Check idempotency: don't re-post an open task with the same marker.
    // Only possible when we could read the target element's comments.
    if (target.markerCheckElement && hasOpenMarker(target.markerCheckElement, action.key)) {
      logger.info(`Comment marker already present for ${action.key}; skipping.`);
      results.push({ action, status: 'ok', commentPosted: false });
      continue;
    }

    const commentText = buildComment(action, {
      element: target.elementRef,
      chapterId: target.chapterId,
      chapterName: target.chapterName,
      sliceLabel: target.sliceLabel,
    });

    try {
      await prooph.addTaskComment(target.chapterId, target.elementId, commentText);
      logger.info(`Comment posted for ${action.key}.`);
      results.push({ action, status: 'ok', commentPosted: true });
    } catch (err) {
      const commentError = err instanceof Error ? err.message : String(err);
      logger.error(
        `Comment POST failed for ${action.key} (element ${target.elementId}): ${commentError}`
      );
      results.push({
        action,
        status: 'failed-comment',
        commentPosted: false,
        commentError,
      });
    }
  }

  const success = results.every(
    r =>
      r.status === 'ok' ||
      r.status === 'skipped' ||
      r.status === 'dependant-skipped'
  );

  logger.info(
    JSON.stringify({
      summary: {
        total: results.length,
        ok: results.filter(r => r.status === 'ok').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        dependantSkipped: results.filter(r => r.status === 'dependant-skipped').length,
        failed: results.filter(r => r.status === 'failed').length,
        failedComment: results.filter(r => r.status === 'failed-comment').length,
      },
    })
  );

  return { success, results };
}
