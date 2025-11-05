import { test, expect } from '@playwright/test';

/**
 * Taxonomy API Tests
 *
 * Tests the taxonomy REST API endpoints to verify:
 * - Vocabulary creation and retrieval
 * - Term creation within vocabularies
 * - Entity-term associations
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

let testVocabularyId: string;
let testTermId: string;
let accessToken: string;

test.describe('Taxonomy API Tests', () => {
  test.beforeAll(async ({ request }) => {
    // Login to get auth cookies
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        username: 'kevin',
        password: '(130Bpm)',
      },
    });

    expect(loginResponse.ok()).toBeTruthy();

    // Extract access token from Set-Cookie header
    const cookies = loginResponse.headers()['set-cookie'];
    const match = cookies?.match(/accessToken=([^;]+)/);
    accessToken = match ? match[1] : '';
    expect(accessToken).toBeTruthy();
  });

  test('should create a new vocabulary', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Test Categories',
        machine_name: `test_categories_${Date.now()}`,
        description: 'Test vocabulary for Playwright',
        allow_multiple: true,
        required: false,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.vocabulary).toBeDefined();
    expect(data.vocabulary.name).toBe('Test Categories');

    // Store for use in other tests
    testVocabularyId = data.vocabulary.id;

    console.log('✓ Created vocabulary:', testVocabularyId);
  });

  test('should retrieve all vocabularies', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.vocabularies).toBeDefined();
    expect(Array.isArray(data.vocabularies)).toBeTruthy();

    console.log(`✓ Retrieved ${data.vocabularies.length} vocabularies`);
  });

  test('should create a term within a vocabulary', async ({ request }) => {
    // First ensure we have a vocabulary
    if (!testVocabularyId) {
      const vocabResponse = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
        headers: {
          Cookie: `accessToken=${accessToken}`
        },
        data: {
          name: 'Temp Vocab',
          machine_name: `temp_vocab_${Date.now()}`,
        },
      });
      const vocabData = await vocabResponse.json();
      testVocabularyId = vocabData.vocabulary.id;
    }

    const response = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        vocabulary_id: testVocabularyId,
        name: 'Test Term',
        slug: `test-term-${Date.now()}`,
        description: 'Test term for Playwright',
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.term).toBeDefined();
    expect(data.term.name).toBe('Test Term');

    testTermId = data.term.id;

    console.log('✓ Created term:', testTermId);
  });

  test('should retrieve terms for a vocabulary', async ({ request }) => {
    if (!testVocabularyId) {
      test.skip(true, 'No vocabulary ID available');
    }

    const response = await request.get(`${API_URL}/api/taxonomy/vocabularies/${testVocabularyId}/terms`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.terms).toBeDefined();
    expect(Array.isArray(data.terms)).toBeTruthy();

    console.log(`✓ Retrieved ${data.terms.length} terms for vocabulary`);
  });

  test('should retrieve a specific term', async ({ request }) => {
    if (!testTermId) {
      test.skip(true, 'No term ID available');
    }

    const response = await request.get(`${API_URL}/api/taxonomy/terms/${testTermId}`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.term).toBeDefined();
    expect(data.term.id).toBe(testTermId);

    console.log('✓ Retrieved term:', data.term.name);
  });

  test('should get vocabulary by machine name', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/taxonomy/vocabularies/machine-name/categories`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    // This might not exist yet, so check for 200 or 404
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.vocabulary).toBeDefined();
      console.log('✓ Found vocabulary by machine name: categories');
    } else if (response.status() === 404) {
      console.log('ℹ Vocabulary "categories" does not exist yet (expected for new setup)');
    } else {
      throw new Error(`Unexpected status: ${response.status()}`);
    }
  });

  test('should update a vocabulary', async ({ request }) => {
    if (!testVocabularyId) {
      test.skip(true, 'No vocabulary ID available');
    }

    const response = await request.put(`${API_URL}/api/taxonomy/vocabularies/${testVocabularyId}`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Updated Test Categories',
        description: 'Updated description',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.vocabulary.name).toBe('Updated Test Categories');

    console.log('✓ Updated vocabulary');
  });

  test('should update a term', async ({ request }) => {
    if (!testTermId) {
      test.skip(true, 'No term ID available');
    }

    const response = await request.put(`${API_URL}/api/taxonomy/terms/${testTermId}`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Updated Test Term',
        description: 'Updated description',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.term.name).toBe('Updated Test Term');

    console.log('✓ Updated term');
  });

  test('should delete a term', async ({ request }) => {
    if (!testTermId) {
      test.skip(true, 'No term ID available');
    }

    const response = await request.delete(`${API_URL}/api/taxonomy/terms/${testTermId}`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    console.log('✓ Deleted term');
  });

  test('should delete a vocabulary', async ({ request }) => {
    if (!testVocabularyId) {
      test.skip(true, 'No vocabulary ID available');
    }

    const response = await request.delete(`${API_URL}/api/taxonomy/vocabularies/${testVocabularyId}`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    console.log('✓ Deleted vocabulary');
  });
});

test.describe('Taxonomy Integration Tests', () => {
  let integrationAccessToken: string;

  test.beforeAll(async ({ request }) => {
    // Login to get auth token for integration tests
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        username: 'kevin',
        password: '(130Bpm)',
      },
    });

    const cookies = loginResponse.headers()['set-cookie'];
    const match = cookies?.match(/accessToken=([^;]+)/);
    integrationAccessToken = match ? match[1] : '';
  });

  test('should verify taxonomy service is initialized', async ({ request }) => {
    // Try to access vocabularies endpoint (should work even if empty)
    const response = await request.get(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${integrationAccessToken}`
      }
    });

    // Should return 200 with empty array or list of vocabularies
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.vocabularies).toBeDefined();
    expect(Array.isArray(data.vocabularies)).toBeTruthy();

    console.log('✓ Taxonomy service is operational');
  });
});
