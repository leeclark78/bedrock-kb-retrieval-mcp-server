#!/usr/bin/env node

import { BedrockKBMCPServer } from './server.js';
import { loadConfig, validateEnvironment } from './config.js';

async function main(): Promise<void> {
  try {
    // Validate environment variables
    validateEnvironment();

    // Load configuration
    const config = loadConfig();

    // Create and start server
    const server = new BedrockKBMCPServer(config);
    
    // Log startup information to stderr (so it doesn't interfere with MCP protocol)
    console.error('🚀 Starting Bedrock Knowledge Base Retrieval MCP Server');
    console.error(`   Region: ${config.region}`);
    console.error(`   Knowledge Base ID: ${config.knowledgeBaseId}`);
    console.error(`   Max Results: ${config.maxResults}`);
    if (config.modelArn) {
      console.error(`   Model ARN: ${config.modelArn}`);
    }
    if (config.rerankingModelArn) {
      console.error(`   Reranking Model ARN: ${config.rerankingModelArn}`);
    }
    console.error('✅ Server ready and waiting for connections...\n');

    await server.run();
  } catch (error) {
    console.error('❌ Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}