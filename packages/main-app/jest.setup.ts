/**
 * Jest Setup File
 * Mock problematic ES Module dependencies
 */

// Mock jsdom to avoid ES module issues with parse5
jest.mock('jsdom', () => {
  return {
    JSDOM: jest.fn().mockImplementation(() => ({
      window: {
        document: {
          createElement: jest.fn(),
          querySelectorAll: jest.fn(() => []),
        },
      },
    })),
  };
});
