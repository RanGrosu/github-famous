// tests/providers/resend.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../src/utils/logging';
import { ResendPublisher } from '../../src/publishers/resend';
import { ResendClient } from '../../src/clients/resend';
import { mockRepos } from '../../src/mocks/repos';
import { ScoredRepo } from '../../src/pipeline/select';

describe('resend.ts', () => {
  const mockFetch = vi.fn();
  let instance: ResendPublisher;

  const repos: ScoredRepo[] = mockRepos.map(repo => ({ ...repo, score: 0 }));
  const content = {
    html: '<p>Hello world</p>',
    text: 'Hello world',
  };

  beforeEach(() => {
    instance = new ResendPublisher();
    vi.spyOn(instance, 'render').mockReturnValue(content);
    global.fetch = mockFetch as unknown as typeof fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('enabled', () => {
    it('should return false when RESEND_ENABLED is false', () => {
      vi.stubEnv('RESEND_ENABLED', 'false');

      expect(instance.enabled()).toBe(false);
    });

    it('should return false when RESEND_ENABLED is undefined', () => {
      vi.stubEnv('RESEND_ENABLED', undefined);

      expect(instance.enabled()).toBe(false);
    });

    it('should return true when RESEND_ENABLED is true', () => {
      vi.stubEnv('RESEND_ENABLED', 'true');

      expect(instance.enabled()).toBe(true);
    });
  });

  describe('publish.config', () => {
    it('should throw when RESEND_FROM is missing', async () => {
      vi.stubEnv('RESEND_FROM', undefined);
      vi.stubEnv('RESEND_TO', 'user@gmail.com');
      vi.stubEnv('RESEND_API_KEY', 're_live_key_123');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_FROM');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_FROM is empty', async () => {
      vi.stubEnv('RESEND_FROM', '');
      vi.stubEnv('RESEND_TO', 'user@gmail.com');
      vi.stubEnv('RESEND_API_KEY', 're_live_key_123');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_FROM');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_TO is missing', async () => {
      vi.stubEnv('RESEND_FROM', 'Sender <sender@example.com>');
      vi.stubEnv('RESEND_TO', undefined);
      vi.stubEnv('RESEND_API_KEY', 're_live_key_123');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_TO');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_TO is empty', async () => {
      vi.stubEnv('RESEND_FROM', 'Sender <sender@example.com>');
      vi.stubEnv('RESEND_TO', '');
      vi.stubEnv('RESEND_API_KEY', 're_live_key_123');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_TO');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_API_KEY is missing', async () => {
      vi.stubEnv('RESEND_FROM', 'Sender <sender@example.com>');
      vi.stubEnv('RESEND_TO', 'user@gmail.com');
      vi.stubEnv('RESEND_API_KEY', undefined);

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_API_KEY');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when RESEND_API_KEY is empty', async () => {
      vi.stubEnv('RESEND_FROM', 'Sender <sender@example.com>');
      vi.stubEnv('RESEND_TO', 'user@gmail.com');
      vi.stubEnv('RESEND_API_KEY', '');

      await expect(instance.publish(repos)).rejects.toThrow('RESEND_API_KEY');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    const token = 're_live_key_123';
    const from = 'GitHub Trends <newsletter@example.com>';
    const to = 'user@gmail.com';

    beforeEach(() => {
      vi.stubEnv('RESEND_API_KEY', token);
      vi.stubEnv('RESEND_FROM', from);
      vi.stubEnv('RESEND_TO', to);
    });

    it('should make a well-formed request', async () => {
      const id = 're_email_001';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id }),
      });

      await expect(instance.publish(repos)).resolves.toBe(id);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        ResendClient.baseUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }),
        })
      );

      const [, opts] = mockFetch.mock.calls[0]!;
      const body = JSON.parse(opts!.body as string);
      expect(body).toEqual({
        from,
        to,
        subject: instance.subject(),
        html: content.html,
        text: content.text,
      });
    });

    it('should throw when send returns no ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // no id
      });

      await expect(instance.publish(repos)).rejects.toThrowError(HttpError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('invalid JSON')),
      });

      await expect(instance.publish(repos)).rejects.toThrow('invalid JSON');
    });

    it('should throw on 5xx HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('internal server error'),
      });

      await expect(instance.publish(repos)).rejects.toThrowError(HttpError);
    });

    it('should throw on network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network down'));

      await expect(instance.publish(repos)).rejects.toThrow('network down');
    });
  });
});
