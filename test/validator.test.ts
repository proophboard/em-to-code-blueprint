import {describe, it, expect, beforeEach, vi} from 'vitest';
import {readFileSync} from 'fs';
import {validatePayload, getPayloadTypePath, getQueryTypePath} from '../bin/validator.js';

// Mock readFileSync to return test type definitions
vi.mock('fs', () => ({
  readFileSync: vi.fn()
}));

describe('validator', () => {
  const examplePayloadType = `export type Payload = {
  readonly todoId: string;
  readonly title: string;
  readonly owner: string;
  readonly deadline?: Date;
};`;

  const exampleQueryType = `export type Query = {
  readonly status?: 'open' | 'done';
};`;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('validatePayload', () => {
    it('should pass validation for payload with all required properties', () => {
      vi.mocked(readFileSync).mockReturnValue(examplePayloadType);

      const payload = {
        todoId: '123',
        title: 'Test Todo',
        owner: 'john@example.com'
      };

      expect(() => validatePayload(payload, '/fake/path/payload.ts')).not.toThrow();
    });

    it('should pass validation when optional properties are included', () => {
      vi.mocked(readFileSync).mockReturnValue(examplePayloadType);

      const payload = {
        todoId: '123',
        title: 'Test Todo',
        owner: 'john@example.com',
        deadline: new Date().toISOString()
      };

      expect(() => validatePayload(payload, '/fake/path/payload.ts')).not.toThrow();
    });

    it('should fail validation when required property is missing', () => {
      vi.mocked(readFileSync).mockReturnValue(examplePayloadType);

      const payload = {
        todoId: '123',
        title: 'Test Todo'
        // owner is missing
      };

      expect(() => validatePayload(payload, '/fake/path/payload.ts')).toThrow(
        'Missing required property: "owner"'
      );
    });

    it('should fail validation when multiple required properties are missing', () => {
      vi.mocked(readFileSync).mockReturnValue(examplePayloadType);

      const payload = {
        todoId: '123'
        // title and owner are missing
      };

      expect(() => validatePayload(payload, '/fake/path/payload.ts')).toThrow(
        'Missing required property: "title"'
      );
      expect(() => validatePayload(payload, '/fake/path/payload.ts')).toThrow(
        'Missing required property: "owner"'
      );
    });

    it('should fail validation when unexpected property is present', () => {
      vi.mocked(readFileSync).mockReturnValue(examplePayloadType);

      const payload = {
        todoId: '123',
        title: 'Test Todo',
        owner: 'john@example.com',
        extra: 'data'
      };

      expect(() => validatePayload(payload, '/fake/path/payload.ts')).toThrow(
        'Unexpected property: "extra". Allowed properties:'
      );
    });

    it('should handle query with optional properties correctly', () => {
      vi.mocked(readFileSync).mockReturnValue(exampleQueryType);

      // Valid: empty payload for query with only optional properties
      expect(() => validatePayload({}, '/fake/path/query.ts')).not.toThrow();

      // Valid: with optional property
      expect(() => validatePayload({status: 'open'}, '/fake/path/query.ts')).not.toThrow();
    });

    it('should fail for query with unexpected property', () => {
      vi.mocked(readFileSync).mockReturnValue(exampleQueryType);

      const payload = {
        status: 'open',
        invalid: 'property'
      };

      expect(() => validatePayload(payload, '/fake/path/query.ts')).toThrow(
        'Unexpected property: "invalid". Allowed properties: [status]'
      );
    });

    it('should allow additional properties when no type definition is provided', () => {
      vi.mocked(readFileSync).mockReturnValue('');

      const payload = {any: 'value', goes: 'here'};
      // Empty type definition

      expect(() => validatePayload(payload, '/fake/path/payload.ts')).not.toThrow();
    });
  });

  describe('getPayloadTypePath', () => {
    it('should resolve correct path for command payload', () => {
      const domainPath = '/home/user/project/src/domain';
      const contextName = 'task-management';
      const commandName = 'TaskManagement.AddTodo';

      const path = getPayloadTypePath(domainPath, contextName, commandName);

      expect(path).toBe('/home/user/project/src/domain/task-management/commands/add-todo/payload.ts');
    });

    it('should handle command names with multiple camelCase parts', () => {
      const domainPath = '/src/domain';
      const contextName = 'crm';
      const commandName = 'Crm.CreateUserWithInvite';

      const path = getPayloadTypePath(domainPath, contextName, commandName);

      expect(path).toBe('/src/domain/crm/commands/create-user-with-invite/payload.ts');
    });
  });

  describe('getQueryTypePath', () => {
    it('should resolve correct path for query', () => {
      const domainPath = '/home/user/project/src/domain';
      const contextName = 'task-management';
      const queryName = 'TaskManagement.TodoList';

      const path = getQueryTypePath(domainPath, contextName, queryName);

      expect(path).toBe('/home/user/project/src/domain/task-management/information/todo-list/query.ts');
    });

    it('should handle query names with multiple camelCase parts', () => {
      const domainPath = '/src/domain';
      const contextName = 'crm';
      const queryName = 'Crm.UserById';

      const path = getQueryTypePath(domainPath, contextName, queryName);

      expect(path).toBe('/src/domain/crm/information/user-by-id/query.ts');
    });
  });
});
