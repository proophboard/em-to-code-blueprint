# em-to-code-blueprint
Blueprint to translate an Event Model into a Source Code

## What you get

The blueprint provides a starting point for organizing your code around an Event Model. It includes a basic structure for handling commands, events, automations and queries, as well as a context for organizing request handling with your favorite framework.

It is pseudo-code based on TypeScript and can be used as a starting point for your own implementation. It just communicates the general structure and flow of the code, but does not include any actual implementation details (except in the examples).

Pick your favorite language and framework/libraries. For example, you can use TypeScript with Express.js for a Node.js backend, or Python with Flask for a Python backend.

## Implementation Guidance

Let your favorite LLM inspect the blueprint and ask it to provide guidance on how to implement the blueprint in your chosen language and framework.

## Template Syntax

`__placeholder__` in folder and file names as well as in the source code indicate a dynamic structure, based on information derived from the Event Model. For example, if the Event Model has a command called `Crm.CreateUser`, the corresponding folder and file names might be `crm/commands/create-user`.

For agentic pipelines, it is a good idea to mix code generation for the fixed structure with clear placeholder replacements, and your LLM to fill the individual files with the actual implementation details.

> This minimizes the blast radius of errors and makes it easier to understand and maintain the code.

## Your Choices

You'll find `@todo: Discuss ...` throughout the blueprint. These are areas where you should discuss with your team and LLM how to implement the blueprint in your chosen language and framework, e.g. how to deal with concurrency, error handling, and security.

## Need Help?

The structure shown here might be unusual for many devs. No entities, no aggregates, no application or domain services, no ORM, you name it. That is expected. 

If you struggle with the blueprint, you can always ask for help on [GitHub Issues](https://github.com/proophboard/em-to-code-blueprint/issues).

## Background

The blueprint is based on years of experience working with the [Cody Engine](https://wiki.prooph-board.com/cody_engine/introduction.html) A tool designed around the idea of mapping an Event Model to code, enhanced with a DSL to be
able to define application logic as dynamic JSON and attach it directly to the Event Model.

The Cody Engine is in itself a powerful, but complex tool. The learning curve is steep. It was developed for a pre-AI era to maximize developer productivity. Many of its core ideas are very important for agentic pipelines as well. But you no longer need a custom DSL, nor is it a good idea anymore. 

The blueprint helps you to map the still important parts to your own technology stack and fill the gap with AI-powered application logic.

## Code Generation CLI

The project includes a `codegen` command for generating new elements from the blueprint template.

### Installation

```bash
npm install
```

### Usage

```bash
npx app codegen <command> [arguments]
```

### Commands

#### `context <name> [--event-sourced]`

Generate a new context with the specified name:

```bash
npx app codegen context TaskManagement
npx app codegen context TaskManagement --event-sourced
```

**Arguments:**
- `name` - Context name in PascalCase (e.g., `TaskManagement`, `CrmUserManagement`)

**Options:**
- `--event-sourced` - Enable event sourcing mode (uses `index.es.ts.tpl` template)

The command:
1. Creates a directory in `example/src/domain/` using kebab-case (e.g., `task-management`)
2. Copies all blueprint files except `index.*`
3. Creates empty subdirectories (`commands/`, `events/`, `automations/`, `information/`)
4. Copies the appropriate index template (`index.es.ts.tpl` or `index.no-es.ts.tpl`)
5. Replaces `__context__` placeholders:
   - snake_case (`task_management`) in `index.ts`
   - PascalCase (`TaskManagement`) in `services.ts`

#### `command <context> <name>`

Generate a new command in an existing context:

```bash
npx app codegen command TaskManagement AddTodo
npx app codegen command TaskManagement TaskManagement.UpdateTodo
```

**Arguments:**
- `context` - Context name in PascalCase (e.g., `TaskManagement`)
- `name` - Command name in PascalCase (e.g., `AddTodo`) or fully qualified name (e.g., `TaskManagement.AddTodo`)

The command:
1. Validates that the context exists (suggests `app codegen context` if not)
2. Validates that the command is not already registered
3. Creates a new folder `example/src/domain/[context]/commands/[command-name]`
4. Copies blueprint files (`prepare.ts`, `handle.ts`, `payload.ts`, `state.ts`)
5. Creates an empty `events/` folder (blueprint events are not copied)
6. Adds the command to `commands.ts` with proper imports and registration

#### `information <context> <name> [--no-query] [--no-projection]`

Generate a new information in an existing context:

```bash
npx app codegen information TaskManagement TodoList
npx app codegen information TaskManagement TodoList --no-query --no-projection
npx app codegen information TaskManagement TaskManagement.TodoList
```

**Arguments:**
- `context` - Context name in PascalCase (e.g., `TaskManagement`)
- `name` - Information name in PascalCase (e.g., `TodoList`) or fully qualified name (e.g., `TaskManagement.TodoList`)

**Options:**
- `--no-query` - Omit query.ts and resolve.ts files
- `--no-projection` - Omit projection folder

The command:
1. Validates that the context exists (suggests `app codegen context` if not)
2. Validates that the information is not already registered
3. Creates a new folder `example/src/domain/[context]/information/[information-name]`
4. Copies blueprint files (`__information__.ts`, `query.ts`, `resolve.ts`) and creates `projection/` folder
5. Renames `__information__.ts` to the information name in kebab-case (e.g., `todo-list.ts`)
6. Replaces placeholders in files:
   - `__Information__` with PascalCase information name (without context)
   - `__information__` with kebab-case information name
7. Adds the information to `queries.ts` with proper imports and registration (unless `--no-query`)

### Help

Get help for the codegen command:

```bash
npx app codegen --help
npx app codegen -h
```

Get help for a specific subcommand:

```bash
npx app codegen context --help
npx app codegen command --help
npx app codegen information --help
```

## CLI Tooling / Playground

The project includes a unified CLI tool `app` for managing commands and queries.

### Commands

#### `list`

List all available commands and queries grouped by context:

```bash
npx app list
```

The command dynamically scans `example/src/domain/*/commands.ts` and `example/src/domain/*/queries.ts` to discover all registered commands and queries.

#### `handle <command-name> <json-payload>`

Execute a command in a context:

```bash
npx app handle TaskManagement.AddTodo '{"title":"Test Todo","owner":"Alex"}'
```

The command searches for the command name in available contexts, validates the payload against TypeScript type definitions, loads the context module, and invokes `module.handle(command)`.

**Arguments:**
- `command-name` - The fully qualified command name (e.g., `TaskManagement.AddTodo`)
- `json-payload` - JSON object with command payload

The command displays:
- The command message being executed
- Command preparation and execution logs
- Success/failure status

If the command is not found, it shows available commands per context.

#### `resolve <query-name> <json-payload>`

Execute a query in a context:

```bash
npx app resolve TaskManagement.TodoList '{"status": "open"}'
```

The command searches for the query name in available contexts, validates the payload against TypeScript type definitions, loads the context module, and invokes `module.resolve(query)`.

**Arguments:**
- `query-name` - The fully qualified query name (e.g., `TaskManagement.TodoList`)
- `json-payload` - JSON object with query payload

The command displays:
- The query message being executed
- Query execution logs
- Success/failure status

If the query is not found, it shows available queries per context.

### Help

Get help for the CLI:

```bash
npx app --help
npx app -h
```

### NPM Scripts (Legacy)

The original npm scripts are still available for backward compatibility:

```bash
npm run list
npm run handle <command-name> <json-payload>
npm run resolve <query-name> <json-payload>
```

## FAQ

### Why are all functions split into `prepare` and `execute`?

[Functional Approach](fucntional-approach.md)

### Why no entities?

Entities do exist in the data model - the `information` part, when you give an object an identifier. However, entities are not used to perform data changes. All changes go through `command -> handle() -> events -> apply() -> state` flows.

See [Functional Approach](fucntional-approach.md) for details.

### Your question here?

Open a [GitHub Issue](https://github.com/proophboard/em-to-code-blueprint/issues).

## Todo

- [ ] Test Scenario Runner
- [ ] Frontend Guidance
- [ ] Public context method to consume events
