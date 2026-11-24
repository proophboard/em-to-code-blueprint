import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { parseInvocation, printHelp } from './config.js';

describe('config', () => {
  describe('parseInvocation', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
      process.env = originalEnv;
    });

    it('parses invocation from argv and env vars', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };

      const result = parseInvocation([], env);

      expect(result.chapterId).toBe('chapter-123');
      expect(result.sliceId).toBe('slice-456');
      expect(result.endpoint).toBe('https://flow.prooph-board.com/api');
      expect(result.apiKey).toBe('test-key-123');
      expect(result.dryRun).toBe(false);
      expect(result.eventSourced).toBe(false);
    });

    it('accepts chapterId and sliceId from argv', () => {
      const env = {
        PROOPHBOARD_API_KEY: 'test-key-123'
      };
      const argv = ['--chapter-id', 'chapter-123', '--slice-id', 'slice-456'];

      const result = parseInvocation(argv, env);

      expect(result.chapterId).toBe('chapter-123');
      expect(result.sliceId).toBe('slice-456');
    });

    it('accepts sliceId as positional arg (spec-stream invocation)', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };

      const result = parseInvocation(['slice-456'], env);

      expect(result.sliceId).toBe('slice-456');
    });

    it('prefers --slice-id over positional arg and env', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'env-slice',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };

      const result = parseInvocation(['positional-slice', '--slice-id', 'flag-slice'], env);

      expect(result.sliceId).toBe('flag-slice');
    });

    it('uses chapterId from stdin event JSON when env var is missing', () => {
      const env = {
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };
      const stdinText = JSON.stringify({ mode: 'single', event: { chapterId: 'stdin-chapter' }, row: {} });

      const result = parseInvocation([], env, stdinText);

      expect(result.chapterId).toBe('stdin-chapter');
    });

    it('prefers env chapterId over stdin', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'env-chapter',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };
      const stdinText = JSON.stringify({ event: { chapterId: 'stdin-chapter' } });

      const result = parseInvocation([], env, stdinText);

      expect(result.chapterId).toBe('env-chapter');
    });

    it('argv values take precedence over env vars', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'env-chapter',
        SPEC_STREAM_SLICE_ID: 'env-slice',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };
      const argv = ['--chapter-id', 'cli-chapter', '--slice-id', 'cli-slice'];

      const result = parseInvocation(argv, env);

      expect(result.chapterId).toBe('cli-chapter');
      expect(result.sliceId).toBe('cli-slice');
    });

    it('uses default endpoint when not provided', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };

      const result = parseInvocation(['--endpoint', 'https://custom.api.com'], env);

      expect(result.endpoint).toBe('https://custom.api.com');
    });

    it('sets dryRun from --dry-run flag', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };
      const argv = ['--dry-run'];

      const result = parseInvocation(argv, env);

      expect(result.dryRun).toBe(true);
    });

    it('sets dryRun from BRIDGE_DRY_RUN env var', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123',
        BRIDGE_DRY_RUN: 'true'
      };

      const result = parseInvocation([], env);

      expect(result.dryRun).toBe(true);
    });

    it('sets eventSourced from --event-sourced flag', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };
      const argv = ['--event-sourced'];

      const result = parseInvocation(argv, env);

      expect(result.eventSourced).toBe(true);
    });

    it('sets eventSourced from BRIDGE_EVENT_SOURCED env var', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123',
        BRIDGE_EVENT_SOURCED: 'true'
      };

      const result = parseInvocation([], env);

      expect(result.eventSourced).toBe(true);
    });

    it('includes stdin input in result', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };
      const stdinText = '{"event": "slice-status-changed", "data": {}}';

      const result = parseInvocation([], env, stdinText);

      expect(result.inputText).toBe(stdinText);
    });

    it('throws error when chapter ID is missing', () => {
      const env = {
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };

      expect(() => parseInvocation([], env)).toThrow('Missing chapter ID');
    });

    it('throws error when slice ID is missing', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        PROOPHBOARD_API_KEY: 'test-key-123'
      };

      expect(() => parseInvocation([], env)).toThrow('Missing slice ID');
    });

    it('throws error when API key is missing', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456'
      };

      expect(() => parseInvocation([], env)).toThrow('Missing API key');
    });

    it('handles multiple argv arguments', () => {
      const env = {
        PROOPHBOARD_API_KEY: 'test-key-123'
      };
      const argv = [
        '--chapter-id', 'chapter-123',
        '--slice-id', 'slice-456',
        '--endpoint', 'https://custom.api.com',
        '--dry-run'
      ];

      const result = parseInvocation(argv, env);

      expect(result.chapterId).toBe('chapter-123');
      expect(result.sliceId).toBe('slice-456');
      expect(result.endpoint).toBe('https://custom.api.com');
      expect(result.dryRun).toBe(true);
    });

    it('uses env var endpoint when not in argv', () => {
      const env = {
        SPEC_STREAM_CHAPTER_ID: 'chapter-123',
        SPEC_STREAM_SLICE_ID: 'slice-456',
        PROOPHBOARD_API_KEY: 'test-key-123',
        PROOPHBOARD_API_ENDPOINT: 'https://env.api.com'
      };

      const result = parseInvocation([], env);

      expect(result.endpoint).toBe('https://env.api.com');
    });
  });

  describe('printHelp', () => {
    it('prints help message to stdout', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      printHelp();

      expect(logSpy).toHaveBeenCalled();
      const call = logSpy.mock.calls[0][0];
      expect(call).toContain('Bridge: Event Model');
      expect(call).toContain('--chapter-id');
      expect(call).toContain('--slice-id');
      expect(call).toContain('--dry-run');
      expect(call).toContain('--event-sourced');
    });
  });
});
