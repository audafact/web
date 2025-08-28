import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '../../src/services/storageService';

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123',
    subtle: {
      digest: vi.fn(),
    },
  },
  writable: true,
});

// Mock hash functions
vi.mock('../../src/lib/hash', () => ({
  sha256Blob: vi.fn().mockResolvedValue('test-hash-1234567890abcdef'),
  shortHex: vi.fn().mockReturnValue('test-hash'),
}));

// Mock keys functions
vi.mock('../../src/lib/keys', () => ({
  userUploadKey: vi.fn().mockReturnValue('users/test-user/uploads/test-uuid-123-test-audio.mp3'),
}));

// Mock Supabase
vi.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('StorageService (R2 Hash-Based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadAudioFile', () => {
    it('should compute hash and generate key for file upload', async () => {
      // Mock file
      const mockFile = new File(['test audio content'], 'test-audio.mp3', {
        type: 'audio/mpeg',
      });

      // Mock Supabase session
      const { supabase } = await import('../../src/services/supabase');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      });

      // Mock signed upload response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://r2.example.com/signed-upload-url',
          key: 'users/test-user/uploads/test-uuid-123-test-audio.mp3',
        }),
      });

      // Mock R2 upload response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const result = await StorageService.uploadAudioFile(mockFile, 'test-user', 'Test Audio');

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.metadata.fullHash).toBeDefined();
      expect(result.data?.metadata.shortHash).toBeDefined();
      expect(result.data?.metadata.serverKey).toBe('users/test-user/uploads/test-uuid-123-test-audio.mp3');
      expect(result.data?.metadata.sizeBytes).toBe(mockFile.size);
      expect(result.data?.metadata.contentType).toBe('audio/mpeg');
      expect(result.data?.metadata.originalName).toBe('test-audio.mp3');
      expect(result.data?.metadata.title).toBe('Test Audio');
    });

    it('should handle upload errors gracefully', async () => {
      const mockFile = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' });

      // Mock Supabase session
      const { supabase } = await import('../../src/services/supabase');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      });

      // Mock signed upload failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await StorageService.uploadAudioFile(mockFile, 'test-user');

      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
    });

    it('should handle missing authentication token', async () => {
      const mockFile = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' });

      // Mock Supabase session without token
      const { supabase } = await import('../../src/services/supabase');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: null },
      });

      const result = await StorageService.uploadAudioFile(mockFile, 'test-user');

      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
    });
  });

  describe('checkDuplicateFile', () => {
    it('should check for duplicate files by hash', async () => {
      const { supabase } = await import('../../src/services/supabase');
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'existing-upload-id' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await StorageService.checkDuplicateFile('test-hash', 'test-user');

      expect(result).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      const { supabase } = await import('../../src/services/supabase');
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }, // No rows returned
              }),
            }),
          }),
        }),
      });

      const result = await StorageService.checkDuplicateFile('non-existent-hash', 'test-user');

      expect(result).toBe(false);
    });
  });
});
