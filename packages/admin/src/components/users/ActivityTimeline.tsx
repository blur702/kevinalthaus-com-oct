// User activity timeline component

import React, { useState, useEffect } from 'react';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Paper,
} from '@mui/material';
import {
  Login as LoginIcon,
  Logout as LogoutIcon,
  Edit as EditIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { UserActivity } from '../../types/user';
import { getUserActivity } from '../../services/usersService';

interface ActivityTimelineProps {
  userId: string;
  limit?: number;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ userId, limit = 50 }) => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const data = await getUserActivity(userId, limit);
        setActivities(data.activities);
      } catch (err) {
        console.error('Failed to fetch user activity:', err);
        setError('Failed to load activity timeline');
      } finally {
        setLoading(false);
      }
    };

    void fetchActivity();
  }, [userId, limit]);

  const getActivityIcon = (action: string): React.ReactNode => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('login')) {
      return <LoginIcon />;
    }
    if (actionLower.includes('logout')) {
      return <LogoutIcon />;
    }
    if (actionLower.includes('edit') || actionLower.includes('update')) {
      return <EditIcon />;
    }
    if (actionLower.includes('security') || actionLower.includes('password')) {
      return <SecurityIcon />;
    }
    if (actionLower.includes('setting')) {
      return <SettingsIcon />;
    }
    return <InfoIcon />;
  };

  const getActivityColor = (action: string): 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('login')) {
      return 'success';
    }
    if (actionLower.includes('logout')) {
      return 'info';
    }
    if (actionLower.includes('delete') || actionLower.includes('fail')) {
      return 'error';
    }
    if (actionLower.includes('warning') || actionLower.includes('alert')) {
      return 'warning';
    }
    if (actionLower.includes('edit') || actionLower.includes('update')) {
      return 'primary';
    }
    return 'secondary';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatFullTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {error}
      </Alert>
    );
  }

  if (activities.length === 0) {
    return (
      <Box py={4} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          No activity recorded yet
        </Typography>
      </Box>
    );
  }

  return (
    <Timeline position="right" sx={{ p: 0 }}>
      {activities.map((activity, index) => (
        <TimelineItem key={activity.id}>
          <TimelineOppositeContent
            sx={{ maxWidth: '100px', paddingLeft: 0 }}
            color="text.secondary"
            variant="caption"
          >
            <Typography variant="caption" title={formatFullTimestamp(activity.timestamp)}>
              {formatTimestamp(activity.timestamp)}
            </Typography>
          </TimelineOppositeContent>

          <TimelineSeparator>
            <TimelineDot color={getActivityColor(activity.action)}>
              {getActivityIcon(activity.action)}
            </TimelineDot>
            {index < activities.length - 1 && <TimelineConnector />}
          </TimelineSeparator>

          <TimelineContent>
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" component="h3" gutterBottom>
                {activity.action}
              </Typography>
              {activity.details && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {activity.details}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {activity.ipAddress && (
                  <Chip
                    label={activity.ipAddress}
                    size="small"
                    variant="outlined"
                    title="IP Address"
                  />
                )}
                {activity.userAgent && (
                  <Chip
                    label={
                      activity.userAgent.length > 30
                        ? `${activity.userAgent.substring(0, 30)}...`
                        : activity.userAgent
                    }
                    size="small"
                    variant="outlined"
                    title={activity.userAgent}
                  />
                )}
              </Box>
            </Paper>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
};

export default ActivityTimeline;
