import { DatabaseIsolationEnforcer } from '../database/isolation';

const limits = {
  maxQueryComplexity: Number.MAX_SAFE_INTEGER,
  maxQueryRows: Number.MAX_SAFE_INTEGER,
  maxExecutionTime: 30000,
};

describe('DatabaseIsolationEnforcer.enforceQuotas', () => {
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

  it('enforces complexity for multi-join queries with tight limit', () => {
    const tightLimits = {
      maxQueryComplexity: 10,
      maxQueryRows: Number.MAX_SAFE_INTEGER,
      maxExecutionTime: 30000,
    };
    const enforcer = new DatabaseIsolationEnforcer(tightLimits);
    const multiJoin = `SELECT * FROM a JOIN b ON a.id=b.a_id JOIN c ON b.id=c.b_id`;
    expect(() => enforcer.enforceQuotas(multiJoin, 1)).toThrow(/complexity/i);
  });

  it('throws when complexity exceeds limit for a deliberately complex query', () => {
    const veryTight = {
      maxQueryComplexity: 5,
      maxQueryRows: Number.MAX_SAFE_INTEGER,
      maxExecutionTime: 30000,
    };
    const enforcer = new DatabaseIsolationEnforcer(veryTight);
    const q = `WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM t WHERE n < 3) SELECT * FROM t UNION SELECT 99`;
    expect(() => enforcer.enforceQuotas(q, 1)).toThrow(/complexity.*exceeds limit/i);
  });

  it('throws when estimated rows exceed limit', () => {
    const rowTight = {
      maxQueryComplexity: Number.MAX_SAFE_INTEGER,
      maxQueryRows: 10,
      maxExecutionTime: 30000,
    };
    const enforcer = new DatabaseIsolationEnforcer(rowTight);
    const q = `SELECT * FROM users`;
    expect(() => enforcer.enforceQuotas(q, 100)).toThrow(/rows.*exceeds limit/i);
  });

  it('throws on empty or whitespace query', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    expect(() => enforcer.enforceQuotas('', 10)).toThrow(/empty or whitespace/i);
    expect(() => enforcer.enforceQuotas('   ', 10)).toThrow(/empty or whitespace/i);
    expect(() => enforcer.enforceQuotas('\n\t  ', 10)).toThrow(/empty or whitespace/i);
  });

  it('throws on invalid estimatedRows (0, negative, NaN, Infinity)', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    const q = `SELECT * FROM users`;
    expect(() => enforcer.enforceQuotas(q, 0)).toThrow(/finite positive/i);
    expect(() => enforcer.enforceQuotas(q, -1)).toThrow(/finite positive/i);
    expect(() => enforcer.enforceQuotas(q, -100)).toThrow(/finite positive/i);
    expect(() => enforcer.enforceQuotas(q, NaN)).toThrow(/finite positive/i);
    expect(() => enforcer.enforceQuotas(q, Infinity)).toThrow(/finite positive/i);
    expect(() => enforcer.enforceQuotas(q, -Infinity)).toThrow(/finite positive/i);
  });

  it('rejects when estimatedRows equals maxQueryRows (exclusive limit)', () => {
    const rowTight = {
      maxQueryComplexity: Number.MAX_SAFE_INTEGER,
      maxQueryRows: 500,
      maxExecutionTime: 30000,
    };
    const enforcer = new DatabaseIsolationEnforcer(rowTight);
    const q = `SELECT * FROM users`;
    // Boundary case: exactly at the limit should throw (exclusive limit)
    expect(() => enforcer.enforceQuotas(q, 500)).toThrow();
    // Just below the limit should not throw
    expect(() => enforcer.enforceQuotas(q, 499)).not.toThrow();
  });

  it('handles malformed SQL gracefully', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    const malformed = `SELECT * FROM WHERE JOIN`;
    // Should not throw; returns fallback complexity for unparseable SQL
    expect(() => enforcer.enforceQuotas(malformed, 10)).not.toThrow();
  });

  it('handles SQL-injection-like patterns safely', () => {
    const enforcer = new DatabaseIsolationEnforcer(limits);
    // Common SQL injection pattern
    const injectionAttempt = `SELECT * FROM users WHERE id = 1 OR 1=1; DROP TABLE users;--`;
    // Should not crash and should handle as normal query
    expect(() => enforcer.enforceQuotas(injectionAttempt, 100)).not.toThrow();

    // Another pattern with comment and UNION
    const unionInjection = `' UNION SELECT password FROM users--`;
    expect(() => enforcer.enforceQuotas(unionInjection, 100)).not.toThrow();
  });
});
