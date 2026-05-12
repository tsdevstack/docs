# Swagger UI and API Documentation

Your API documentation is generated automatically from your code. This guide explains how to access, use, and generate the documentation.

## Zero-Config Documentation

The framework generates [OpenAPI](https://swagger.io/specification/) documentation without any manual configuration. All metadata comes from your `package.json`:

```json
{
  "name": "auth-service",
  "version": "1.0.0",
  "description": "Backend authentication service"
}
```

This produces documentation with:
- **Title**: "Auth Service" (derived from package name)
- **Version**: "1.0.0"
- **Description**: "Backend authentication service"

No separate config files to maintain. Update your `package.json` and the docs update automatically.

## Accessing Swagger UI

### During Development

Start your service:

```bash
npm run dev
```

Open Swagger UI in your browser:

```
http://localhost:3001/api
```

The port depends on your service configuration. Each service runs on its own port (check `.tsdevstack/config.json`).

Swagger is served directly by each service, not through Kong gateway.

### Raw OpenAPI JSON

Access the JSON specification directly:

```
http://localhost:3001/api-json
```

Useful for importing into API tools like [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/).

## Build-Time JSON Generation

Generate an OpenAPI JSON file for client generation or deployment:

```bash
npm run docs:generate
```

This creates `./docs/openapi.json` containing the complete API specification.

### How It Works

The generation script creates a temporary NestJS application, extracts the OpenAPI document, writes it to disk, and shuts down. No HTTP server is started.

```
apps/your-service/
├── package.json              # Metadata source
├── scripts/
│   └── generate-openapi.ts   # Generation script
└── docs/
    └── openapi.json          # Generated output
```

### Generating TypeScript Clients

After generating the OpenAPI spec, create a TypeScript client:

```bash
npm run client:generate
```

Or run both in sequence:

```bash
npm run docs:generate && npm run client:generate
```

## Testing Authenticated Endpoints

Protected endpoints display a lock icon in Swagger UI. To test them:

### Step 1: Get a Token

Use the login endpoint to authenticate:

1. Find the `POST /auth/login` endpoint
2. Click "Try it out"
3. Enter valid credentials
4. Click "Execute"
5. Copy the `access_token` from the response

### Step 2: Authorize

1. Click the "Authorize" button at the top right of Swagger UI
2. Paste your token in the "bearer" field
3. Click "Authorize"
4. Click "Close"

### Step 3: Make Requests

All subsequent requests automatically include your JWT token. Protected endpoints will now work correctly.

The authorization persists until you refresh the page or click "Logout" in the authorize dialog.

## How Endpoints Are Documented

Swagger automatically detects:

- **Routes** from `@Controller()` and HTTP method decorators (`@Get`, `@Post`, etc.)
- **Groupings** from `@ApiTags()`
- **Descriptions** from `@ApiOperation()`
- **Request schemas** from DTO parameters with `@ApiProperty()`
- **Response schemas** from `@ApiResponse()` decorators
- **Security requirements** from guards and security decorators
- **Validation rules** from `class-validator` decorators

Add a new endpoint and it appears in Swagger automatically on the next restart.

## Common Tasks

### Update Documentation Metadata

Edit your `package.json`:

```json
{
  "name": "auth-service",
  "description": "Your new description here"
}
```

Restart the service to see changes in Swagger UI.

### Refresh After Code Changes

In development mode, restart your service:

```bash
npm run dev
```

For generated files:

```bash
npm run docs:generate && npm run client:generate
```

### Add Endpoint Documentation

Add decorators to your controller method:

```typescript
@ApiOperation({ summary: 'Logout user' })
@ApiOkResponse({ description: 'Successfully logged out' })
@Post('logout')
async logout() {
  // Automatically appears in Swagger UI
}
```

See [OpenAPI Decorators](./openapi-decorators.md) for the complete decorator reference.

## Security Schemes

The framework automatically configures two security schemes:

**Bearer Authentication (JWT)**
- Type: HTTP Bearer
- Format: JWT
- Used for user authentication

**API Key Authentication**
- Type: API Key
- Header: `x-api-key`
- Used for partner integrations

Both schemes appear in the "Authorize" dialog when endpoints require them.
