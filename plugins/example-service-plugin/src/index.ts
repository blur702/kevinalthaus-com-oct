/**
 * Example Service-Based Plugin
 *
 * ✅ CORRECT ARCHITECTURE:
 * - Uses BlogService for blog operations (NO direct DB access)
 * - Uses EditorService for content transformation
 * - Uses TaxonomyService for categorization
 * - Error handling with graceful degradation
 * - Returns structured results
 *
 * ❌ NEVER DO:
 * - Direct database access (pool.query)
 * - Create your own database schemas
 * - Access other plugins' data
 * - Throw unhandled errors
 */

import type { PluginExecutionContext } from '../../../packages/main-app/src/plugins/PluginExecutor';
import type { IBlogService, CreateBlogPostData, IAnalyticsService } from '@monorepo/shared';

/**
 * Plugin handler function
 *
 * This is called by the PluginExecutor with error isolation.
 * Errors thrown here will NOT crash the system.
 */
export async function handler(context: PluginExecutionContext): Promise<unknown> {
  const { services, logger, user, request } = context;

  logger.info('Example service plugin executing');

  // Get BlogService from injected services
  const blogService = services.blog as IBlogService;
  const analyticsService = services.analytics as IAnalyticsService | null;

  if (!blogService) {
    logger.error('BlogService not available');
    return {
      success: false,
      error: 'BlogService not configured',
    };
  }

  try {
    // Example 1: Create a blog post using BlogService
    if (request?.path === '/create-post' && request?.method === 'POST') {
      const { title, body_html, status } = request.body as CreateBlogPostData;

      // Validate input
      if (!title || !body_html) {
        return {
          success: false,
          error: 'Title and body are required',
        };
      }

      // Use BlogService (centralized, proven service)
      const post = await blogService.createPost(
        {
          title,
          body_html,
          status: status || 'draft',
        },
    // Example 5: Emit a custom analytics event via the shared service
    if (request?.path === '/analytics/demo' && request?.method === 'POST') {
      if (!analyticsService) {
        return {
          success: false,
          error: 'AnalyticsService not available',
        };
      }

      const session = await analyticsService.createSession({
        user_id: user.id,
        anonymous_id: `plugin-example-${user.id}`,
        landing_page: '/plugins/example',
        referrer_source: request?.query?.source as string | undefined,
      });

      await analyticsService.trackEvent({
        session_id: session.id,
        user_id: user.id,
        event_name: 'example_plugin_demo_event',
        event_properties: (request?.body as Record<string, unknown>) ?? {},
        page_path: request?.path,
      });

      return {
        success: true,
        data: {
          message: 'Analytics event recorded via service layer',
          sessionId: session.id,
        },
      };
    }

    // Example 3: Get specific post
    if (request?.path?.startsWith('/post/')) {
      const postId = request.path.split('/')[2];

      const post = await blogService.getPostById(postId);

      if (!post) {
        return {
          success: false,
          error: 'Post not found',
        };
      }

      return {
        success: true,
        data: post,
      };
    }

    // Example 4: Publish a post
    if (request?.path?.startsWith('/publish/') && request?.method === 'POST') {
      const postId = request.path.split('/')[2];

      // Check if user owns the post
      const post = await blogService.getPostById(postId);

      if (!post) {
        return {
          success: false,
          error: 'Post not found',
        };
      }

      if (post.author_id !== user.id && user.role !== 'admin') {
        return {
          success: false,
          error: 'Insufficient permissions',
        };
      }

      const publishedPost = await blogService.publishPost(postId, user.id);

      logger.info(`Post published via plugin: ${postId}`);

      return {
        success: true,
        data: publishedPost,
      };
    }

    // Default: Show available endpoints
    return {
      success: true,
      data: {
        message: 'Example service plugin',
        endpoints: [
          'POST /create-post - Create a blog post',
          'GET /my-posts - List your blog posts',
          'GET /post/:id - Get specific post',
          'POST /publish/:id - Publish a post',
          'POST /analytics/demo - Record a demo analytics event',
        ],
      },
    };
  } catch (error) {
    // Log error but don't crash
    logger.error('Plugin execution error:', error as Error);

    // Return graceful error
    return {
      success: false,
      error: 'Plugin execution failed',
      retry: true,
    };
  }
}

/**
 * Health check function
 */
export async function healthCheck(context: PluginExecutionContext): Promise<{
  healthy: boolean;
  message?: string;
}> {
  try {
    // Verify BlogService is accessible
    const blogService = context.services.blog as IBlogService;

    if (!blogService) {
      return {
        healthy: false,
        message: 'BlogService not available',
      };
    }

    // Try a lightweight operation
    const health = await blogService.healthCheck();

    if (!health.healthy) {
      return {
        healthy: false,
        message: `BlogService unhealthy: ${health.message}`,
      };
    }

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Install hook - called when plugin is installed
 */
export async function onInstall(): Promise<void> {
  console.log('[example-service-plugin] Installing plugin');
  // No database setup needed - using centralized services!
}

/**
 * Activate hook - called when plugin is activated
 */
export async function onActivate(): Promise<void> {
  console.log('[example-service-plugin] Activating plugin');
}

/**
 * Deactivate hook - called when plugin is deactivated
 */
export async function onDeactivate(): Promise<void> {
  console.log('[example-service-plugin] Deactivating plugin');
}
