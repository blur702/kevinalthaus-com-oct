# LLM Reference

This document provides a reference for the Large Language Model, detailing the purpose of various classes, objects, variables, and arrays within the codebase.

## Table of Contents

- [Introduction](#introduction)
- [Packages](#packages)
  - [admin](#admin)
  - [api-gateway](#api-gateway)
  - [frontend](#frontend)
  - [main-app](#main-app)
  - [plugin-engine](#plugin-engine)
  - [shared](#shared)
- [Plugins](#plugins)
  - [auth-plugin](#auth-plugin)
  - [blog](#blog)
  - [comments](#comments)
  - [content-manager](#content-manager)
  - [example-service-plugin](#example-service-plugin)
  - [page-builder](#page-builder)
  - [ssdd-validator](#ssdd-validator)
  - [taxonomy](#taxonomy)
  - [user-manager](#user-manager)

## Introduction

This document is intended to be used by a Large Language Model to understand the codebase. It provides a high-level overview of the different parts of the application and their purposes.

## Packages

### admin

The `admin` package contains the source code for the admin panel, which is a React application built with Vite. It provides the user interface for managing the application, including users, content, and settings.

The main directories are:

- **`src/components`**: Reusable React components used throughout the admin panel.
- **`src/hooks`**: Custom React hooks for managing state and side effects.
- **`src/lib`**: API wrappers and authentication helpers.
- **`src/pages`**: The main pages of the admin panel, such as the dashboard, users page, and settings page.
- **`src/services`**: Services for interacting with the backend API.

### api-gateway

The `api-gateway` package is the main entry point for all API requests. It is responsible for:

- Starting the main server.
- Loading environment variables.
- Configuring and managing application-wide logging.
- Handling graceful shutdown of the server.

### frontend

The `frontend` package contains the source code for the public-facing frontend of the application. It is a React application built with Vite and provides the main user interface for visitors to the website.

The main directories are:

- **`src/components`**: Reusable React components, such as the header and footer.
- **`src/contexts`**: React contexts for managing global state, such as authentication.
- **`src/pages`**: The main pages of the frontend, such as the home page, about page, and login page.

### main-app

The `main-app` package is the core of the backend application. It is a Node.js application written in TypeScript and is responsible for handling the main business logic, API routes, database interactions, and plugin management.

The main directories are:

- **`src/auth`**: Authentication and authorization-related code, including RBAC middleware.
- **`src/db`**: Database-related code, including migrations.
- **`src/middleware`**: Express middleware for various purposes, such as CSRF protection, rate limiting, and file uploads.
- **`src/plugins`**: The plugin manager and executor.
- **`src/routes`**: API routes for the application.
- **`src/services`**: Various services, such as `AuthService`, `BlogService`, and `StorageService`.

### plugin-engine

The `plugin-engine` is a separate Node.js server responsible for loading and running plugins in an isolated environment. This design enhances security and stability by separating plugin code from the main application.

Key responsibilities include:

- **Plugin Loading:** Dynamically loads plugins from the filesystem.
- **Database Connection:** Provides database access to plugins.
- **Internal API:** Exposes an internal API, secured by a token, for communication with the `api-gateway`.
- **User Context:** Receives user information from the `api-gateway` through request headers.
- **Plugin Activation:** Activates plugins by calling their `onActivate` method and passing a context object with access to resources like the database and logger.

### shared

The `shared` package is a collection of reusable code that is shared across different packages and plugins in the monorepo. It provides a centralized location for common functionalities, ensuring consistency and reducing code duplication.

The package includes the following modules:

- **Components:** Reusable React components, such as `TaxonomyField` and `RichTextEditor`.
- **Constants:** Application-wide constants.
- **Database:** Utilities for database interactions, including connection management, naming conventions, and transaction isolation.
- **Middleware:** Express middleware, such as the `requestId` middleware for tracking requests.
- **Plugin:** Core functionalities for the plugin system, including plugin lifecycle management, manifest validation, and a plugin registry.
- **Security:** Security-related utilities, such as password hashing, Role-Based Access Control (RBAC), and input sanitization.
- **Sentry:** Configuration and helpers for Sentry integration for error reporting.
- **Services:** Base classes, decorators, and a service container for building and managing services.
- **Theme:** Theme definitions for the frontend and backend UI.
- **Types:** Shared TypeScript types and interfaces used across the application.
- **Utils:** Various utility functions, including a logger, port manager, and YAML parser.



## Plugins

### auth-plugin

The `auth-plugin` is responsible for handling user authentication and authorization. It provides a complete authentication system, including:

- User registration and login.
- JSON Web Token (JWT) generation and validation.
- Password hashing and verification.
- Middleware for protecting routes and enforcing access control.

The plugin has its own database migrations for creating the necessary tables for users and refresh tokens.

### blog

The `blog` plugin provides a complete blogging platform for the application. It includes:

- **Backend:** API endpoints for creating, reading, updating, and deleting blog posts.
- **Frontend:** A set of React components for displaying blog posts on the frontend.
- **Admin UI:** A user interface in the admin panel for managing blog posts, including a form for creating and editing posts.
- **Database:** Database migrations for creating the necessary tables for blog posts, authors, and SEO metadata.

### comments

The `comments` plugin provides a simple commenting system for the application. It allows users to add comments to posts and includes basic moderation features.

### content-manager

The `content-manager` plugin is a comprehensive tool for managing various types of content in the application. It provides a flexible and extensible framework for handling different content structures.

Key features include:

- **Content Management:** Create, read, update, and delete content entries.
- **Media Management:** Upload, manage, and serve media files.
- **Taxonomy Management:** Organize content with categories, tags, and other taxonomies.
- **Content Scheduling:** Schedule content to be published or unpublished at a specific time.

### example-service-plugin

The `example-service-plugin` serves as a simple example of how to create a service plugin. It demonstrates the basic structure of a plugin and how it can be integrated into the application.

### page-builder

The `page-builder` plugin is a powerful tool for building custom pages using a drag-and-drop interface. It provides a flexible and extensible framework for creating unique page layouts.

Key features include:

- **Drag-and-Drop Interface:** A user-friendly interface for building pages by dragging and dropping widgets.
- **Widget System:** A collection of pre-built widgets that can be used to add content to pages.
- **Layout System:** A flexible layout system that allows for the creation of complex page structures.
- **Widget Registry:** A registry for discovering and managing widgets.
- **Page Service:** A service for creating, reading, updating, and deleting pages.

### ssdd-validator

The `ssdd-validator` plugin is a specialized tool for validating addresses and districts. It appears to be designed for a specific business purpose, likely related to geographical data processing.

Key features include:

- **Address Validation:** Validate addresses against a database of known addresses.
- **District Lookup:** Look up districts based on an address or coordinates.
- **KML Import:** Import Keyhole Markup Language (KML) files to define district boundaries.
- **Representative Lookup:** Find representatives for a given district.

### taxonomy

The `taxonomy` plugin provides a system for managing taxonomies, such as categories and tags. It allows for the organization and classification of content, making it easier to discover and manage.

Key features include:

- **Vocabulary Management:** Create and manage vocabularies, which are containers for terms.
- **Term Management:** Create, read, update, and delete terms within a vocabulary.
- **Hierarchical Taxonomies:** Create hierarchical relationships between terms.

### user-manager

The `user-manager` plugin provides a user interface for managing users in the application. It extends the basic user management functionality with more advanced features.

Key features include:

- **User Management:** A UI for creating, reading, updating, and deleting users.
- **Custom Fields:** Add custom fields to user profiles to store additional information.
- **Bulk Operations:** Perform bulk operations on users, such as deleting multiple users at once.
- **Activity Logging:** Track user activity, such as logins and password changes.
- **User Service:** A service for managing users.
- **Activity Service:** A service for logging user activity.









