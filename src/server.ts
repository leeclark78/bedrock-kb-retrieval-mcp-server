import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { BedrockKnowledgeBaseClient } from './bedrock-client.js';
import type { Config } from './types.js';

export class BedrockKBMCPServer {
  private server: Server;
  private bedrockClient: BedrockKnowledgeBaseClient;
  private sessions: Map<string, string> = new Map();

  constructor(config: Config) {
    this.server = new Server(
      {
        name: 'bedrock-kb-retrieval-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.bedrockClient = new BedrockKnowledgeBaseClient(config);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'retrieve_knowledge',
          description: 'Retrieve relevant information from AWS Bedrock Knowledge Base',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to retrieve relevant information',
              },
              sessionId: {
                type: 'string',
                description: 'Optional session ID to maintain context across requests',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'retrieve_and_generate',
          description: 'Retrieve information and generate a response using AWS Bedrock Knowledge Base',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The question or prompt to generate a response for',
              },
              sessionId: {
                type: 'string',
                description: 'Optional session ID to maintain conversation context',
              },
              systemPrompt: {
                type: 'string',
                description: 'Optional system prompt to customize the response generation',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'create_session',
          description: 'Create a new session for maintaining conversation context',
          inputSchema: {
            type: 'object',
            properties: {
              sessionName: {
                type: 'string',
                description: 'Optional name for the session',
              },
            },
          },
        },
        {
          name: 'list_sessions',
          description: 'List all active sessions',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'retrieve_knowledge': {
            const { query, sessionId } = args as {
              query: string;
              sessionId?: string;
            };

            if (!query || typeof query !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'Query is required and must be a string');
            }

            const results = await this.bedrockClient.retrieve(query, sessionId);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    query,
                    results: results.map((result, index) => ({
                      rank: index + 1,
                      content: result.content.text,
                      score: result.score,
                      source: result.location?.s3Location?.uri || 'Unknown',
                      metadata: result.metadata,
                    })),
                    totalResults: results.length,
                  }, null, 2),
                },
              ],
            };
          }

          case 'retrieve_and_generate': {
            const { query, sessionId, systemPrompt } = args as {
              query: string;
              sessionId?: string;
              systemPrompt?: string;
            };

            if (!query || typeof query !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'Query is required and must be a string');
            }

            let actualSessionId = sessionId;
            if (sessionId && this.sessions.has(sessionId)) {
              actualSessionId = this.sessions.get(sessionId);
            }

            const result = await this.bedrockClient.retrieveAndGenerate(
              query,
              actualSessionId,
              systemPrompt
            );

            // Store or update session ID
            if (result.sessionId) {
              if (sessionId) {
                this.sessions.set(sessionId, result.sessionId);
              } else {
                const newSessionId = `session_${Date.now()}`;
                this.sessions.set(newSessionId, result.sessionId);
              }
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    query,
                    response: result.output.text,
                    sessionId: result.sessionId,
                    citations: result.citations?.map((citation, index) => ({
                      id: index + 1,
                      text: citation.generatedResponsePart.textResponsePart.text,
                      span: citation.generatedResponsePart.textResponsePart.span,
                      sources: citation.retrievedReferences.map(ref => ({
                        content: ref.content.text,
                        source: ref.location?.s3Location?.uri || 'Unknown',
                        metadata: ref.metadata,
                      })),
                    })),
                  }, null, 2),
                },
              ],
            };
          }

          case 'create_session': {
            const { sessionName } = args as { sessionName?: string };
            const sessionId = sessionName || `session_${Date.now()}`;
            
            // Initialize empty session
            this.sessions.set(sessionId, '');

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    sessionId,
                    message: 'Session created successfully',
                  }, null, 2),
                },
              ],
            };
          }

          case 'list_sessions': {
            const sessions = Array.from(this.sessions.entries()).map(([id, bedrockSessionId]) => ({
              sessionId: id,
              bedrockSessionId: bedrockSessionId || null,
              active: !!bedrockSessionId,
            }));

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    sessions,
                    totalSessions: sessions.length,
                  }, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${request.params.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  async run(): Promise<void> {
    const transport = this.server.connect();
    await transport;
  }

  getServer(): Server {
    return this.server;
  }
}