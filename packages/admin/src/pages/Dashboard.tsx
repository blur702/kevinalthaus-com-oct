import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { TrendingUp, People, Article, Visibility } from '@mui/icons-material';
import api, { fetchPlugins } from '../lib/api';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, color = 'primary' }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="h2">
            {value}
          </Typography>
          {change && (
            <Chip
              label={change}
              color={(() => {
                const trimmedChange = change.trim();
                if (trimmedChange.startsWith('+')) {
                  return 'success';
                }
                if (trimmedChange.startsWith('-')) {
                  return 'error';
                }
                return 'default';
              })()}
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
        <Box color={`${color}.main`} sx={{ fontSize: '2.5rem' }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

interface DashboardStat {
  id: string;
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback mock data
  const mockStats: DashboardStat[] = [
    {
      id: 'total-users',
      title: 'Total Users',
      value: '2,543',
      change: '+12%',
      icon: <People />,
      color: 'primary' as const,
    },
    {
      id: 'page-views',
      title: 'Page Views',
      value: '45,231',
      change: '+8%',
      icon: <Visibility />,
      color: 'success' as const,
    },
    {
      id: 'articles',
      title: 'Articles',
      value: '128',
      change: '+5%',
      icon: <Article />,
      color: 'warning' as const,
    },
    {
      id: 'growth',
      title: 'Growth',
      value: '23.5%',
      change: '+2.1%',
      icon: <TrendingUp />,
      color: 'secondary' as const,
    },
  ];

  useEffect(() => {
    const controller = new AbortController();

    const fetchStats = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get<{
          totalUsers?: number;
          pageViews?: number;
          articles?: number;
          growth?: number;
          changes?: {
            users?: string;
            views?: string;
            articles?: string;
            growth?: string;
          };
        }>('/api/dashboard/stats', {
          signal: controller.signal,
        });

        const data = response.data;

        // Fetch plugin count from real API
        let pluginCount: number | undefined;
        try {
          const plugins = await fetchPlugins(controller.signal);
          pluginCount = plugins.plugins.length;
        } catch {
          pluginCount = undefined; // leave undefined to fall back to mock
        }

        // Map API response to stat cards with icons and colors
        const fetchedStats: DashboardStat[] = [
          {
            id: 'total-users',
            title: 'Total Users',
            value: data.totalUsers?.toLocaleString() ?? mockStats[0].value,
            change: data.changes?.users ?? mockStats[0].change,
            icon: <People />,
            color: 'primary' as const,
          },
          {
            id: 'plugins',
            title: 'Plugins',
            value: pluginCount !== undefined ? pluginCount : 0,
            change: undefined,
            icon: <Article />,
            color: 'secondary' as const,
          },
          {
            id: 'page-views',
            title: 'Page Views',
            value: data.pageViews?.toLocaleString() ?? mockStats[1].value,
            change: data.changes?.views ?? mockStats[1].change,
            icon: <Visibility />,
            color: 'success' as const,
          },
          {
            id: 'articles',
            title: 'Articles',
            value: data.articles?.toLocaleString() ?? mockStats[2].value,
            change: data.changes?.articles ?? mockStats[2].change,
            icon: <Article />,
            color: 'warning' as const,
          },
          {
            id: 'growth',
            title: 'Growth',
            value:
              data.growth !== null && data.growth !== undefined
                ? `${data.growth}%`
                : mockStats[3].value,
            change: data.changes?.growth ?? mockStats[3].change,
            icon: <TrendingUp />,
            color: 'secondary' as const,
          },
        ];

        setStats(fetchedStats);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled, don't update state
          return;
        }
        console.error('Failed to fetch dashboard stats:', err);
        setError('Failed to load dashboard statistics');
        // Fall back to mock data on error
        setStats(mockStats);
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();

    // Cleanup: abort request if component unmounts
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome back! Here's what's happening with your website.
      </Typography>

      {/* Error Alert */}
      {error && (
        <Alert severity="warning" sx={{ mb: 4 }}>
          {error}. Showing fallback data.
        </Alert>
      )}

      {/* Stats Grid */}
      {loading ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          sx={{ mb: 4, minHeight: 200 }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {stats.map((stat) => (
            <Grid item xs={12} sm={6} md={3} key={stat.id}>
              <StatCard {...stat} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Additional Content */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No recent activity to display. Start by adding some content or configuring your
                  settings.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  • Create new content
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Manage users
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • View analytics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Update settings
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
