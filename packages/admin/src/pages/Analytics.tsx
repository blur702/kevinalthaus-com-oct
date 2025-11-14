import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  ButtonGroup,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';

type DashboardSummary = {
  total_sessions: number;
  active_sessions: number;
  average_duration_seconds: number;
  total_events: number;
  total_page_views: number;
};

type TopEvent = {
  event_name: string;
  count: number;
  unique_sessions: number;
};

type TopPage = {
  page_path: string;
  views: number;
  unique_visitors: number;
};

type TimelinePoint = {
  period: string;
  sessions: number;
  events: number;
};

type DashboardData = {
  summary: DashboardSummary;
  topEvents: TopEvent[];
  topPages: TopPage[];
  activeGoals: Array<{ id: string; name: string; goal_type: string; is_active: boolean }>;
  activeFunnels: Array<{ id: string; name: string; is_active: boolean }>;
  recentEvents: Array<{ id: string; event_name: string; created_at: string }>;
  timeline: TimelinePoint[];
};

type DashboardResponse = {
  success: boolean;
  data: DashboardData;
  range: {
    label: string;
    value: string;
    startDate: string;
    endDate: string;
    interval: string;
  };
};

const RANGE_OPTIONS = [
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
];

const Analytics: React.FC = () => {
  const [range, setRange] = useState('7d');
  const [data, setData] = useState<DashboardData | null>(null);
  const [rangeMeta, setRangeMeta] = useState<DashboardResponse['range'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/analytics/dashboard/overview?range=${range}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || 'Failed to load analytics');
        }
        return (await response.json()) as DashboardResponse;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        if (!payload.success) {
          throw new Error('Analytics endpoint returned an error');
        }
        setData(payload.data);
        setRangeMeta(payload.range);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const averageMinutes = useMemo(() => {
    if (!data) {
      return 0;
    }
    return Math.round((data.summary.average_duration_seconds / 60) * 10) / 10;
  }, [data]);

  // Check if analytics feature is returning empty data (feature disabled)
  const isAnalyticsEmpty = useMemo(() => {
    if (!data) {
      return false;
    }
    return (
      data.summary.total_sessions === 0 &&
      data.summary.total_events === 0 &&
      data.topEvents.length === 0 &&
      data.topPages.length === 0 &&
      data.recentEvents.length === 0 &&
      data.timeline.length === 0
    );
  }, [data]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor engagement, session quality, and top conversion signals.
          </Typography>
        </Box>
        <ButtonGroup variant="outlined" color="primary" sx={{ mt: { xs: 2, md: 0 } }}>
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={range === option.value ? 'contained' : 'outlined'}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && data && isAnalyticsEmpty && (
        <Alert severity="info" sx={{ mb: 4 }}>
          Analytics tracking is currently disabled. All metrics show zero data. Contact your administrator to enable analytics features.
        </Alert>
      )}

      {!loading && !error && data && (
        <>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {rangeMeta?.label}
            {(() => {
              if (rangeMeta?.startDate && rangeMeta?.endDate) {
                const start = new Date(rangeMeta.startDate);
                const end = new Date(rangeMeta.endDate);
                const startValid = !isNaN(start.getTime());
                const endValid = !isNaN(end.getTime());

                if (startValid && endValid) {
                  return <> &middot; {start.toLocaleString()} – {end.toLocaleString()}</>;
                }
              }
              return null;
            })()}
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Sessions
                  </Typography>
                  <Typography variant="h4">{data.summary.total_sessions.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active: {data.summary.active_sessions.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Events
                  </Typography>
                  <Typography variant="h4">{data.summary.total_events.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Page views: {data.summary.total_page_views.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Avg Session Duration
                  </Typography>
                  <Typography variant="h4">{averageMinutes} min</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.summary.average_duration_seconds.toFixed(0)} seconds
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Active Goals
                  </Typography>
                  <Typography variant="h4">{data.activeGoals.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Funnels: {data.activeFunnels.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Events
                  </Typography>
                  {data.topEvents.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No events recorded for this range.
                    </Typography>
                  )}
                  {data.topEvents.length > 0 && (
                    <List dense>
                      {data.topEvents.map((evt) => (
                        <React.Fragment key={evt.event_name}>
                          <ListItem>
                            <ListItemText
                              primary={evt.event_name}
                              secondary={`Sessions: ${evt.unique_sessions.toLocaleString()}`}
                            />
                            <Typography variant="body1" fontWeight={600}>
                              {evt.count.toLocaleString()}
                            </Typography>
                          </ListItem>
                          <Divider component="li" />
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Pages
                  </Typography>
                  {data.topPages.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No page views for this range.
                    </Typography>
                  )}
                  {data.topPages.length > 0 && (
                    <List dense>
                      {data.topPages.map((page) => (
                        <React.Fragment key={page.page_path}>
                          <ListItem>
                            <ListItemText
                              primary={page.page_path}
                              secondary={`Visitors: ${page.unique_visitors.toLocaleString()}`}
                            />
                            <Typography variant="body1" fontWeight={600}>
                              {page.views.toLocaleString()}
                            </Typography>
                          </ListItem>
                          <Divider component="li" />
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Events
                  </Typography>
                  {data.recentEvents.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No events recorded.
                    </Typography>
                  )}
                  {data.recentEvents.length > 0 && (
                    <List dense>
                      {data.recentEvents.slice(0, 8).map((evt) => (
                        <React.Fragment key={evt.id}>
                          <ListItem>
                            <ListItemText
                              primary={evt.event_name}
                              secondary={new Date(evt.created_at).toLocaleString()}
                            />
                          </ListItem>
                          <Divider component="li" />
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Session Timeline
                  </Typography>
                  {data.timeline.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Timeline data unavailable for this range.
                    </Typography>
                  )}
                  {data.timeline.length > 0 && (
                    <List dense>
                      {data.timeline.slice(-8).map((point) => (
                        <React.Fragment key={point.period}>
                          <ListItem>
                            <ListItemText
                              primary={new Date(point.period).toLocaleString()}
                              secondary={`Events: ${point.events.toLocaleString()}`}
                            />
                            <Typography variant="body1" fontWeight={600}>
                              {point.sessions.toLocaleString()} sessions
                            </Typography>
                          </ListItem>
                          <Divider component="li" />
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default Analytics;
