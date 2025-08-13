import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConfig, validateEnvironment } from '../config.js';

describe('Config', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.KNOWLEDGE_BASE_ID;
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.MODEL_ARN;
    delete process.env.MAX_RESULTS;
    delete process.env.RERANKING_MODEL_ARN;
  });

  describe('validateEnvironment', () => {
    it('should pass when KNOWLEDGE_BASE_ID is provided', () => {
      process.env.KNOWLEDGE_BASE_ID = 'test-kb-id';
      expect(() => validateEnvironment()).not.toThrow();
    });

    it('should throw when KNOWLEDGE_BASE_ID is missing', () => {
      expect(() => validateEnvironment()).toThrow('Missing required environment variables: KNOWLEDGE_BASE_ID');
    });

    it('should include helpful documentation in error message', () => {
      expect(() => validateEnvironment()).toThrow(/Required environment variables:/);
      expect(() => validateEnvironment()).toThrow(/Optional environment variables:/);
    });
  });

  describe('loadConfig', () => {
    beforeEach(() => {
      process.env.KNOWLEDGE_BASE_ID = 'test-kb-id';
    });

    it('should load config with required values', () => {
      const config = loadConfig();
      expect(config.knowledgeBaseId).toBe('test-kb-id');
      expect(config.region).toBe('us-east-1'); // default
      expect(config.maxResults).toBe(10); // default
    });

    it('should use AWS_REGION when provided', () => {
      process.env.AWS_REGION = 'eu-west-1';
      const config = loadConfig();
      expect(config.region).toBe('eu-west-1');
    });

    it('should use AWS_DEFAULT_REGION when AWS_REGION not provided', () => {
      process.env.AWS_DEFAULT_REGION = 'ap-southeast-1';
      const config = loadConfig();
      expect(config.region).toBe('ap-southeast-1');
    });

    it('should prefer AWS_REGION over AWS_DEFAULT_REGION', () => {
      process.env.AWS_REGION = 'eu-west-1';
      process.env.AWS_DEFAULT_REGION = 'ap-southeast-1';
      const config = loadConfig();
      expect(config.region).toBe('eu-west-1');
    });

    it('should parse optional values correctly', () => {
      process.env.MODEL_ARN = 'arn:aws:bedrock:us-east-1:123456789012:model/test';
      process.env.MAX_RESULTS = '25';
      process.env.RERANKING_MODEL_ARN = 'arn:aws:bedrock:us-east-1:123456789012:model/rerank';

      const config = loadConfig();
      expect(config.modelArn).toBe('arn:aws:bedrock:us-east-1:123456789012:model/test');
      expect(config.maxResults).toBe(25);
      expect(config.rerankingModelArn).toBe('arn:aws:bedrock:us-east-1:123456789012:model/rerank');
    });

    it('should validate maxResults range', () => {
      process.env.MAX_RESULTS = '0';
      expect(() => loadConfig()).toThrow(/Configuration validation failed/);

      process.env.MAX_RESULTS = '101';
      expect(() => loadConfig()).toThrow(/Configuration validation failed/);
    });

    it('should handle invalid MAX_RESULTS gracefully', () => {
      process.env.MAX_RESULTS = 'invalid';
      const config = loadConfig();
      expect(config.maxResults).toBe(10); // Should use default when NaN
    });

    it('should throw descriptive error for missing KNOWLEDGE_BASE_ID', () => {
      delete process.env.KNOWLEDGE_BASE_ID;
      expect(() => loadConfig()).toThrow(/Configuration validation failed/);
      expect(() => loadConfig()).toThrow(/knowledgeBaseId: Required/);
    });
  });
});