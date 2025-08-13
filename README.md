# AWS Bedrock Knowledge Base Retrieval MCP Server

A Model Context Protocol (MCP) server that provides integration with AWS Bedrock Knowledge Bases for retrieval-augmented generation (RAG) workflows.

## Features

- Knowledge Base Retrieval: Query AWS Bedrock Knowledge Bases to retrieve relevant documents
- Retrieve and Generate: Combine knowledge base retrieval with LLM generation for comprehensive responses
- Session Management: Maintain conversation context across multiple interactions
- Configurable Parameters: Control result limits, reranking models, and more
- Type Safety: Full TypeScript implementation with comprehensive error handling

## Tools Provided

### `retrieve_knowledge`
Retrieve relevant information from your AWS Bedrock Knowledge Base.

Parameters:
- query (required): The search query
- sessionId (optional): Session ID for context continuity
- maxResults (optional): Maximum number of results (1-100)

Returns: JSON object with ranked results, scores, and source information.

### `retrieve_and_generate`
Retrieve information and generate a contextual response using your knowledge base.

Parameters:
- query (required): The question or prompt
- sessionId (optional): Session ID for conversation continuity
- systemPrompt (optional): Custom system prompt for response generation

Returns: Generated response with citations and source references.

### `create_session`
Create a new session for maintaining conversation context.

Parameters:
- sessionName (optional): Custom name for the session

Returns: Session ID for future requests.

### `list_sessions`
List all active sessions and their status.

Returns: Array of active sessions with their IDs and status.

## Installation

```bash
npm install
npm run build
```

## Configuration

The server is configured via environment variables:

Required:
- KNOWLEDGE_BASE_ID: Your AWS Bedrock Knowledge Base ID

Optional:
- AWS_REGION: AWS region (default: us-east-1)
- MODEL_ARN: Model ARN for RetrieveAndGenerate operations
- MAX_RESULTS: Maximum number of results per query (default: 10)
- RERANKING_MODEL_ARN: ARN of reranking model for improved relevance

AWS Credentials:
Configure AWS credentials using any of the standard methods:
- AWS credentials file (~/.aws/credentials)
- Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
- IAM roles (for EC2/Lambda)
- AWS SSO

## Usage

Running the Server:

```bash
# Development
npm run dev

# Production
npm start
```

Claude Desktop Configuration:

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "bedrock-kb-retrieval": {
      "command": "node",
      "args": ["/path/to/bedrock-kb-retrieval-mcp-server/dist/index.js"],
      "env": {
        "KNOWLEDGE_BASE_ID": "your-knowledge-base-id",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

Example Queries:

```typescript
// Simple knowledge retrieval
await retrieveKnowledge({
  query: "What are the benefits of renewable energy?",
  maxResults: 5
});

// Generate comprehensive response
await retrieveAndGenerate({
  query: "Explain the environmental impact of solar panels",
  systemPrompt: "Provide a balanced analysis with both benefits and challenges"
});

// Maintain conversation context
const session = await createSession({ sessionName: "energy-discussion" });
await retrieveAndGenerate({
  query: "What about wind energy?",
  sessionId: session.sessionId
});
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude App    │───▶│   MCP Server    │───▶│ AWS Bedrock KB  │
│                 │◀───│                 │◀───│                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

The MCP server acts as a bridge between Claude and your AWS Bedrock Knowledge Base, handling protocol translation between MCP and AWS APIs, session management and context preservation, error handling and response formatting, plus configuration and authentication.

## Development

Prerequisites:
- Node.js 18+
- TypeScript 5+
- AWS credentials configured

Scripts:
```bash
npm run build       # Build TypeScript
npm run dev         # Development with hot reload
npm run lint        # Code linting
npm run test        # Run tests
npm run typecheck   # Type checking
```

Project Structure:
```
src/
├── index.ts          # Main entry point
├── server.ts         # MCP server implementation
├── bedrock-client.ts # AWS Bedrock client wrapper
├── config.ts         # Configuration management
└── types.ts          # TypeScript type definitions
```

## Error Handling

The server provides comprehensive error handling for invalid configuration, AWS authentication issues, knowledge base access errors, malformed queries, and network connectivity problems.

Errors are returned as structured MCP error responses with descriptive messages.

## Security

All AWS credentials are handled securely via the AWS SDK. No sensitive data is logged or exposed. Input validation prevents malicious queries and the server follows MCP security best practices.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run npm run lint and npm run test
5. Submit a pull request

## License

MIT License, see LICENSE file for details.

## Support

For issues and questions, open a GitHub issue, check the AWS Bedrock documentation, or review the MCP specification at https://modelcontextprotocol.io