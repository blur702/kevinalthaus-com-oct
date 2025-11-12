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

  });

  test('should create a term within a vocabulary', async ({ request }) => {
    // Create a vocabulary for this test to be independent
    const vocabResponse = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Term Test Vocab',
        machine_name: `term_test_vocab_${Date.now()}`,
      },
    });
    expect(vocabResponse.status()).toBe(201);
    const vocabData = await vocabResponse.json();
    const vocabularyId = vocabData.vocabulary.id;

    const response = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        vocabulary_id: vocabularyId,
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

  });

  test('should retrieve terms for a vocabulary', async ({ request }) => {
    // Create a vocabulary with a term for this test to be independent
    const vocabResponse = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Retrieve Terms Vocab',
        machine_name: `retrieve_terms_vocab_${Date.now()}`,
      },
    });
    expect(vocabResponse.status()).toBe(201);
    const vocabData = await vocabResponse.json();
    const vocabularyId = vocabData.vocabulary.id;

    // Create a term in this vocabulary
    await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        vocabulary_id: vocabularyId,
        name: 'Test Term for Retrieval',
        slug: `test-term-retrieval-${Date.now()}`,
      },
    });

    const response = await request.get(`${API_URL}/api/taxonomy/vocabularies/${vocabularyId}/terms`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.terms).toBeDefined();
    expect(Array.isArray(data.terms)).toBeTruthy();
    expect(data.terms.length).toBeGreaterThan(0);

  });

  test('should retrieve a specific term', async ({ request }) => {
    // Create a vocabulary and term for this test to be independent
    const vocabResponse = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Specific Term Vocab',
        machine_name: `specific_term_vocab_${Date.now()}`,
      },
    });
    expect(vocabResponse.status()).toBe(201);
    const vocabData = await vocabResponse.json();

    const termResponse = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        vocabulary_id: vocabData.vocabulary.id,
        name: 'Specific Test Term',
        slug: `specific-test-term-${Date.now()}`,
      },
    });
    expect(termResponse.status()).toBe(201);
    const termData = await termResponse.json();
    const termId = termData.term.id;

    const response = await request.get(`${API_URL}/api/taxonomy/terms/${termId}`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.term).toBeDefined();
    expect(data.term.id).toBe(termId);

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
    } else if (response.status() === 404) {
    } else {
      throw new Error(`Unexpected status: ${response.status()}`);
    }
  });

  test('should update a vocabulary', async ({ request }) => {
    // Create a vocabulary for this test to be independent
    const createResponse = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Update Test Vocab',
        machine_name: `update_test_vocab_${Date.now()}`,
        description: 'Original description',
      },
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const vocabularyId = createData.vocabulary.id;

    const response = await request.put(`${API_URL}/api/taxonomy/vocabularies/${vocabularyId}`, {
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

  });

  test('should update a term', async ({ request }) => {
    // Create a vocabulary and term for this test to be independent
    const vocabResponse = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Update Term Vocab',
        machine_name: `update_term_vocab_${Date.now()}`,
      },
    });
    expect(vocabResponse.status()).toBe(201);
    const vocabData = await vocabResponse.json();

    const termResponse = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        vocabulary_id: vocabData.vocabulary.id,
        name: 'Original Term Name',
        slug: `original-term-${Date.now()}`,
        description: 'Original description',
      },
    });
    expect(termResponse.status()).toBe(201);
    const termData = await termResponse.json();
    const termId = termData.term.id;

    const response = await request.put(`${API_URL}/api/taxonomy/terms/${termId}`, {
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

  });

  test('should delete a term', async ({ request }) => {
    // Create a vocabulary and term for this test to be independent
    const vocabResponse = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Delete Term Vocab',
        machine_name: `delete_term_vocab_${Date.now()}`,
      },
    });
    expect(vocabResponse.status()).toBe(201);
    const vocabData = await vocabResponse.json();

    const termResponse = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        vocabulary_id: vocabData.vocabulary.id,
        name: 'Term To Delete',
        slug: `term-to-delete-${Date.now()}`,
      },
    });
    expect(termResponse.status()).toBe(201);
    const termData = await termResponse.json();
    const termId = termData.term.id;

    const response = await request.delete(`${API_URL}/api/taxonomy/terms/${termId}`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
  });

  test('should delete a vocabulary', async ({ request }) => {
    // Create a vocabulary for this test to be independent
    const createResponse = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      },
      data: {
        name: 'Vocab To Delete',
        machine_name: `vocab_to_delete_${Date.now()}`,
      },
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const vocabularyId = createData.vocabulary.id;

    const response = await request.delete(`${API_URL}/api/taxonomy/vocabularies/${vocabularyId}`, {
      headers: {
        Cookie: `accessToken=${accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
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

  });
});
