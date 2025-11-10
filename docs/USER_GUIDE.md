# User Guide

This guide provides an overview of the application and its features.

## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [Core Features](#core-features)
- [Plugins](#plugins)
- [Troubleshooting](#troubleshooting)

## Introduction

Welcome to the application! This document will help you understand how to use the application and its various features.

The application is a modern, modular, and extensible content management system. It is built with a microservices-oriented architecture, which allows for a high degree of flexibility and scalability.

The main components of the system are:

- **Frontend:** A public-facing website built with React and Vite. It is responsible for displaying content to visitors.
- **Admin Panel:** A separate React application that provides a user interface for managing the application, including users, content, and settings.
- **API Gateway:** The main entry point for all API requests. It is responsible for routing requests to the appropriate backend service.
- **Main Application:** The core of the backend application. It is a Node.js application that handles the main business logic, database interactions, and plugin management.
- **Plugin Engine:** A separate Node.js server that is responsible for loading and running plugins in an isolated environment.

This modular architecture allows for the development of new features and functionality without affecting the core application.


## Getting Started

This section will guide you through the process of setting up the development environment and running the application.

### Prerequisites

Before you begin, make sure you have the following software installed on your system:

- **Node.js:** Version 20 or higher.
- **Docker:** The latest version of Docker.
- **Docker Compose:** The latest version of Docker Compose.
- **OpenSSL:** Required for generating SSL certificates for production.

### Setup

1.  **Clone the repository:**

    ```bash
    git clone <your-repo-url>
    cd <your-repo>
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configure environment:**

    Copy the example environment file to a new file named `.env`:

    ```bash
    cp .env.example .env
    ```

    Then, open the `.env` file and edit the variables to match your local setup.

4.  **Generate JWT secret:**

    The application uses JSON Web Tokens (JWTs) for authentication. To generate a secret key for signing the tokens, run the following command:

    ```bash
    ./scripts/ensure-jwt-secret.sh
    ```

### Running the Application

1.  **Start services:**

    The application uses Docker to run the database and cache services. To start these services, run the following command:

    ```bash
    docker-compose up -d postgres redis
    ```

2.  **Start the application:**

    To start all the application services, including the API gateway, main application, frontend, and admin panel, run the following command:

    ```bash
    npm run dev:all
    ```

Once all the services are running, you can access the different parts of the application at the following URLs:

-   **Frontend:** <http://localhost:3002>
-   **Admin Panel:** <http://localhost:3003>
-   **API Gateway:** <http://localhost:3000>
-   **Main App:** <http://localhost:3001>


## Core Features

The application provides a wide range of features to help you build and manage your web application. Here are some of the core features:

- **Plugin System:** The application has a powerful plugin system that allows you to extend the functionality of the application without modifying the core code. This makes it easy to add new features and integrations.

- **Theme System:** The theme system allows you to customize the look and feel of the frontend and backend of the application. You can create your own themes or use pre-built themes from the community.

- **Security:** The application is built with security in mind. It includes features such as Role-Based Access Control (RBAC), input validation, and timing-safe operations to protect your application from common security threats.

- **Admin Dashboard:** The admin dashboard provides a user-friendly interface for managing the application. You can use the dashboard to manage users, plugins, and other aspects of the application.


## Plugins

The application comes with a set of pre-built plugins that you can use to add functionality to your application. Here are some of the available plugins:

- **Auth Plugin:** Provides a complete authentication system for your application, including user registration, login, and password management.

- **Blog Plugin:** A full-featured blogging platform that allows you to create and manage blog posts.

- **Comments Plugin:** A simple commenting system that allows users to add comments to posts.

- **Content Manager Plugin:** A comprehensive tool for managing various types of content, including media and taxonomy.

- **Page Builder Plugin:** A powerful tool for building custom pages using a drag-and-drop interface.

- **SSDD Validator Plugin:** A specialized tool for validating addresses and districts.

- **Taxonomy Plugin:** A system for managing taxonomies, such as categories and tags.

- **User Manager Plugin:** A user interface for managing users, including custom fields and bulk operations.


## Troubleshooting

(To be filled in)
