# Implementation steps

Work top to bottom. After every step: `npx vitest run` and `npm run ts:check` must pass
(baseline today: 2 test files, 57 tests passing). Commit per step only if the owner asks.
Each step ends with a **Findings** line to fill in if reality differed from the spec.

Read first: `README.md` of this folder, `AGENTS.md`, `docs/cli.md`, `bin/app.ts`, `codegen/command.ts`,
`lib/helpers/event-registry.ts` (+ test, as the style reference).

---

## Step 1: Registry reader + scanner fix
- Create `lib/helpers/registry-reader.ts` and `.test.ts` per `registry-contract.md` (`readRegistrySnapshot`, `toKebab`).
- Reuse `parseEventsRegistry` for `events.ts`; add brace-aware parsing for `commands.ts`, `queries.ts`, `job-automations.ts` (keys, and `todoList` value for jobs).
- Replace `parseRegistryFile` in `bin/scanner.ts` with the new reader.
- Tests: all L1 `registry-reader` cases; regression: two-entry `commands.ts` returns both keys through `scanDomain`.
- Accept: `npx app list` still works on `src/domain/task-management`; tests pass.
- Findings:

## Step 2: Verify external contracts (spike, no production code)
- Against `eventflow-designer/supabase/functions/api/index.ts` and `_shared/tools.ts`, confirm: error body shape (`errorResponse`), how a resolved task comment is represented in `data.comments` (look at `resolve_task` in `tools.ts`), that `GET /chapters/:id?slice_ids=&structure_only=true` works through `handleToolCall` query parsing (boolean coercion exists for `structure_only`).
- If a dev instance and a key are available, capture real responses of `get_chapter`, dependency graph and add comment into `bridge/testing/fixtures/` (redact ids/names if needed). Otherwise write fixtures by hand from the types in `api-contracts.md`.
- Update `api-contracts.md` sections 2.1-2.3 with confirmed facts.
- Findings:

## Step 3: Model, naming, config
- `bridge/model.ts`, `bridge/naming.ts`, `bridge/config.ts` with tests (L1).
- Accept: `naming` rejects everything the CLI regex `^[A-Z][a-zA-Z0-9]*$` would reject, accepts everything it accepts.
- Findings:

## Step 4: Task comments
- `bridge/task-comments.ts` + snapshot tests for every template in `task-comments.md`, including marker, `{files}` paths, context note.
- Accept: paths in comments match the real layout created by codegen (verified in Step 8 contract test; until then derive from `docs/cli.md`).
- Findings:

## Step 5: Planner
- `bridge/planner.ts` implementing R1-R10; table-driven tests listed in `architecture-and-tests.md` L1.
- Accept: every rule has a test; idempotency test (apply plan to registry, re-plan -> only `known`).
- Findings:

## Step 6: Prooph client
- `bridge/prooph-client.ts` (fetch, retry/backoff injectable, timeout, redaction) + `bridge/testing/fake-prooph-server.ts` + L2 tests.
- Accept: no test mocks `fetch`; key never appears in thrown messages or logs.
- Findings: `get_chapter` slices/elements carry no `chapterId`; the client sets it from the requested chapterId. Retry/timeout tests use real timers with tiny injected backoffs (fake timers block real HTTP + AbortSignal). Fake server exposes `failNext(status, n)` for retry scenarios. Fixtures are inline in `fake-prooph-server.ts`; move to `testing/fixtures/` when real captures exist.

## Step 7: Codegen runner and executor
- `bridge/codegen-runner.ts` (`child_process.execFile`/`spawn` with arg array, `cwd`, timeout, no shell; command `npx tsx bin/app.ts codegen ...` or the local `node_modules/.bin/tsx`).
- `bridge/executor.ts` per "Executor semantics" in `planning-rules.md`; NO EXTRA TESTS for now.
- Findings:

## Step 8: Sandbox + codegen integration tests
- `bridge/testing/sandbox-project.ts`; L4 tests (full chain, validation failures, hostile argument).
- Contract test: registry-reader reads what codegen wrote; comment `{files}` paths exist on disk.
- Open point to check here: the sandbox must resolve the `@lib/*` alias (tsconfig `paths`) and the blueprint template path (`codegen` uses `__dirname`, domain uses `process.cwd()`). If the copy approach fails, try running with `--tsconfig` pointing at the real repo.
- Findings: open point resolved — the copy approach works: the sandbox copies `bin`, `codegen`, `lib`, `tsconfig.json` into a `mkdtemp` dir under `os.tmpdir()` and runs the local `node_modules/.bin/tsx`; `@lib/*` resolves via the copied tsconfig, blueprint `__dirname` paths stay relative-valid, `getDomainPath()` follows `cwd`. The contract test found a real planner bug: R5's source/target direction checks were missing the `graph.element.type` gate, so an automation element's graph with event/information sources produced phantom `information`/`prjcase` actions and no reverse `on`/`job` actions — fixed in `generateForLinks`. L4 covers full chain (context → command → event → information → prjcase → on → job), validation failures, hostile args passed literally through the execFile arg array, and reader↔codegen contract on disk.

## Step 9: Entry point, spec-stream config, docs
- `bridge/run.ts`, `bridge/index.ts` (exit codes 0/1/2, `--dry-run`, `BRIDGE_EVENT_SOURCED`).
- `proophboard.spec-stream.json` as in `api-contracts.md` section 1 (trigger status `planned`, confirmed).
- `package.json`: script `"bridge": "tsx bridge/index.ts"`; do not add runtime dependencies. spec-stream itself is installed by the user (`npx` / global); document the exact invocation after checking the real package name and CLI in `spec-stream/package.json` and `spec-stream/README.md`.
- `.env.example` with `PROOPHBOARD_API_KEY` (write-enabled key note) and `PROOPHBOARD_API_ENDPOINT`; ensure `.env` is ignored by `.gitignore`.
- `docs/bridge.md`: setup, key permissions (write key required), flow diagram, how to dry-run, limitations (cross-context links Q5, readiness of counterpart slices Q3), how to change trigger status.
- README: tick the "spec-stream config" todo and link `docs/bridge.md`.
- NO EXTRA TESTS for now.
- Findings: 

## Step 10: Final verification
- Checklist: each rule R1-R10 and each template maps to a passing test (write the mapping as a comment block at the top of `planner.test.ts` / `task-comments.test.ts`).
- Run full suite twice (no order dependence), `npm run ts:check`.
- Manual smoke test (needs a real board and key; mark as not run if unavailable): start spec-stream in the blueprint root, change a slice status to the trigger status, observe generated files in `src/domain`, comments on elements, and no loop. Then revert generated files with git.
- Confirm no temp dirs or sandbox leftovers (`afterEach` cleanup) and no secrets in fixtures.
- Findings: mapping comment blocks at top of `planner.test.ts` (R1–R10 + name validation) and `task-comments.test.ts` (per template). Added the previously uncovered rule tests: R1 relevance, R5 prerequisite-information ordering, R7 cross-context blocked, R9 counterpart `commentTarget` chapterId. Full suite: 11 files / 252 tests, run twice, identical; `ts:check` clean; 0 skipped (registry job test un-skipped — root cause was `toHaveProperty` on a `Map`, now `.has()`/`.get()`; temp dirs moved to `os.tmpdir()`, repo leftover `lib/helpers/__test_temp__/` removed). No sandbox leftovers; only `test-key-123` dummy values in fixtures; `.env` gitignored. Manual smoke test: **run** against a real board (chapter `f1e2c759`, trigger slice `986036c5` with command→event, counterpart slice `482e61a6` with the information element). First run: plan of 5 (context, command, event, information-prerequisite, prjcase), all `ok`; codegen wrote `src/domain/app/**`; 4 task comments posted — 2 on trigger-slice elements, 2 on the information counterpart in the other slice (counterpart `commentTarget` verified live). Second run: plan reduced to 2 `known` actions; `known` comments posted once (marker `known:` differs from first-run action keys). Third run: marker suppression — no duplicate comments, no codegen re-run (convergent, no loop). `skipped` counter stays 0 for comment-skipped `known` actions (reported `ok`). Generated files reverted with git (`src/domain/app` removed); task comments left on the board for inspection, resolvable there.

  spec-stream trigger path (spec-stream 0.9.1, run in a separate clone with `localSync` — the model lands in `.spec-stream/model/` of the cwd, so do not run it in the working repo): **verified end-to-end**. Slice status flipped to `planned` via `sync-back` → realtime `slice-status-changed` event → rule `slice-to-blueprint` matched → `npx tsx bridge/index.ts "$SPEC_STREAM_SLICE_ID"` spawned with injected `SPEC_STREAM_CHAPTER_ID` → exit 0 → `src/domain/app/**` generated in the clone. Two live findings: (a) spec-stream drops events authored by the API key's own user (`isOwnEvent`) — triggering via API/`sync-back` only fires when the rule sets `consumeOwnEvents: true`; a human flipping status in the UI under their own account is unaffected. The shipped config intentionally does NOT consume own events (loop guard). (b) First triggered run exposed that the dependency-graph `element` carries no `comments`, so counterpart marker checks always missed → comments reposted. Fixed by fetching counterpart comments via `getSliceElements(commentTarget.chapterId, commentTarget.sliceId)` (commit `fix(bridge): fetch counterpart comments for the marker check via slice elements`); verified live: re-run with empty registry skipped all 4 comment posts incl. both counterpart comments. Duplicated comments resolved on the board afterwards.
