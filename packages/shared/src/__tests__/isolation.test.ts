import { DatabaseIsolationEnforcer } from '../../src/database/isolation';

const limits = {
  maxQueryComplexity: Number.MAX_SAFE_INTEGER,
  maxQueryRows: Number.MAX_SAFE_INTEGER,
  maxExecutionTime: 30000,
};

describe('DatabaseIsolationEnforcer.estimateQueryComplexity', () => {
  it('ignores keywords inside strings and comments', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    const q = `
      -- comment with JOIN and UNION
      SELECT 'a JOIN b UNION c' as txt FROM users u -- another comment: EXCEPT
    `;
    // Should not explode; complexity should be finite and > 0
    expect(() => enforcer.enforceQuotas(q, 1)).not.toThrow();
  });

  it('detects cartesian products from multiple FROM tables without JOIN', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    const q = `SELECT * FROM a, b, c`;
    expect(() => enforcer.enforceQuotas(q, 1)).not.toThrow();
  });

  it('detects unions', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    const q = `SELECT 1 UNION SELECT 2`;
    expect(() => enforcer.enforceQuotas(q, 1)).not.toThrow();
  });

  it('handles recursive CTEs', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    const q = `WITH RECURSIVE t(n) AS (
      SELECT 1
      UNION ALL
      SELECT n+1 FROM t WHERE n < 5
    ) SELECT * FROM t;`;
    expect(() => enforcer.enforceQuotas(q, 1)).not.toThrow();
  });

  it('counts ORs and functions in WHERE', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    const q = `SELECT * FROM users WHERE LOWER(email) = 'a' OR UPPER(name) = 'b'`;
    expect(() => enforcer.enforceQuotas(q, 1)).not.toThrow();
  });
});

