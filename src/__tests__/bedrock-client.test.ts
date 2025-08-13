import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { BedrockAgentRuntimeClient, RetrieveCommand, RetrieveAndGenerateCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockKnowledgeBaseClient } from '../bedrock-client.js';
import type { Config } from '../types.js';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: vi.fn(),
  RetrieveCommand: vi.fn(),
  RetrieveAndGenerateCommand: vi.fn(),
}));

describe('BedrockKnowledgeBaseClient', () => {
  let client: BedrockKnowledgeBaseClient;
  let mockAwsClient: { send: Mock };
  let config: Config;

  beforeEach(() => {
    mockAwsClient = {
      send: vi.fn(),
    };

    (BedrockAgentRuntimeClient as any).mockImplementation(() => mockAwsClient);

    config = {
      region: 'us-east-1',
      knowledgeBaseId: 'test-kb-id',
      maxResults: 10,
    };

    client = new BedrockKnowledgeBaseClient(config);
  });

  describe('retrieve', () => {
    it('should retrieve results successfully', async () => {
      const mockResponse = {
        retrievalResults: [
          {
            content: { text: 'Test content 1' },
            score: 0.95,
            location: { s3Location: { uri: 's3://bucket/doc1.pdf' } },
            metadata: { source: 'document1' },
          },
          {
            content: { text: 'Test content 2' },
            score: 0.88,
            location: { s3Location: { uri: 's3://bucket/doc2.pdf' } },
            metadata: { source: 'document2' },
          },
        ],
      };

      mockAwsClient.send.mockResolvedValueOnce(mockResponse);

      const results = await client.retrieve('test query');

      expect(results).toHaveLength(2);
      expect(results[0].content.text).toBe('Test content 1');
      expect(results[0].score).toBe(0.95);
      expect(results[0].location?.s3Location?.uri).toBe('s3://bucket/doc1.pdf');
      expect(results[0].metadata).toEqual({ source: 'document1' });
    });

    it('should handle empty results', async () => {
      mockAwsClient.send.mockResolvedValueOnce({ retrievalResults: [] });

      const results = await client.retrieve('test query');

      expect(results).toHaveLength(0);
    });

    it('should handle missing retrievalResults', async () => {
      mockAwsClient.send.mockResolvedValueOnce({});

      const results = await client.retrieve('test query');

      expect(results).toHaveLength(0);
    });

    it('should use reranking model when configured', async () => {
      const configWithReranking = {
        ...config,
        rerankingModelArn: 'arn:aws:bedrock:us-east-1:123456789012:model/rerank',
      };
      const clientWithReranking = new BedrockKnowledgeBaseClient(configWithReranking);

      mockAwsClient.send.mockResolvedValueOnce({ retrievalResults: [] });

      await clientWithReranking.retrieve('test query');

      expect(RetrieveCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          retrievalConfiguration: expect.objectContaining({
            vectorSearchConfiguration: expect.objectContaining({
              rerankingConfiguration: expect.objectContaining({
                type: 'BEDROCK_RERANKING_MODEL',
                bedrockRerankingConfiguration: expect.objectContaining({
                  modelConfiguration: expect.objectContaining({
                    modelArn: 'arn:aws:bedrock:us-east-1:123456789012:model/rerank',
                  }),
                }),
              }),
            }),
          }),
        })
      );
    });

    it('should throw descriptive error on AWS error', async () => {
      const awsError = new Error('AccessDenied: Insufficient permissions');
      mockAwsClient.send.mockRejectedValueOnce(awsError);

      await expect(client.retrieve('test query')).rejects.toThrow(
        'Failed to retrieve from knowledge base: AccessDenied: Insufficient permissions'
      );
    });

    it('should handle unknown errors', async () => {
      mockAwsClient.send.mockRejectedValueOnce('Unknown error');

      await expect(client.retrieve('test query')).rejects.toThrow(
        'Failed to retrieve from knowledge base: Unknown error'
      );
    });
  });

  describe('retrieveAndGenerate', () => {
    it('should retrieve and generate response successfully', async () => {
      const mockResponse = {
        output: { text: 'Generated response text' },
        sessionId: 'session-123',
        citations: [
          {
            generatedResponsePart: {
              textResponsePart: {
                text: 'citation text',
                span: { start: 0, end: 13 },
              },
            },
            retrievedReferences: [
              {
                content: { text: 'Reference content' },
                location: { s3Location: { uri: 's3://bucket/ref.pdf' } },
                metadata: { type: 'reference' },
              },
            ],
          },
        ],
      };

      mockAwsClient.send.mockResolvedValueOnce(mockResponse);

      const result = await client.retrieveAndGenerate('test query');

      expect(result.output.text).toBe('Generated response text');
      expect(result.sessionId).toBe('session-123');
      expect(result.citations).toHaveLength(1);
      expect(result.citations![0].generatedResponsePart.textResponsePart.text).toBe('citation text');
      expect(result.citations![0].retrievedReferences).toHaveLength(1);
    });

    it('should handle response without citations', async () => {
      mockAwsClient.send.mockResolvedValueOnce({
        output: { text: 'Generated response' },
        sessionId: 'session-456',
      });

      const result = await client.retrieveAndGenerate('test query');

      expect(result.output.text).toBe('Generated response');
      expect(result.sessionId).toBe('session-456');
      expect(result.citations).toBeUndefined();
    });

    it('should use custom system prompt when provided', async () => {
      mockAwsClient.send.mockResolvedValueOnce({
        output: { text: 'Custom response' },
      });

      await client.retrieveAndGenerate('test query', undefined, 'Custom system prompt');

      expect(RetrieveAndGenerateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          retrieveAndGenerateConfiguration: expect.objectContaining({
            knowledgeBaseConfiguration: expect.objectContaining({
              generationConfiguration: expect.objectContaining({
                promptTemplate: expect.objectContaining({
                  textPromptTemplate: 'Custom system prompt',
                }),
              }),
            }),
          }),
        })
      );
    });

    it('should include sessionId in request when provided', async () => {
      mockAwsClient.send.mockResolvedValueOnce({
        output: { text: 'Response with session' },
      });

      await client.retrieveAndGenerate('test query', 'existing-session');

      expect(RetrieveAndGenerateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'existing-session',
        })
      );
    });

    it('should throw descriptive error on AWS error', async () => {
      const awsError = new Error('ThrottlingException: Request rate exceeded');
      mockAwsClient.send.mockRejectedValueOnce(awsError);

      await expect(client.retrieveAndGenerate('test query')).rejects.toThrow(
        'Failed to retrieve and generate from knowledge base: ThrottlingException: Request rate exceeded'
      );
    });
  });
});