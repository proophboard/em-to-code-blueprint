# Functional Approach

## Prepare vs. Execute

The blueprint is designed to separate the preparation of data and the execution of the actual logic. This separation allows for better modularity, testability, and maintainability. The `prepare` functions are responsible for setting up the necessary data and environment for the execution, while the `execute` functions contain the actual logic that processes the data. This separation also enables the use of different execution strategies, such as parallel processing or asynchronous execution, without affecting the core logic.

## Immutability

While not strictly enforced, the blueprint encourages the use of immutable data structures and functions to promote predictability and avoid side effects.

## Data Changes

`Information` (data) is only changed by applying `events`. This does not necessarily mean that you have to use Event Sourcing. 
The pattern demonstrated here is very similar to Event Sourcing (and it can easily be activated), but it is not enforced.
If you're familiar with `Redux` for centraled state management in `React`, you'll notice similarities.

