import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  RetrieveAndGenerateCommand,
  type RetrieveCommandInput,
  type RetrieveAndGenerateCommandInput,
} from '@aws-sdk/client-bedrock-agent-runtime';
import type { Config, RetrievalResult, RetrieveAndGenerateResult } from './types.js';

export class BedrockKnowledgeBaseClient {
  private client: BedrockAgentRuntimeClient;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.client = new BedrockAgentRuntimeClient({
      region: config.region,
    });
  }

  async retrieve(query: string, sessionId?: string): Promise<RetrievalResult[]> {
    const input: RetrieveCommandInput = {
      knowledgeBaseId: this.config.knowledgeBaseId,
      retrievalQuery: {
        text: query,
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: this.config.maxResults,
          ...(this.config.rerankingModelArn && {
            rerankingConfiguration: {
              type: 'BEDROCK_RERANKING_MODEL',
              bedrockRerankingConfiguration: {
                modelConfiguration: {
                  modelArn: this.config.rerankingModelArn,
                },
              },
            },
          }),
        },
      },
      ...(sessionId && { nextToken: sessionId }),
    };

    try {
      const response = await this.client.send(new RetrieveCommand(input));
      
      return (response.retrievalResults || []).map(result => ({
        content: {
          text: result.content?.text || '',
        },
        location: result.location,
        score: result.score,
        metadata: result.metadata,
      }));
    } catch (error) {
      throw new Error(`Failed to retrieve from knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async retrieveAndGenerate(
    query: string, 
    sessionId?: string,
    systemPrompt?: string
  ): Promise<RetrieveAndGenerateResult> {
    const input: RetrieveAndGenerateCommandInput = {
      input: {
        text: query,
      },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: this.config.knowledgeBaseId,
          modelArn: this.config.modelArn,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: this.config.maxResults,
              ...(this.config.rerankingModelArn && {
                rerankingConfiguration: {
                  type: 'BEDROCK_RERANKING_MODEL',
                  bedrockRerankingConfiguration: {
                    modelConfiguration: {
                      modelArn: this.config.rerankingModelArn,
                    },
                  },
                },
              }),
            },
          },
          ...(systemPrompt && {
            generationConfiguration: {
              promptTemplate: {
                textPromptTemplate: systemPrompt,
              },
            },
          }),
        },
      },
      ...(sessionId && { sessionId }),
    };

    try {
      const response = await this.client.send(new RetrieveAndGenerateCommand(input));
      
      return {
        output: {
          text: response.output?.text || '',
        },
        citations: response.citations?.map(citation => ({
          generatedResponsePart: {
            textResponsePart: {
              text: citation.generatedResponsePart?.textResponsePart?.text || '',
              span: {
                start: citation.generatedResponsePart?.textResponsePart?.span?.start || 0,
                end: citation.generatedResponsePart?.textResponsePart?.span?.end || 0,
              },
            },
          },
          retrievedReferences: (citation.retrievedReferences || []).map(ref => ({
            content: {
              text: ref.content?.text || '',
            },
            location: ref.location,
            metadata: ref.metadata,
          })),
        })),
        sessionId: response.sessionId,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve and generate from knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}