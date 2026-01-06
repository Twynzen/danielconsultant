/**
 * LLM Web Worker
 * v1.0: Handles WebLLM inference in a separate thread
 *
 * This worker runs the LLM inference off the main thread,
 * preventing UI blocking during model loading and generation.
 */

/// <reference lib="webworker" />

import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// Create handler for WebLLM messages
const handler = new WebWorkerMLCEngineHandler();

// Forward all messages to the handler
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
