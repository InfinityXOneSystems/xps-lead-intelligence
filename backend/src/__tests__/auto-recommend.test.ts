/**
 * Auto-recommend service tests — mocks Groq + Redis.
 */
import { generateRecommendations } from '../services/auto-recommend';

jest.mock('../services/groq', () => ({
  chatCompletion: jest.fn().mockResolvedValue(JSON.stringify([
    { id: '1', text: 'Scrape HVAC businesses in Dallas TX', category: 'action', priority: 'high' },
    { id: '2', text: 'Export leads to Google Sheets', category: 'action', priority: 'medium' },
  ])),
}));

jest.mock('../services/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

describe('generateRecommendations', () => {
  it('returns an array of recommendations', async () => {
    const recs = await generateRecommendations('agent', ['list my leads', 'how many leads?']);
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('each recommendation has required fields', async () => {
    const recs = await generateRecommendations('leads', []);
    recs.forEach((rec) => {
      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('text');
      expect(rec).toHaveProperty('category');
      expect(rec).toHaveProperty('priority');
      expect(['action', 'question', 'insight', 'tool']).toContain(rec.category);
      expect(['high', 'medium', 'low']).toContain(rec.priority);
    });
  });

  it('returns fallback defaults when LLM fails', async () => {
    const { chatCompletion } = jest.requireMock('../services/groq') as { chatCompletion: jest.Mock };
    chatCompletion.mockRejectedValueOnce(new Error('LLM error'));
    const recs = await generateRecommendations('agent', [], 10);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('uses Redis cache on second call', async () => {
    const { cacheGet } = jest.requireMock('../services/redis') as { cacheGet: jest.Mock };
    cacheGet.mockResolvedValueOnce(JSON.stringify([
      { id: 'c1', text: 'Cached recommendation', category: 'action', priority: 'high' },
    ]));
    const recs = await generateRecommendations('scraper', ['test']);
    expect(recs[0].text).toBe('Cached recommendation');
  });
});
