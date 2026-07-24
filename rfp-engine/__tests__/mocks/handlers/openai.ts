/**
 * OpenAI API Mock Handlers
 * Mocks chat completions for AI draft generation
 */

import { http, HttpResponse, delay } from 'msw';

// Default mock response for drafts
const DEFAULT_DRAFT_RESPONSE = `This is a mock AI-generated response for testing purposes.

The response addresses the requirement by providing a comprehensive answer that demonstrates our capabilities and experience in this area.

Key points:
- We have extensive experience in this field
- Our team is qualified to meet these requirements
- We have successfully completed similar projects

This mock response allows testing the draft generation flow without actual API calls.`;

// Configurable mock responses
const mockResponses: Map<string, string> = new Map();
let shouldFail = false;
let failureMessage = 'API error';
let responseDelay = 0; // milliseconds

// Configure mock behavior
export function setMockResponse(key: string, response: string): void {
  mockResponses.set(key, response);
}

export function clearMockResponses(): void {
  mockResponses.clear();
}

export function setMockFailure(fail: boolean, message = 'API error'): void {
  shouldFail = fail;
  failureMessage = message;
}

export function setMockDelay(ms: number): void {
  responseDelay = ms;
}

export function resetOpenAIMocks(): void {
  mockResponses.clear();
  shouldFail = false;
  failureMessage = 'API error';
  responseDelay = 0;
}

export const openaiHandlers = [
  // Chat completions
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    // Simulate network latency if configured
    if (responseDelay > 0) {
      await delay(responseDelay);
    }

    // Check if should fail
    if (shouldFail) {
      return HttpResponse.json(
        {
          error: {
            message: failureMessage,
            type: 'api_error',
            code: 'internal_error',
          },
        },
        { status: 500 }
      );
    }

    const body = await request.json() as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      max_tokens?: number;
      temperature?: number;
    };
    const { messages, model = 'gpt-4o', max_tokens = 2000 } = body;

    // Extract key from last message for custom responses
    const lastMessage = messages[messages.length - 1]?.content || '';
    const responseKey = Array.from(mockResponses.keys()).find(key =>
      lastMessage.toLowerCase().includes(key.toLowerCase())
    );

    const responseContent = responseKey
      ? mockResponses.get(responseKey)!
      : DEFAULT_DRAFT_RESPONSE;

    // Simulate streaming if requested (simplified - returns full response)
    return HttpResponse.json({
      id: `chatcmpl-test-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: Math.floor(lastMessage.length / 4),
        completion_tokens: Math.floor(responseContent.length / 4),
        total_tokens: Math.floor((lastMessage.length + responseContent.length) / 4),
      },
    });
  }),

  // Models list (for validation)
  http.get('https://api.openai.com/v1/models', () => {
    return HttpResponse.json({
      data: [
        { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
        { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
        { id: 'gpt-4-turbo', object: 'model', owned_by: 'openai' },
      ],
    });
  }),
];
