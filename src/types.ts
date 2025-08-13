import { z } from 'zod';

export const ConfigSchema = z.object({
  region: z.string().default('us-east-1'),
  knowledgeBaseId: z.string(),
  modelArn: z.string().optional(),
  maxResults: z.number().min(1).max(100).default(10),
  rerankingModelArn: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface RetrievalResult {
  content: {
    text: string;
  };
  location?: {
    type: string;
    s3Location?: {
      uri: string;
    };
  };
  score?: number;
  metadata?: Record<string, any>;
}

export interface RetrieveAndGenerateResult {
  output: {
    text: string;
  };
  citations?: Array<{
    generatedResponsePart: {
      textResponsePart: {
        text: string;
        span: {
          start: number;
          end: number;
        };
      };
    };
    retrievedReferences: Array<{
      content: {
        text: string;
      };
      location?: {
        type: string;
        s3Location?: {
          uri: string;
        };
      };
      metadata?: Record<string, any>;
    }>;
  }>;
  sessionId?: string;
}