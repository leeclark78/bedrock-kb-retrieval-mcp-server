import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { BedrockKBMCPServer } from '../server.js';
import { BedrockKnowledgeBaseClient } from '../bedrock-client.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../types.js';

// Mock the dependencies
vi.mock('../bedrock-client.js');
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('BedrockKBMCPServer', () => {
  let server: BedrockKBMCPServer;
  let mockBedrockClient: {
    retrieve: Mock;
    retrieveAndGenerate: Mock;
  };
  let config: Config;

  beforeEach(() => {
    config = {
      region: 'us-east-1',
      knowledgeBaseId: 'test-kb-id',
      maxResults: 10,
    };

    mockBedrockClient = {
      retrieve: vi.fn(),
      retrieveAndGenerate: vi.fn(),
    };

    (BedrockKnowledgeBaseClient as any).mockImplementation(() => mockBedrockClient);

    server = new BedrockKBMCPServer(config);
  });

  describe('Tool: retrieve_knowledge', () => {
    it('should retrieve knowledge successfully', async () => {
      const mockResults = [
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
      ];

      mockBedrockClient.retrieve.mockResolvedValueOnce(mockResults);

      // Mock the handler call
      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      // Simulate tool call
      const request = {
        params: {
          name: 'retrieve_knowledge',
          arguments: { query: 'test query' },
        },
      };

      const result = await mockHandler(request);
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.query).toBe('test query');
      expect(responseData.results).toHaveLength(2);
      expect(responseData.results[0].rank).toBe(1);
      expect(responseData.results[0].content).toBe('Test content 1');
      expect(responseData.results[0].score).toBe(0.95);
      expect(responseData.totalResults).toBe(2);
    });

    it('should validate query parameter', async () => {
      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      const request = {
        params: {
          name: 'retrieve_knowledge',
          arguments: {},
        },
      };

      await expect(mockHandler(request)).rejects.toThrow(McpError);
      await expect(mockHandler(request)).rejects.toThrow('Query is required and must be a string');
    });

    it('should handle client errors gracefully', async () => {
      mockBedrockClient.retrieve.mockRejectedValueOnce(new Error('Client error'));

      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      const request = {
        params: {
          name: 'retrieve_knowledge',
          arguments: { query: 'test query' },
        },
      };

      await expect(mockHandler(request)).rejects.toThrow(McpError);
      await expect(mockHandler(request)).rejects.toThrow('Error executing tool');
    });
  });

  describe('Tool: retrieve_and_generate', () => {
    it('should retrieve and generate successfully', async () => {
      const mockResult = {
        output: { text: 'Generated response' },
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

      mockBedrockClient.retrieveAndGenerate.mockResolvedValueOnce(mockResult);

      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      const request = {
        params: {
          name: 'retrieve_and_generate',
          arguments: { query: 'test query' },
        },
      };

      const result = await mockHandler(request);
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.query).toBe('test query');
      expect(responseData.response).toBe('Generated response');
      expect(responseData.sessionId).toBe('session-123');
      expect(responseData.citations).toHaveLength(1);
    });

    it('should manage sessions correctly', async () => {
      mockBedrockClient.retrieveAndGenerate.mockResolvedValueOnce({
        output: { text: 'Response' },
        sessionId: 'bedrock-session-456',
      });

      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      // First call with sessionId
      const request = {
        params: {
          name: 'retrieve_and_generate',
          arguments: { 
            query: 'test query',
            sessionId: 'user-session-1'
          },
        },
      };

      await mockHandler(request);

      // Session should be stored
      expect(mockBedrockClient.retrieveAndGenerate).toHaveBeenCalledWith(
        'test query',
        undefined, // First call should use undefined
        undefined
      );
    });
  });

  describe('Tool: create_session', () => {
    it('should create session with custom name', async () => {
      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      const request = {
        params: {
          name: 'create_session',
          arguments: { sessionName: 'my-session' },
        },
      };

      const result = await mockHandler(request);
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.sessionId).toBe('my-session');
      expect(responseData.message).toBe('Session created successfully');
    });

    it('should create session with auto-generated name', async () => {
      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      const request = {
        params: {
          name: 'create_session',
          arguments: {},
        },
      };

      const result = await mockHandler(request);
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.sessionId).toMatch(/^session_\d+$/);
      expect(responseData.message).toBe('Session created successfully');
    });
  });

  describe('Tool: list_sessions', () => {
    it('should list all sessions', async () => {
      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      // Create a session first
      await mockHandler({
        params: {
          name: 'create_session',
          arguments: { sessionName: 'test-session' },
        },
      });

      // List sessions
      const request = {
        params: {
          name: 'list_sessions',
          arguments: {},
        },
      };

      const result = await mockHandler(request);
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.sessions).toHaveLength(1);
      expect(responseData.sessions[0].sessionId).toBe('test-session');
      expect(responseData.sessions[0].active).toBe(false);
      expect(responseData.totalSessions).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw MethodNotFound for unknown tool', async () => {
      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      };

      await expect(mockHandler(request)).rejects.toThrow(McpError);
      await expect(mockHandler(request)).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should preserve McpError instances', async () => {
      const mockHandler = vi.fn();
      server.getServer().setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
        if (schema === 'CallToolRequestSchema') {
          mockHandler.mockImplementation(handler);
        }
      });

      const request = {
        params: {
          name: 'retrieve_knowledge',
          arguments: { query: null },
        },
      };

      await expect(mockHandler(request)).rejects.toThrow(McpError);
    });
  });
});