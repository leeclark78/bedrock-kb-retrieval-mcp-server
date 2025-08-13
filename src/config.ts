import { z } from 'zod';
import { ConfigSchema, type Config } from './types.js';

export function loadConfig(): Config {
  const config = {
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
    modelArn: process.env.MODEL_ARN,
    maxResults: process.env.MAX_RESULTS ? parseInt(process.env.MAX_RESULTS, 10) : 10,
    rerankingModelArn: process.env.RERANKING_MODEL_ARN,
  };

  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Configuration validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}

export function validateEnvironment(): void {
  const requiredEnvVars = ['KNOWLEDGE_BASE_ID'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n\n` +
      'Required environment variables:\n' +
      '  KNOWLEDGE_BASE_ID - AWS Bedrock Knowledge Base ID\n\n' +
      'Optional environment variables:\n' +
      '  AWS_REGION - AWS region (default: us-east-1)\n' +
      '  MODEL_ARN - Model ARN for RetrieveAndGenerate operations\n' +
      '  MAX_RESULTS - Maximum number of results (default: 10)\n' +
      '  RERANKING_MODEL_ARN - Reranking model ARN for improved relevance'
    );
  }
}