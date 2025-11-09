import React from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import { captureException, captureMessage } from '@monorepo/shared';

const SentryTestPage: React.FC = () => {
  const [testResults, setTestResults] = React.useState<string[]>([]);

  const handleTestError = () => {
    try {
      throw new Error('Manual test error triggered from Sentry Test Page');
    } catch (error) {
      captureException(error);
      setTestResults((prev) => [...prev, 'Error captured and sent to Sentry']);
    }
  };

  const handleTestMessage = () => {
    captureMessage('Test message from Sentry Test Page', 'info');
    setTestResults((prev) => [...prev, 'Message sent to Sentry']);
  };

  const handleUncaughtError = () => {
    // This will trigger the error boundary
    throw new Error('Uncaught error to test error boundary');
  };

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Sentry Integration Test
      </Typography>

      <Typography variant="body1" paragraph>
        This page allows you to test the Sentry error tracking integration.
        Click the buttons below to trigger different types of errors and messages.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Note: Sentry is only enabled in production mode. In development, errors will
        be logged to the console but not sent to Sentry.
      </Alert>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Test Actions
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            color="error"
            onClick={handleTestError}
          >
            Test Caught Error
          </Button>

          <Button
            variant="contained"
            color="warning"
            onClick={handleTestMessage}
          >
            Test Message Capture
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={handleUncaughtError}
          >
            Test Error Boundary (Uncaught Error)
          </Button>
        </Box>
      </Paper>

      {testResults.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Test Results
          </Typography>
          <Box component="ul">
            {testResults.map((result, index) => (
              <Typography
                component="li"
                key={index}
                variant="body2"
                sx={{ mb: 1 }}
              >
                {result}
              </Typography>
            ))}
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setTestResults([])}
            sx={{ mt: 2 }}
          >
            Clear Results
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default SentryTestPage;
