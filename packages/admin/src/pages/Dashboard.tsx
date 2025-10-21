import React from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,

  Chip,
} from '@mui/material'
import {
  TrendingUp,
  People,
  Article,
  Visibility,
} from '@mui/icons-material'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  icon: React.ReactNode
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  change, 
  icon, 
  color = 'primary' 
}) => (
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
                const trimmedChange = change.trim()
                if (trimmedChange.startsWith('+')) {
                  return 'success'
                }
                if (trimmedChange.startsWith('-')) {
                  return 'error'
                }
                return 'default'
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
)

const Dashboard: React.FC = () => {
  const stats = [
    {
      title: 'Total Users',
      value: '2,543',
      change: '+12%',
      icon: <People />,
      color: 'primary' as const,
    },
    {
      title: 'Page Views',
      value: '45,231',
      change: '+8%',
      icon: <Visibility />,
      color: 'success' as const,
    },
    {
      title: 'Articles',
      value: '128',
      change: '+5%',
      icon: <Article />,
      color: 'warning' as const,
    },
    {
      title: 'Growth',
      value: '23.5%',
      change: '+2.1%',
      icon: <TrendingUp />,
      color: 'secondary' as const,
    },
  ]

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome back! Here's what's happening with your website.
      </Typography>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

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
                  No recent activity to display. Start by adding some content or configuring your settings.
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
  )
}

export default Dashboard