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

## FAQ

### Why are all functions split into `prepare` and `execute`?

[Functional Approach](fucntional-approach.md)

### Why no entities?

Entities do exist in the data model - the `information` part, when you give an object an identifier. However, entities are not used to perform data changes. All changes go through `command -> handle() -> events -> apply() -> state` flows.

See [Functional Approach](fucntional-approach.md) for details.

## Todo

- [ ] Test Scenario Runner
- [ ] Frontend Guidance
