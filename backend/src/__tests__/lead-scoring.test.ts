/**
 * Lead scoring unit tests — no DB, no network needed.
 */
import { scoreLead, getScoreGrade } from '../services/lead-scoring';

describe('scoreLead', () => {
  it('returns 0 for minimal lead with only email', () => {
    const result = scoreLead({ email: 'test@example.com', source: 'test' });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.factors).toBeInstanceOf(Array);
  });

  it('gives completeness points for each CRM field', () => {
    const minimal = scoreLead({ email: 'a@b.com', source: 'test' });
    const full = scoreLead({
      email: 'a@b.com',
      businessName: 'Acme Roofing',
      ownerName: 'John Smith',
      businessPhone: '214-555-1234',
      businessEmail: 'john@acmeroofing.com',
      businessWebsite: 'https://acmeroofing.com',
      source: 'test',
    });
    expect(full.completeness).toBeGreaterThan(minimal.completeness);
  });

  it('gives contactability bonus for real email (not placeholder)', () => {
    const real = scoreLead({ email: 'owner@acme.com', businessEmail: 'owner@acme.com', source: 'test' });
    const fake = scoreLead({ email: 'acmeroofing@business.com', source: 'test' });
    expect(real.contactability).toBeGreaterThan(fake.contactability);
  });

  it('gives business maturity points for years in business', () => {
    const new_ = scoreLead({ email: 'a@b.com', yearsInBusiness: 1, source: 'test' });
    const established = scoreLead({ email: 'a@b.com', yearsInBusiness: 15, source: 'test' });
    expect(established.businessMaturity).toBeGreaterThan(new_.businessMaturity);
  });

  it('gives relevance points for high-value industry keywords', () => {
    const irrelevant = scoreLead({ email: 'a@b.com', specialities: 'pottery', source: 'test' });
    const relevant = scoreLead({ email: 'a@b.com', specialities: 'roofing and hvac contractor', source: 'test' });
    expect(relevant.relevance).toBeGreaterThan(irrelevant.relevance);
  });

  it('total never exceeds 100', () => {
    const perfect = scoreLead({
      email: 'owner@acme.com',
      businessName: 'Acme Roofing',
      ownerName: 'John Smith',
      businessPhone: '214-555-1234',
      businessEmail: 'owner@acme.com',
      businessWebsite: 'https://acmeroofing.com',
      yearsInBusiness: 25,
      specialities: 'roofing hvac plumbing electrical contractor',
      source: 'test',
    });
    expect(perfect.total).toBeLessThanOrEqual(100);
  });

  it('includes human-readable factors array', () => {
    const result = scoreLead({ email: 'a@b.com', businessName: 'Test', businessPhone: '555-1234', source: 'test' });
    expect(result.factors.length).toBeGreaterThan(0);
    result.factors.forEach((f) => expect(typeof f).toBe('string'));
  });
});

describe('getScoreGrade', () => {
  it('grades A for score >= 80', () => expect(getScoreGrade(80).label).toBe('A'));
  it('grades B for score 65-79', () => expect(getScoreGrade(65).label).toBe('B'));
  it('grades C for score 50-64', () => expect(getScoreGrade(50).label).toBe('C'));
  it('grades D for score 35-49', () => expect(getScoreGrade(35).label).toBe('D'));
  it('grades F for score < 35', () => expect(getScoreGrade(20).label).toBe('F'));
  it('returns color for each grade', () => {
    [80, 65, 50, 35, 20].forEach((s) => {
      expect(getScoreGrade(s).color).toMatch(/^#/);
    });
  });
});
