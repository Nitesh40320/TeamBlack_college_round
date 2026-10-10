export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Second Opinion API',
    version: '1.0.0',
    description:
      'AI-answer auditing platform API for verifying facts, logical reasoning, and safety in LLM-generated responses against source documentation.',
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local Development Server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness check',
        responses: {
          '200': {
            description: 'Server is healthy',
          },
        },
      },
    },
    '/readiness': {
      get: {
        summary: 'Readiness check',
        responses: {
          '200': { description: 'Server and dependencies ready' },
          '503': { description: 'Server not ready' },
        },
      },
    },
    '/api/audits': {
      post: {
        summary: 'Submit new audit task',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['answer', 'sources'],
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                  sources: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['id', 'title', 'text'],
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        text: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Audit queued successfully' },
          '400': { description: 'Validation error' },
        },
      },
      get: {
        summary: 'List audit history with filtering and pagination',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search term for answer text' },
          { name: 'grade', in: 'query', schema: { type: 'string' }, description: 'Filter by grade (A, B, C, D, F)' },
          { name: 'verdict', in: 'query', schema: { type: 'string' }, description: 'Filter by verdict presence' },
          { name: 'safetyFlagged', in: 'query', schema: { type: 'boolean' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'createdAt' } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          '200': { description: 'Paginated list of audits' },
        },
      },
    },
    '/api/audits/{id}': {
      get: {
        summary: 'Get full audit result by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Audit result details' },
          '404': { description: 'Audit not found' },
        },
      },
    },
    '/api/audits/{id}/stream': {
      get: {
        summary: 'Server-Sent Events (SSE) stream for real-time audit progress updates',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'SSE stream (text/event-stream)' },
        },
      },
    },
    '/api/audits/{id}/export': {
      get: {
        summary: 'Export audit report in JSON, Markdown, or PDF format',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'md', 'pdf'], default: 'json' } },
        ],
        responses: {
          '200': { description: 'Exported report' },
        },
      },
    },
    '/api/audits/{id}/summary': {
      get: {
        summary: 'Get summary card metrics, top findings, and calibration note',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Audit summary' } },
      },
    },
    '/api/audits/{id}/findings': {
      get: {
        summary: 'Get findings list with filters and aggregated summary',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'verdict', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'claimType', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Filtered findings' } },
      },
    },
    '/api/audits/{id}/annotations': {
      get: {
        summary: 'Get non-overlapping answer text annotation projections',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Annotations list' } },
      },
    },
    '/api/audits/{id}/reasoning': {
      get: {
        summary: 'Get reasoning issues for audit',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Reasoning issues list' } },
      },
    },
    '/api/audits/{id}/safety': {
      get: {
        summary: 'Get safety flags for audit',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Safety flags list' } },
      },
    },
    '/api/audits/{id}/rerun': {
      post: {
        summary: 'Rerun audit pipeline from stage',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'fromStage', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '202': { description: 'Rerun queued' } },
      },
    },
    '/api/audits/{id}/feedback': {
      post: {
        summary: 'Submit human feedback on a finding',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['findingType', 'findingId', 'verdict'],
                properties: {
                  findingType: { type: 'string', enum: ['claim', 'reasoning', 'safety'] },
                  findingId: { type: 'string' },
                  verdict: { type: 'string', enum: ['correct', 'incorrect'] },
                  comment: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Feedback recorded' }, '409': { description: 'Duplicate vote' } },
      },
    },
    '/api/feedback/stats': {
      get: {
        summary: 'Get aggregated human feedback statistics',
        responses: { '200': { description: 'Feedback stats' } },
      },
    },
    '/api/eval/latest': {
      get: {
        summary: 'Get model evaluation metrics proxy',
        responses: { '200': { description: 'Model evaluation metrics' } },
      },
    },
  },
};
