/**
 * Email service unit tests — mocks nodemailer transport.
 */
import { renderTemplate, generateEmailWithLLM } from '../services/email';

// Mock groq
jest.mock('../services/groq', () => ({
  chatCompletion: jest.fn().mockResolvedValue(JSON.stringify({
    subject: 'Hello {{businessName}}',
    bodyHtml: '<p>Hi {{ownerName}}, we noticed {{businessName}} is in {{specialities}}.</p>',
    bodyText: 'Hi {{ownerName}}, we noticed {{businessName}} is in {{specialities}}.',
  })),
}));

describe('renderTemplate', () => {
  it('replaces all {{variables}}', () => {
    const result = renderTemplate('Hello {{name}}, your company is {{company}}!', {
      name: 'John',
      company: 'Acme',
    });
    expect(result).toBe('Hello John, your company is Acme!');
  });

  it('leaves unmatched variables as-is', () => {
    const result = renderTemplate('Hello {{name}}, your score is {{score}}', { name: 'John' });
    expect(result).toBe('Hello John, your score is {{score}}');
  });

  it('handles empty template', () => {
    expect(renderTemplate('', {})).toBe('');
  });

  it('handles multiple occurrences of same variable', () => {
    const result = renderTemplate('{{name}} + {{name}} = {{name}}', { name: 'X' });
    expect(result).toBe('X + X = X');
  });
});

describe('generateEmailWithLLM', () => {
  it('returns subject, bodyHtml, bodyText', async () => {
    const result = await generateEmailWithLLM(
      { businessName: 'Acme Roofing', ownerName: 'John', specialities: 'roofing' },
      'cold outreach for roofing services',
    );
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('bodyHtml');
    expect(result).toHaveProperty('bodyText');
    expect(typeof result.subject).toBe('string');
  });
});
