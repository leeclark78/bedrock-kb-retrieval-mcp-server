import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../types.js';

describe('Types', () => {
  describe('ConfigSchema', () => {
    it('should validate valid config', () => {
      const validConfig = {
        region: 'us-west-2',
        knowledgeBaseId: 'kb-123456789',
        maxResults: 20,
      };

      const result = ConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should use default values', () => {
      const minimalConfig = {
        knowledgeBaseId: 'kb-123456789',
      };

      const result = ConfigSchema.parse(minimalConfig);
      expect(result.region).toBe('us-east-1');
      expect(result.maxResults).toBe(10);
    });

    it('should validate maxResults range', () => {
      expect(() => ConfigSchema.parse({
        knowledgeBaseId: 'kb-123',
        maxResults: 0,
      })).toThrow();

      expect(() => ConfigSchema.parse({
        knowledgeBaseId: 'kb-123',
        maxResults: 101,
      })).toThrow();

      // Valid range
      expect(() => ConfigSchema.parse({
        knowledgeBaseId: 'kb-123',
        maxResults: 50,
      })).not.toThrow();
    });

    it('should require knowledgeBaseId', () => {
      expect(() => ConfigSchema.parse({
        region: 'us-east-1',
      })).toThrow();
    });

    it('should accept optional fields', () => {
      const configWithOptionals = {
        knowledgeBaseId: 'kb-123456789',
        modelArn: 'arn:aws:bedrock:us-east-1:123456789012:model/test',
        rerankingModelArn: 'arn:aws:bedrock:us-east-1:123456789012:model/rerank',
      };

      const result = ConfigSchema.parse(configWithOptionals);
      expect(result.modelArn).toBe('arn:aws:bedrock:us-east-1:123456789012:model/test');
      expect(result.rerankingModelArn).toBe('arn:aws:bedrock:us-east-1:123456789012:model/rerank');
    });

    it('should validate string types', () => {
      expect(() => ConfigSchema.parse({
        knowledgeBaseId: 123,
        region: 'us-east-1',
      })).toThrow();

      expect(() => ConfigSchema.parse({
        knowledgeBaseId: 'kb-123',
        region: 123,
      })).toThrow();
    });
  });
});