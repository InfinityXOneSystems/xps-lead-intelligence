// Sets environment variables BEFORE any module is imported in tests.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-jest-runs';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
