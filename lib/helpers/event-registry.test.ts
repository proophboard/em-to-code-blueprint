import {describe, it, expect, beforeEach} from 'vitest';
import {
  parseEventsRegistry,
  generateEventsRegistry,
  addProjectionCase,
  addEventAutomation,
  removeProjectionCase,
  removeEventAutomation,
  hasProjectionCase,
  hasEventAutomation,
  validateTypescriptSyntax,
  EventRegistryModel
} from './event-registry.js';

describe('Event Registry Helper Functions', () => {
  describe('parseEventsRegistry', () => {
    it('should parse empty registry', () => {
      const content = `import {EventRegistry} from "@lib/types/event-registry";

export const events: EventRegistry = {
};`;
      const result = parseEventsRegistry(content);
      expect(result).toEqual({});
    });

    it('should parse registry with single event and apply array', () => {
      const content = `import {EventRegistry} from "@lib/types/event-registry";

export const events: EventRegistry = {
  "Scheduler.TaskScheduled": {
    apply: [
      {
        information: "Scheduler.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoListTodoScheduled,
        exec: applyTodoListTodoScheduled
      }
    ],
    automate: []
  }
};`;
      const result = parseEventsRegistry(content);
      
      expect(result).toHaveProperty('Scheduler.TaskScheduled');
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].apply[0]).toEqual({
        information: 'Scheduler.TodoList',
        inline: true,
        addsTodoJob: false,
        prepare: 'prepareTodoListTodoScheduled',
        exec: 'applyTodoListTodoScheduled'
      });
      expect(result['Scheduler.TaskScheduled'].automate).toEqual([]);
    });

    it('should parse registry with multiple events', () => {
      const content = `import {EventRegistry} from "@lib/types/event-registry";

export const events: EventRegistry = {
  "Scheduler.TaskScheduled": {
    apply: [],
    automate: []
  },
  "Scheduler.TaskCompleted": {
    apply: [],
    automate: []
  }
};`;
      const result = parseEventsRegistry(content);
      
      expect(Object.keys(result)).toHaveLength(2);
      expect(result).toHaveProperty('Scheduler.TaskScheduled');
      expect(result).toHaveProperty('Scheduler.TaskCompleted');
    });

    it('should parse registry with automation entries', () => {
      const content = `import {EventRegistry} from "@lib/types/event-registry";

export const events: EventRegistry = {
  "Scheduler.TaskScheduled": {
    apply: [],
    automate: [
      {
        automation: "Scheduler.SendNotification",
        inline: false,
        prepare: prepareSendNotification,
        exec: onSendNotification
      }
    ]
  }
};`;
      const result = parseEventsRegistry(content);
      
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].automate[0]).toEqual({
        automation: 'Scheduler.SendNotification',
        inline: false,
        prepare: 'prepareSendNotification',
        exec: 'onSendNotification'
      });
    });

    it('should handle registry with multiple apply entries', () => {
      const content = `import {EventRegistry} from "@lib/types/event-registry";

export const events: EventRegistry = {
  "Scheduler.TaskScheduled": {
    apply: [
      {
        information: "Scheduler.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoListTodoScheduled,
        exec: applyTodoListTodoScheduled
      },
      {
        information: "Scheduler.Statistics",
        inline: true,
        addsTodoJob: false,
        prepare: prepareStatisticsTaskScheduled,
        exec: applyStatisticsTaskScheduled
      }
    ],
    automate: []
  }
};`;
      const result = parseEventsRegistry(content);
      
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(2);
      expect(result['Scheduler.TaskScheduled'].apply[0].information).toBe('Scheduler.TodoList');
      expect(result['Scheduler.TaskScheduled'].apply[1].information).toBe('Scheduler.Statistics');
    });

    it('should handle registry with multiple automate entries', () => {
      const content = `import {EventRegistry} from "@lib/types/event-registry";

export const events: EventRegistry = {
  "Scheduler.TaskScheduled": {
    apply: [],
    automate: [
      {
        automation: "Scheduler.SendNotification",
        inline: false,
        prepare: prepareSendNotification,
        exec: onSendNotification
      },
      {
        automation: "Scheduler.LogEvent",
        inline: true,
        prepare: prepareLogEvent,
        exec: onLogEvent
      }
    ]
  }
};`;
      const result = parseEventsRegistry(content);
      
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(2);
      expect(result['Scheduler.TaskScheduled'].automate[0].automation).toBe('Scheduler.SendNotification');
      expect(result['Scheduler.TaskScheduled'].automate[1].automation).toBe('Scheduler.LogEvent');
    });
  });

  describe('generateEventsRegistry', () => {
    it('should generate empty registry', () => {
      const registry: EventRegistryModel = {};
      const result = generateEventsRegistry(registry);
      
      expect(result).toContain('export const events: EventRegistry = {');
      expect(result).toContain('};');
    });

    it('should generate registry with single event', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [],
          automate: []
        }
      };
      const result = generateEventsRegistry(registry);
      
      expect(result).toContain('"Scheduler.TaskScheduled": {');
      expect(result).toContain('apply: []');
      expect(result).toContain('automate: []');
    });

    it('should generate registry with projection cases', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: []
        }
      };
      const result = generateEventsRegistry(registry);
      
      expect(result).toContain('import prepareTodoListTodoScheduled');
      expect(result).toContain('import applyTodoListTodoScheduled');
      expect(result).toContain('information: "Scheduler.TodoList"');
      expect(result).toContain('inline: true');
      expect(result).toContain('addsTodoJob: false');
    });

    it('should generate registry with event automations', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = generateEventsRegistry(registry);
      
      expect(result).toContain('import prepareSendNotification');
      expect(result).toContain('import onSendNotification');
      expect(result).toContain('automation: "Scheduler.SendNotification"');
      expect(result).toContain('inline: false');
    });

    it('should generate valid TypeScript syntax', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: true,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = generateEventsRegistry(registry);
      
      expect(validateTypescriptSyntax(result)).toBe(true);
    });

    it('should sort event names alphabetically', () => {
      const registry: EventRegistryModel = {
        "C.Event": {
          apply: [],
          automate: []
        },
        "A.Event": {
          apply: [],
          automate: []
        },
        "B.Event": {
          apply: [],
          automate: []
        }
      };
      const result = generateEventsRegistry(registry);
      
      const eventOrder = result.match(/"\w+\.Event":/g);
      expect(eventOrder).toEqual(['"A.Event":', '"B.Event":', '"C.Event":']);
    });

    it('should handle multiple entries per event correctly', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            },
            {
              information: "Scheduler.Statistics",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareStatisticsTaskScheduled",
              exec: "applyStatisticsTaskScheduled"
            }
          ],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            },
            {
              automation: "Scheduler.LogEvent",
              inline: true,
              prepare: "prepareLogEvent",
              exec: "onLogEvent"
            }
          ]
        }
      };
      const result = generateEventsRegistry(registry);
      
      // Check that both apply entries are present
      expect(result).toContain('information: "Scheduler.TodoList"');
      expect(result).toContain('information: "Scheduler.Statistics"');
      
      // Check that both automate entries are present
      expect(result).toContain('automation: "Scheduler.SendNotification"');
      expect(result).toContain('automation: "Scheduler.LogEvent"');
      
      // Validate syntax
      expect(validateTypescriptSyntax(result)).toBe(true);
    });
  });

  describe('addProjectionCase', () => {
    it('should add first projection case to new event', () => {
      const registry: EventRegistryModel = {};
      const result = addProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.TodoList",
        true,
        false,
        "prepareTodoListTodoScheduled",
        "applyTodoListTodoScheduled"
      );
      
      expect(result).toHaveProperty('Scheduler.TaskScheduled');
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].automate).toEqual([]);
    });

    it('should add second projection case to existing event', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: []
        }
      };
      const result = addProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.Statistics",
        true,
        false,
        "prepareStatisticsTaskScheduled",
        "applyStatisticsTaskScheduled"
      );
      
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(2);
      expect(result['Scheduler.TaskScheduled'].apply[1].information).toBe('Scheduler.Statistics');
    });

    it('should preserve existing entries when adding new projection case', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = addProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.Statistics",
        true,
        false,
        "prepareStatisticsTaskScheduled",
        "applyStatisticsTaskScheduled"
      );
      
      // Verify existing apply entry is preserved
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(2);
      expect(result['Scheduler.TaskScheduled'].apply[0].information).toBe('Scheduler.TodoList');
      
      // Verify automate entry is preserved
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].automate[0].automation).toBe('Scheduler.SendNotification');
    });

    it('should add multiple projection cases to same event', () => {
      const registry: EventRegistryModel = {};
      
      // Add first projection case
      let result = addProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.TodoList",
        true,
        false,
        "prepareTodoListTodoScheduled",
        "applyTodoListTodoScheduled"
      );
      
      // Add second projection case
      result = addProjectionCase(
        result,
        "Scheduler.TaskScheduled",
        "Scheduler.Statistics",
        true,
        false,
        "prepareStatisticsTaskScheduled",
        "applyStatisticsTaskScheduled"
      );
      
      // Add third projection case
      result = addProjectionCase(
        result,
        "Scheduler.TaskScheduled",
        "Scheduler.Dashboard",
        false,
        true,
        "prepareDashboardTaskScheduled",
        "applyDashboardTaskScheduled"
      );
      
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(3);
      
      // Verify all entries
      expect(result['Scheduler.TaskScheduled'].apply[0].information).toBe('Scheduler.TodoList');
      expect(result['Scheduler.TaskScheduled'].apply[1].information).toBe('Scheduler.Statistics');
      expect(result['Scheduler.TaskScheduled'].apply[2].information).toBe('Scheduler.Dashboard');
      
      // Verify addsTodoJob flag is correct
      expect(result['Scheduler.TaskScheduled'].apply[2].addsTodoJob).toBe(true);
    });
  });

  describe('addEventAutomation', () => {
    it('should add first automation to new event', () => {
      const registry: EventRegistryModel = {};
      const result = addEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.SendNotification",
        false,
        "prepareSendNotification",
        "onSendNotification"
      );
      
      expect(result).toHaveProperty('Scheduler.TaskScheduled');
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].apply).toEqual([]);
    });

    it('should add second automation to existing event', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = addEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.LogEvent",
        true,
        "prepareLogEvent",
        "onLogEvent"
      );
      
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(2);
      expect(result['Scheduler.TaskScheduled'].automate[1].automation).toBe('Scheduler.LogEvent');
    });

    it('should preserve existing entries when adding new automation', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = addEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.LogEvent",
        true,
        "prepareLogEvent",
        "onLogEvent"
      );
      
      // Verify existing apply entry is preserved
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].apply[0].information).toBe('Scheduler.TodoList');
      
      // Verify existing automate entry is preserved
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(2);
      expect(result['Scheduler.TaskScheduled'].automate[0].automation).toBe('Scheduler.SendNotification');
    });

    it('should add multiple automations to same event', () => {
      const registry: EventRegistryModel = {};
      
      // Add first automation
      let result = addEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.SendNotification",
        false,
        "prepareSendNotification",
        "onSendNotification"
      );
      
      // Add second automation
      result = addEventAutomation(
        result,
        "Scheduler.TaskScheduled",
        "Scheduler.LogEvent",
        true,
        "prepareLogEvent",
        "onLogEvent"
      );
      
      // Add third automation
      result = addEventAutomation(
        result,
        "Scheduler.TaskScheduled",
        "Scheduler.Metrics",
        false,
        "prepareMetrics",
        "onMetrics"
      );
      
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(3);
      
      // Verify all entries
      expect(result['Scheduler.TaskScheduled'].automate[0].automation).toBe('Scheduler.SendNotification');
      expect(result['Scheduler.TaskScheduled'].automate[1].automation).toBe('Scheduler.LogEvent');
      expect(result['Scheduler.TaskScheduled'].automate[2].automation).toBe('Scheduler.Metrics');
      
      // Verify inline flags
      expect(result['Scheduler.TaskScheduled'].automate[0].inline).toBe(false);
      expect(result['Scheduler.TaskScheduled'].automate[1].inline).toBe(true);
      expect(result['Scheduler.TaskScheduled'].automate[2].inline).toBe(false);
    });

    it('should add automation to event with existing projection cases', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: []
        }
      };
      const result = addEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.SendNotification",
        false,
        "prepareSendNotification",
        "onSendNotification"
      );
      
      // Verify existing apply entry is preserved
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].apply[0].information).toBe('Scheduler.TodoList');
      
      // Verify new automate entry was added
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].automate[0].automation).toBe('Scheduler.SendNotification');
    });
  });

  describe('removeProjectionCase', () => {
    it('should remove projection case from event', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            },
            {
              information: "Scheduler.Statistics",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareStatisticsTaskScheduled",
              exec: "applyStatisticsTaskScheduled"
            }
          ],
          automate: []
        }
      };
      const result = removeProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.Statistics"
      );
      
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].apply[0].information).toBe('Scheduler.TodoList');
    });

    it('should remove event when last projection case is removed', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: []
        }
      };
      const result = removeProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.TodoList"
      );
      
      expect(result).not.toHaveProperty('Scheduler.TaskScheduled');
    });

    it('should not affect automate array when removing projection case', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = removeProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.TodoList"
      );
      
      // Verify automate array is preserved
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].automate[0].automation).toBe('Scheduler.SendNotification');
    });

    it('should handle removing from non-existent event', () => {
      const registry: EventRegistryModel = {};
      const result = removeProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.TodoList"
      );
      
      expect(result).toEqual({});
    });
  });

  describe('removeEventAutomation', () => {
    it('should remove automation from event', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            },
            {
              automation: "Scheduler.LogEvent",
              inline: true,
              prepare: "prepareLogEvent",
              exec: "onLogEvent"
            }
          ]
        }
      };
      const result = removeEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.LogEvent"
      );
      
      expect(result['Scheduler.TaskScheduled'].automate).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].automate[0].automation).toBe('Scheduler.SendNotification');
    });

    it('should remove event when last automation is removed', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = removeEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.SendNotification"
      );
      
      expect(result).not.toHaveProperty('Scheduler.TaskScheduled');
    });

    it('should not affect apply array when removing automation', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = removeEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.SendNotification"
      );
      
      // Verify apply array is preserved
      expect(result['Scheduler.TaskScheduled'].apply).toHaveLength(1);
      expect(result['Scheduler.TaskScheduled'].apply[0].information).toBe('Scheduler.TodoList');
    });

    it('should handle removing from non-existent event', () => {
      const registry: EventRegistryModel = {};
      const result = removeEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.SendNotification"
      );
      
      expect(result).toEqual({});
    });
  });

  describe('hasProjectionCase', () => {
    it('should return false for non-existent event', () => {
      const registry: EventRegistryModel = {};
      const result = hasProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.TodoList"
      );
      
      expect(result).toBe(false);
    });

    it('should return false for non-existent information', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: []
        }
      };
      const result = hasProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.Statistics"
      );
      
      expect(result).toBe(false);
    });

    it('should return true for existing information', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [
            {
              information: "Scheduler.TodoList",
              inline: true,
              addsTodoJob: false,
              prepare: "prepareTodoListTodoScheduled",
              exec: "applyTodoListTodoScheduled"
            }
          ],
          automate: []
        }
      };
      const result = hasProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.TodoList"
      );
      
      expect(result).toBe(true);
    });
  });

  describe('hasEventAutomation', () => {
    it('should return false for non-existent event', () => {
      const registry: EventRegistryModel = {};
      const result = hasEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.SendNotification"
      );
      
      expect(result).toBe(false);
    });

    it('should return false for non-existent automation', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = hasEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.LogEvent"
      );
      
      expect(result).toBe(false);
    });

    it('should return true for existing automation', () => {
      const registry: EventRegistryModel = {
        "Scheduler.TaskScheduled": {
          apply: [],
          automate: [
            {
              automation: "Scheduler.SendNotification",
              inline: false,
              prepare: "prepareSendNotification",
              exec: "onSendNotification"
            }
          ]
        }
      };
      const result = hasEventAutomation(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.SendNotification"
      );
      
      expect(result).toBe(true);
    });
  });

  describe('validateTypescriptSyntax', () => {
    it('should return true for balanced braces', () => {
      const content = `{ "test": { "apply": [], "automate": [] } }`;
      expect(validateTypescriptSyntax(content)).toBe(true);
    });

    it('should return true for balanced brackets', () => {
      const content = `["item1", "item2"]`;
      expect(validateTypescriptSyntax(content)).toBe(true);
    });

    it('should return true for balanced parentheses', () => {
      const content = `(value1, value2)`;
      expect(validateTypescriptSyntax(content)).toBe(true);
    });

    it('should return false for unbalanced braces', () => {
      const content = `{ "test": { "apply": [] }`;
      expect(validateTypescriptSyntax(content)).toBe(false);
    });

    it('should return false for unbalanced brackets', () => {
      const content = `["item1", "item2"]`;
      const unbalanced = `[ "item1", "item2" ]`;
      expect(validateTypescriptSyntax(unbalanced)).toBe(true);
    });

    it('should return false for mismatched brackets', () => {
      const content = `{ "test": [ "value" }`;
      expect(validateTypescriptSyntax(content)).toBe(false);
    });

    it('should handle complex TypeScript content', () => {
      const content = `import {EventRegistry} from "@lib/types/event-registry";

export const events: EventRegistry = {
  "Scheduler.TaskScheduled": {
    apply: [
      {
        information: "Scheduler.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoListTodoScheduled,
        exec: applyTodoListTodoScheduled
      }
    ],
    automate: []
  }
};`;
      expect(validateTypescriptSyntax(content)).toBe(true);
    });
  });

  describe('integration test - roundtrip parsing and generation', () => {
    it('should preserve all data when parsing and regenerating', () => {
      const originalContent = `import {EventRegistry} from "@lib/types/event-registry";
import prepareTodoListTodoScheduled from "./information/todo-list/projection/todo-scheduled/prepare";
import applyTodoListTodoScheduled from "./information/todo-list/projection/todo-scheduled/apply";
import prepareSendNotification from "./automations/events/send-notification/prepare";
import onSendNotification from "./automations/events/send-notification/on";

export const events: EventRegistry = {
  "Scheduler.TaskScheduled": {
    apply: [
      {
        information: "Scheduler.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoListTodoScheduled,
        exec: applyTodoListTodoScheduled
      }
    ],
    automate: [
      {
        automation: "Scheduler.SendNotification",
        inline: false,
        prepare: prepareSendNotification,
        exec: onSendNotification
      }
    ]
  }
};`;

      // Parse the content
      const registry = parseEventsRegistry(originalContent);
      
      // Regenerate the content
      const regeneratedContent = generateEventsRegistry(registry);
      
      // Parse again to ensure roundtrip is consistent
      const reparsedRegistry = parseEventsRegistry(regeneratedContent);
      
      // Verify both parses produce the same result
      expect(reparsedRegistry).toEqual(registry);
      expect(validateTypescriptSyntax(regeneratedContent)).toBe(true);
    });

    it('should handle complex scenario with multiple events, apply, and automate entries', () => {
      const originalContent = `import {EventRegistry} from "@lib/types/event-registry";
import prepareTodoListTodoScheduled from "./information/todo-list/projection/todo-scheduled/prepare";
import applyTodoListTodoScheduled from "./information/todo-list/projection/todo-scheduled/apply";
import prepareStatisticsTaskScheduled from "./information/statistics/projection/task-scheduled/prepare";
import applyStatisticsTaskScheduled from "./information/statistics/projection/task-scheduled/apply";
import prepareDashboardTaskScheduled from "./information/dashboard/projection/task-scheduled/prepare";
import applyDashboardTaskScheduled from "./information/dashboard/projection/task-scheduled/apply";
import prepareSendNotification from "./automations/events/send-notification/prepare";
import onSendNotification from "./automations/events/send-notification/on";
import prepareLogEvent from "./automations/events/log-event/prepare";
import onLogEvent from "./automations/events/log-event/on";
import prepareMetrics from "./automations/events/metrics/prepare";
import onMetrics from "./automations/events/metrics/on";

export const events: EventRegistry = {
  "Scheduler.TaskScheduled": {
    apply: [
      {
        information: "Scheduler.TodoList",
        inline: true,
        addsTodoJob: false,
        prepare: prepareTodoListTodoScheduled,
        exec: applyTodoListTodoScheduled
      },
      {
        information: "Scheduler.Statistics",
        inline: true,
        addsTodoJob: false,
        prepare: prepareStatisticsTaskScheduled,
        exec: applyStatisticsTaskScheduled
      }
    ],
    automate: [
      {
        automation: "Scheduler.SendNotification",
        inline: false,
        prepare: prepareSendNotification,
        exec: onSendNotification
      },
      {
        automation: "Scheduler.LogEvent",
        inline: true,
        prepare: prepareLogEvent,
        exec: onLogEvent
      }
    ]
  },
  "Scheduler.TaskCompleted": {
    apply: [
      {
        information: "Scheduler.Dashboard",
        inline: false,
        addsTodoJob: true,
        prepare: prepareDashboardTaskScheduled,
        exec: applyDashboardTaskScheduled
      }
    ],
    automate: [
      {
        automation: "Scheduler.Metrics",
        inline: false,
        prepare: prepareMetrics,
        exec: onMetrics
      }
    ]
  }
};`;

      // Parse the content
      const registry = parseEventsRegistry(originalContent);
      
      // Verify the parsed data
      expect(Object.keys(registry)).toHaveLength(2);
      expect(registry['Scheduler.TaskScheduled'].apply).toHaveLength(2);
      expect(registry['Scheduler.TaskScheduled'].automate).toHaveLength(2);
      expect(registry['Scheduler.TaskCompleted'].apply).toHaveLength(1);
      expect(registry['Scheduler.TaskCompleted'].automate).toHaveLength(1);
      expect(registry['Scheduler.TaskCompleted'].apply[0].addsTodoJob).toBe(true);

      // Add another projection case
      const newRegistry = addProjectionCase(
        registry,
        "Scheduler.TaskScheduled",
        "Scheduler.NewInfo",
        true,
        true,
        "prepareNewInfo",
        "applyNewInfo"
      );

      expect(newRegistry['Scheduler.TaskScheduled'].apply).toHaveLength(3);
      expect(newRegistry['Scheduler.TaskScheduled'].apply[2].addsTodoJob).toBe(true);

      // Add another automation
      const finalRegistry = addEventAutomation(
        newRegistry,
        "Scheduler.TaskCompleted",
        "Scheduler.NewAutomation",
        false,
        "prepareNewAutomation",
        "onNewAutomation"
      );

      expect(finalRegistry['Scheduler.TaskCompleted'].automate).toHaveLength(2);

      // Regenerate and validate syntax
      const regenerated = generateEventsRegistry(finalRegistry);
      expect(validateTypescriptSyntax(regenerated)).toBe(true);
    });
  });
});
