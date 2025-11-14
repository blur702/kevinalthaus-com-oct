/**
 * Analytics Service Implementation
 *
 * Provides a centralized interface for recording and querying analytics data.
 * Plugins should call this service rather than touching analytics tables directly.
 */

import { Pool, PoolClient } from 'pg';
import type {
  IAnalyticsService,
  AnalyticsSession,
  AnalyticsSessionCreateInput,
  AnalyticsSessionUpdateInput,
  AnalyticsEventInput,
  AnalyticsEventRecord,
  AnalyticsEventQuery,
  AnalyticsEventStreamResult,
  AnalyticsPageViewInput,
  AnalyticsUserPropertyInput,
  AnalyticsUserProperty,
  AnalyticsConsentInput,
  AnalyticsConsent,
  CreateAnalyticsFunnelInput,
  UpdateAnalyticsFunnelInput,
  AnalyticsFunnel,
  CreateAnalyticsGoalInput,
  UpdateAnalyticsGoalInput,
  AnalyticsGoal,
  CreateAnalyticsSessionRecordingInput,
  AnalyticsSessionRecording,
  UpsertAnalyticsHeatmapInput,
  AnalyticsHeatmap,
  AnalyticsHeatmapQuery,
  AnalyticsSessionQuery,
  AnalyticsSessionSummary,
  AnalyticsEventProperties,
  AnalyticsAggregateQuery,
  AnalyticsTopEvent,
  AnalyticsTopPage,
  AnalyticsTimelineQuery,
  AnalyticsTimeSeriesPoint,
} from '@monorepo/shared';

function toJsonb(payload?: AnalyticsEventProperties): string {
  return JSON.stringify(payload ?? {});
}

function nowDate(value?: Date): Date {
  return value ?? new Date();
}

export class AnalyticsService implements IAnalyticsService {
  public readonly name = 'analytics';
  private pool: Pool;
  private initialized = false;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.pool.query('SELECT 1');
    this.initialized = true;
    console.log('[AnalyticsService] ✓ Initialized');
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.pool.query('SELECT 1 FROM analytics_sessions LIMIT 1');
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getSessionById(sessionId: string): Promise<AnalyticsSession | null> {
    const result = await this.pool.query<AnalyticsSession>(
      'SELECT * FROM analytics_sessions WHERE id = $1',
      [sessionId]
    );
    return result.rows[0] ?? null;
  }

  async createSession(data: AnalyticsSessionCreateInput): Promise<AnalyticsSession> {
    const result = await this.pool.query<AnalyticsSession>(
      `
        INSERT INTO analytics_sessions (
          user_id,
          anonymous_id,
          session_start,
          session_end,
          duration_seconds,
          ip_address,
          user_agent,
          device_type,
          browser,
          browser_version,
          os,
          os_version,
          country,
          region,
          city,
          referrer_source,
          referrer_medium,
          referrer_campaign,
          landing_page,
          exit_page,
          page_views_count,
          events_count,
          is_bounce,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,NULL,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NULL,0,0,false,NOW(),NOW()
        )
        RETURNING *
      `,
      [
        data.user_id ?? null,
        data.anonymous_id ?? null,
        nowDate(data.session_start),
        data.ip_address ?? null,
        data.user_agent ?? null,
        data.device_type ?? null,
        data.browser ?? null,
        data.browser_version ?? null,
        data.os ?? null,
        data.os_version ?? null,
        data.country ?? null,
        data.region ?? null,
        data.city ?? null,
        data.referrer_source ?? null,
        data.referrer_medium ?? null,
        data.referrer_campaign ?? null,
        data.landing_page ?? null,
      ]
    );

    return result.rows[0];
  }

  async updateSession(
    sessionId: string,
    updates: AnalyticsSessionUpdateInput
  ): Promise<AnalyticsSession | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'undefined') {
        continue;
      }
      fields.push(`${key} = $${index}`);
      values.push(value);
      index++;
    }

    if (fields.length === 0) {
      return this.getSessionById(sessionId);
    }

    values.push(sessionId);

    const result = await this.pool.query<AnalyticsSession>(
      `
        UPDATE analytics_sessions
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${index}
        RETURNING *
      `,
      values
    );

    return result.rows[0] ?? null;
  }

  async endSession(sessionId: string, endedAt?: Date): Promise<AnalyticsSession | null> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    const endTime = endedAt ?? new Date();
    const durationSeconds =
      session.session_start && endTime
        ? Math.max(0, Math.round((endTime.getTime() - session.session_start.getTime()) / 1000))
        : null;

    return this.updateSession(sessionId, {
      session_end: endTime,
      duration_seconds: durationSeconds,
      is_bounce: session.page_views_count <= 1,
    });
  }

  private async incrementSessionCounters(sessionId: string, eventName: string, client?: Pool | PoolClient): Promise<void> {
    const queryClient = client || this.pool;
    const isPageView = eventName === 'page_view';
    const setFragments = ['events_count = events_count + 1'];
    if (isPageView) {
      setFragments.push('page_views_count = page_views_count + 1');
    }
    await queryClient.query(
      `
        UPDATE analytics_sessions
        SET ${setFragments.join(', ')}, updated_at = NOW()
        WHERE id = $1
      `,
      [sessionId]
    );
  }

  async trackEvent(event: AnalyticsEventInput, client?: Pool | PoolClient): Promise<AnalyticsEventRecord> {
    const queryClient = client || this.pool;
    const result = await queryClient.query<AnalyticsEventRecord>(
      `
        INSERT INTO analytics_events (
          session_id,
          user_id,
          event_name,
          event_properties,
          page_url,
          page_path,
          page_title,
          referrer,
          created_at
        )
        VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
        RETURNING *
      `,
      [
        event.session_id,
        event.user_id ?? null,
        event.event_name,
        toJsonb(event.event_properties),
        event.page_url ?? null,
        event.page_path ?? null,
        event.page_title ?? null,
        event.referrer ?? null,
        nowDate(event.created_at),
      ]
    );

    await this.incrementSessionCounters(event.session_id, event.event_name, client);

    return result.rows[0];
  }

  async recordPageView(view: AnalyticsPageViewInput): Promise<AnalyticsEventRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
          INSERT INTO page_views (url, path, user_id, ip_address, user_agent, referrer)
          VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          view.page_url ?? view.page_path ?? '/',
          view.page_path ?? '/',
          view.user_id ?? null,
          view.ip_address ?? null,
          view.user_agent ?? null,
          view.referrer ?? null,
        ]
      );

      const result = await this.trackEvent({
        ...view,
        event_name: 'page_view',
      }, client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEventStream(query: AnalyticsEventQuery): Promise<AnalyticsEventStreamResult> {
    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.session_id) {
      params.push(query.session_id);
      filters.push(`session_id = $${params.length}`);
    }

    if (query.user_id) {
      params.push(query.user_id);
      filters.push(`user_id = $${params.length}`);
    }

    if (query.event_name) {
      params.push(query.event_name);
      filters.push(`event_name = $${params.length}`);
    }

    if (query.start_date) {
      params.push(query.start_date);
      filters.push(`created_at >= $${params.length}`);
    }

    if (query.end_date) {
      params.push(query.end_date);
      filters.push(`created_at <= $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 500) : 100;
    const offset = query.offset && query.offset > 0 ? query.offset : 0;
    const order = query.order === 'asc' ? 'ASC' : 'DESC';

    const eventsResult = await this.pool.query<AnalyticsEventRecord>(
      `
        SELECT *
        FROM analytics_events
        ${whereClause}
        ORDER BY created_at ${order}
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );

    const countResult = await this.pool.query<{ total: string }>(
      `
        SELECT COUNT(*) as total
        FROM analytics_events
        ${whereClause}
      `,
      params
    );

    return {
      events: eventsResult.rows,
      total: parseInt(countResult.rows[0]?.total ?? '0', 10),
      limit,
      offset,
    };
  }

  async setUserProperty(property: AnalyticsUserPropertyInput): Promise<AnalyticsUserProperty> {
    const result = await this.pool.query<AnalyticsUserProperty>(
      `
        INSERT INTO analytics_user_properties (
          user_id,
          anonymous_id,
          property_key,
          property_value,
          property_type,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
        ON CONFLICT ((COALESCE(user_id::text, anonymous_id)), property_key)
        DO UPDATE SET
          property_value = EXCLUDED.property_value,
          property_type = EXCLUDED.property_type,
          updated_at = NOW()
        RETURNING *
      `,
      [
        property.user_id ?? null,
        property.anonymous_id ?? null,
        property.property_key,
        property.property_value,
        property.property_type,
      ]
    );

    return result.rows[0];
  }

  async getUserProperties(query: {
    user_id?: string;
    anonymous_id?: string;
  }): Promise<AnalyticsUserProperty[]> {
    if (!query.user_id && !query.anonymous_id) {
      return [];
    }

    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.user_id) {
      params.push(query.user_id);
      filters.push(`user_id = $${params.length}`);
    }

    if (query.anonymous_id) {
      params.push(query.anonymous_id);
      filters.push(`anonymous_id = $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await this.pool.query<AnalyticsUserProperty>(
      `
        SELECT *
        FROM analytics_user_properties
        ${whereClause}
        ORDER BY updated_at DESC
      `,
      params
    );

    return result.rows;
  }

  async recordConsent(consent: AnalyticsConsentInput): Promise<AnalyticsConsent> {
    const result = await this.pool.query<AnalyticsConsent>(
      `
        INSERT INTO analytics_consent (
          user_id,
          anonymous_id,
          consent_type,
          consent_given,
          consent_version,
          ip_address,
          user_agent,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        RETURNING *
      `,
      [
        consent.user_id ?? null,
        consent.anonymous_id ?? null,
        consent.consent_type,
        consent.consent_given,
        consent.consent_version,
        consent.ip_address ?? null,
        consent.user_agent ?? null,
      ]
    );

    return result.rows[0];
  }

  async getConsentHistory(query: {
    user_id?: string;
    anonymous_id?: string;
  }): Promise<AnalyticsConsent[]> {
    if (!query.user_id && !query.anonymous_id) {
      return [];
    }

    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.user_id) {
      params.push(query.user_id);
      filters.push(`user_id = $${params.length}`);
    }

    if (query.anonymous_id) {
      params.push(query.anonymous_id);
      filters.push(`anonymous_id = $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await this.pool.query<AnalyticsConsent>(
      `
        SELECT *
        FROM analytics_consent
        ${whereClause}
        ORDER BY created_at DESC
      `,
      params
    );

    return result.rows;
  }

  async createFunnel(data: CreateAnalyticsFunnelInput): Promise<AnalyticsFunnel> {
    const result = await this.pool.query<AnalyticsFunnel>(
      `
        INSERT INTO analytics_funnels (
          name,
          description,
          steps,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3::jsonb,$4,$5,NOW(),NOW())
        RETURNING *
      `,
      [
        data.name,
        data.description ?? null,
        toJsonb(data.steps),
        data.is_active ?? true,
        data.created_by,
      ]
    );

    return result.rows[0];
  }

  async updateFunnel(
    id: string,
    updates: UpdateAnalyticsFunnelInput
  ): Promise<AnalyticsFunnel | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (typeof updates.name !== 'undefined') {
      fields.push(`name = $${index}`);
      values.push(updates.name);
      index++;
    }
    if (typeof updates.description !== 'undefined') {
      fields.push(`description = $${index}`);
      values.push(updates.description);
      index++;
    }
    if (typeof updates.steps !== 'undefined') {
      fields.push(`steps = $${index}::jsonb`);
      values.push(toJsonb(updates.steps));
      index++;
    }
    if (typeof updates.is_active !== 'undefined') {
      fields.push(`is_active = $${index}`);
      values.push(updates.is_active);
      index++;
    }

    if (fields.length === 0) {
      return this.getFunnelById(id);
    }

    values.push(id);

    const result = await this.pool.query<AnalyticsFunnel>(
      `
        UPDATE analytics_funnels
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${index}
        RETURNING *
      `,
      values
    );

    return result.rows[0] ?? null;
  }

  private async getFunnelById(id: string): Promise<AnalyticsFunnel | null> {
    const result = await this.pool.query<AnalyticsFunnel>(
      'SELECT * FROM analytics_funnels WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  async listFunnels(options?: { includeInactive?: boolean }): Promise<AnalyticsFunnel[]> {
    const includeInactive = options?.includeInactive ?? false;
    const result = await this.pool.query<AnalyticsFunnel>(
      `
        SELECT *
        FROM analytics_funnels
        ${includeInactive ? '' : 'WHERE is_active = true'}
        ORDER BY created_at DESC
      `
    );

    return result.rows;
  }

  async createGoal(data: CreateAnalyticsGoalInput): Promise<AnalyticsGoal> {
    const result = await this.pool.query<AnalyticsGoal>(
      `
        INSERT INTO analytics_goals (
          name,
          description,
          goal_type,
          goal_conditions,
          goal_value,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,NOW(),NOW())
        RETURNING *
      `,
      [
        data.name,
        data.description ?? null,
        data.goal_type,
        toJsonb(data.goal_conditions),
        data.goal_value ?? null,
        data.is_active ?? true,
        data.created_by,
      ]
    );

    return result.rows[0];
  }

  async updateGoal(id: string, updates: UpdateAnalyticsGoalInput): Promise<AnalyticsGoal | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (typeof updates.name !== 'undefined') {
      fields.push(`name = $${index}`);
      values.push(updates.name);
      index++;
    }
    if (typeof updates.description !== 'undefined') {
      fields.push(`description = $${index}`);
      values.push(updates.description);
      index++;
    }
    if (typeof updates.goal_type !== 'undefined') {
      fields.push(`goal_type = $${index}`);
      values.push(updates.goal_type);
      index++;
    }
    if (typeof updates.goal_conditions !== 'undefined') {
      fields.push(`goal_conditions = $${index}::jsonb`);
      values.push(toJsonb(updates.goal_conditions));
      index++;
    }
    if (typeof updates.goal_value !== 'undefined') {
      fields.push(`goal_value = $${index}`);
      values.push(updates.goal_value);
      index++;
    }
    if (typeof updates.is_active !== 'undefined') {
      fields.push(`is_active = $${index}`);
      values.push(updates.is_active);
      index++;
    }

    if (fields.length === 0) {
      return this.getGoalById(id);
    }

    values.push(id);

    const result = await this.pool.query<AnalyticsGoal>(
      `
        UPDATE analytics_goals
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${index}
        RETURNING *
      `,
      values
    );

    return result.rows[0] ?? null;
  }

  private async getGoalById(id: string): Promise<AnalyticsGoal | null> {
    const result = await this.pool.query<AnalyticsGoal>(
      'SELECT * FROM analytics_goals WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  async listGoals(options?: { includeInactive?: boolean; goal_type?: string }): Promise<AnalyticsGoal[]> {
    const includeInactive = options?.includeInactive ?? false;
    const filters: string[] = [];
    const params: unknown[] = [];

    if (!includeInactive) {
      filters.push('is_active = true');
    }

    if (options?.goal_type) {
      params.push(options.goal_type);
      filters.push(`goal_type = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await this.pool.query<AnalyticsGoal>(
      `
        SELECT *
        FROM analytics_goals
        ${whereClause}
        ORDER BY created_at DESC
      `,
      params
    );

    return result.rows;
  }

  async saveSessionRecording(
    data: CreateAnalyticsSessionRecordingInput
  ): Promise<AnalyticsSessionRecording> {
    const result = await this.pool.query<AnalyticsSessionRecording>(
      `
        INSERT INTO analytics_session_recordings (
          session_id,
          recording_data,
          recording_duration_ms,
          recording_size_bytes,
          has_errors,
          error_count,
          privacy_mode,
          created_at
        )
        VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (session_id) DO UPDATE SET
          recording_data = EXCLUDED.recording_data,
          recording_duration_ms = EXCLUDED.recording_duration_ms,
          recording_size_bytes = EXCLUDED.recording_size_bytes,
          has_errors = EXCLUDED.has_errors,
          error_count = EXCLUDED.error_count,
          privacy_mode = EXCLUDED.privacy_mode,
          created_at = analytics_session_recordings.created_at
        RETURNING *
      `,
      [
        data.session_id,
        toJsonb(data.recording_data),
        data.recording_duration_ms,
        data.recording_size_bytes,
        data.has_errors ?? false,
        data.error_count ?? 0,
        data.privacy_mode ?? 'strict',
      ]
    );

    return result.rows[0];
  }

  async getSessionRecording(sessionId: string): Promise<AnalyticsSessionRecording | null> {
    const result = await this.pool.query<AnalyticsSessionRecording>(
      'SELECT * FROM analytics_session_recordings WHERE session_id = $1 LIMIT 1',
      [sessionId]
    );
    return result.rows[0] ?? null;
  }

  async upsertHeatmap(data: UpsertAnalyticsHeatmapInput): Promise<AnalyticsHeatmap> {
    const result = await this.pool.query<AnalyticsHeatmap>(
      `
        INSERT INTO analytics_heatmaps (
          page_path,
          viewport_width,
          viewport_height,
          interaction_type,
          aggregation_period,
          heatmap_data,
          sample_size,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NOW(),NOW())
        ON CONFLICT (page_path, viewport_width, viewport_height, interaction_type, aggregation_period)
        DO UPDATE SET
          heatmap_data = EXCLUDED.heatmap_data,
          sample_size = EXCLUDED.sample_size,
          updated_at = NOW()
        RETURNING *
      `,
      [
        data.page_path,
        data.viewport_width,
        data.viewport_height,
        data.interaction_type,
        data.aggregation_period,
        toJsonb(data.heatmap_data),
        data.sample_size,
      ]
    );

    return result.rows[0];
  }

  async getHeatmaps(query: AnalyticsHeatmapQuery): Promise<AnalyticsHeatmap[]> {
    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.page_path) {
      params.push(query.page_path);
      filters.push(`page_path = $${params.length}`);
    }

    if (query.interaction_type) {
      params.push(query.interaction_type);
      filters.push(`interaction_type = $${params.length}`);
    }

    if (query.start_date) {
      params.push(query.start_date);
      filters.push(`aggregation_period >= $${params.length}`);
    }

    if (query.end_date) {
      params.push(query.end_date);
      filters.push(`aggregation_period <= $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 50;

    const result = await this.pool.query<AnalyticsHeatmap>(
      `
        SELECT *
        FROM analytics_heatmaps
        ${whereClause}
        ORDER BY aggregation_period DESC
        LIMIT $${params.length + 1}
      `,
      [...params, limit]
    );

    return result.rows;
  }

  async getSessionSummary(query: AnalyticsSessionQuery): Promise<AnalyticsSessionSummary> {
    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.user_id) {
      params.push(query.user_id);
      filters.push(`user_id = $${params.length}`);
    }

    if (query.anonymous_id) {
      params.push(query.anonymous_id);
      filters.push(`anonymous_id = $${params.length}`);
    }

    if (query.start_date) {
      params.push(query.start_date);
      filters.push(`session_start >= $${params.length}`);
    }

    if (query.end_date) {
      params.push(query.end_date);
      filters.push(`session_start <= $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await this.pool.query<{
      total_sessions: string;
      active_sessions: string;
      average_duration_seconds: string | null;
      total_events: string | null;
      total_page_views: string | null;
    }>(
      `
        SELECT
          COUNT(*) AS total_sessions,
          COUNT(*) FILTER (WHERE session_end IS NULL) AS active_sessions,
          AVG(duration_seconds) AS average_duration_seconds,
          SUM(events_count) AS total_events,
          SUM(page_views_count) AS total_page_views
        FROM analytics_sessions
        ${whereClause}
      `,
      params
    );

    const row = result.rows[0];

    return {
      total_sessions: parseInt(row?.total_sessions ?? '0', 10),
      active_sessions: parseInt(row?.active_sessions ?? '0', 10),
      average_duration_seconds: row?.average_duration_seconds
        ? parseFloat(row.average_duration_seconds)
        : 0,
      total_events: row?.total_events ? parseInt(row.total_events, 10) : 0,
      total_page_views: row?.total_page_views ? parseInt(row.total_page_views, 10) : 0,
    };
  }

  async getTopEvents(options?: AnalyticsAggregateQuery): Promise<AnalyticsTopEvent[]> {
    const filters: string[] = [];
    const params: unknown[] = [];

    if (options?.start_date) {
      params.push(options.start_date);
      filters.push(`created_at >= $${params.length}`);
    }

    if (options?.end_date) {
      params.push(options.end_date);
      filters.push(`created_at <= $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 25) : 10;

    const result = await this.pool.query<{ event_name: string; count: string; unique_sessions: string }>(
      `
        SELECT event_name, COUNT(*)::text AS count, COUNT(DISTINCT session_id)::text AS unique_sessions
        FROM analytics_events
        ${whereClause}
        GROUP BY event_name
        ORDER BY COUNT(*) DESC
        LIMIT $${params.length + 1}
      `,
      [...params, limit]
    );

    return result.rows.map((row) => ({
      event_name: row.event_name,
      count: parseInt(row.count, 10),
      unique_sessions: parseInt(row.unique_sessions, 10),
    }));
  }

  async getTopPages(options?: AnalyticsAggregateQuery): Promise<AnalyticsTopPage[]> {
    const filters: string[] = [`event_name = 'page_view'`];
    const params: unknown[] = [];

    if (options?.start_date) {
      params.push(options.start_date);
      filters.push(`created_at >= $${params.length}`);
    }

    if (options?.end_date) {
      params.push(options.end_date);
      filters.push(`created_at <= $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 25) : 10;

    const result = await this.pool.query<{ page_path: string; views: string; visitors: string }>(
      `
        SELECT
          COALESCE(page_path, 'unknown') AS page_path,
          COUNT(*)::text AS views,
          COUNT(DISTINCT session_id)::text AS visitors
        FROM analytics_events
        ${whereClause}
        GROUP BY page_path
        ORDER BY COUNT(*) DESC
        LIMIT $${params.length + 1}
      `,
      [...params, limit]
    );

    return result.rows.map((row) => ({
      page_path: row.page_path,
      views: parseInt(row.views, 10),
      unique_visitors: parseInt(row.visitors, 10),
    }));
  }

  async getSessionTimeline(options: AnalyticsTimelineQuery): Promise<AnalyticsTimeSeriesPoint[]> {
    const interval = options.interval ?? 'day';
    const validIntervals = ['hour', 'day', 'week'];
    const safeInterval = validIntervals.includes(interval) ? interval : 'day';

    const sessionFilters: string[] = [];
    const eventFilters: string[] = [];
    const sessionParams: unknown[] = [];
    const eventParams: unknown[] = [];

    if (options.start_date) {
      sessionParams.push(options.start_date);
      sessionFilters.push(`session_start >= $${sessionParams.length}`);
      eventParams.push(options.start_date);
      eventFilters.push(`created_at >= $${eventParams.length}`);
    }

    if (options.end_date) {
      sessionParams.push(options.end_date);
      sessionFilters.push(`session_start <= $${sessionParams.length}`);
      eventParams.push(options.end_date);
      eventFilters.push(`created_at <= $${eventParams.length}`);
    }

    const sessionWhere = sessionFilters.length ? `WHERE ${sessionFilters.join(' AND ')}` : '';
    const eventWhere = eventFilters.length ? `WHERE ${eventFilters.join(' AND ')}` : '';

    // Add interval parameter to both queries
    sessionParams.push(safeInterval);
    const sessionIntervalParam = sessionParams.length;
    eventParams.push(safeInterval);
    const eventIntervalParam = eventParams.length;

    const [sessionsResult, eventsResult] = await Promise.all([
      this.pool.query<{ period: Date; count: string }>(
        `
          SELECT DATE_TRUNC(
            CASE
              WHEN $${sessionIntervalParam} = 'hour' THEN 'hour'
              WHEN $${sessionIntervalParam} = 'week' THEN 'week'
              ELSE 'day'
            END,
            session_start
          ) AS period, COUNT(*)::text AS count
          FROM analytics_sessions
          ${sessionWhere}
          GROUP BY period
          ORDER BY period ASC
        `,
        sessionParams
      ),
      this.pool.query<{ period: Date; count: string }>(
        `
          SELECT DATE_TRUNC(
            CASE
              WHEN $${eventIntervalParam} = 'hour' THEN 'hour'
              WHEN $${eventIntervalParam} = 'week' THEN 'week'
              ELSE 'day'
            END,
            created_at
          ) AS period, COUNT(*)::text AS count
          FROM analytics_events
          ${eventWhere}
          GROUP BY period
          ORDER BY period ASC
        `,
        eventParams
      ),
    ]);

    const timelineMap = new Map<string, AnalyticsTimeSeriesPoint>();

    sessionsResult.rows.forEach((row) => {
      const key = row.period.toISOString();
      timelineMap.set(key, {
        period: key,
        sessions: parseInt(row.count, 10),
        events: 0,
      });
    });

    eventsResult.rows.forEach((row) => {
      const key = row.period.toISOString();
      const existing = timelineMap.get(key);
      if (existing) {
        existing.events = parseInt(row.count, 10);
      } else {
        timelineMap.set(key, {
          period: key,
          sessions: 0,
          events: parseInt(row.count, 10),
        });
      }
    });

    return Array.from(timelineMap.values()).sort((a, b) => (a.period < b.period ? -1 : 1));
  }
}

export default AnalyticsService;
