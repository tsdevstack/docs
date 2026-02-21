# JWT Tokens

tsdevstack uses [JSON Web Tokens (JWT)](https://jwt.io/) for stateless authentication. Tokens are issued by the auth service and validated by [Kong](https://konghq.com/) before requests reach your backend services.

## Token types

### Access tokens

Short-lived tokens used for API authentication:

- **Lifetime**: Configurable via `ACCESS_TOKEN_TTL`
- **Usage**: Sent in Authorization header
- **Algorithm**: RS256 (RSA signatures)

```typescript
// Access token payload
{
  sub: 'user-123',           // User ID
  email: 'user@example.com',
  role: 'USER',              // User role
  confirmed: true,           // Email confirmation status
  status: 'ACTIVE',          // Account status
  iss: 'auth-service',       // Issuer
  aud: 'kong',               // Audience (Kong validates this)
  iat: 1234567890,           // Issued at
  exp: 1234568790            // Expiration
}
```

### Refresh tokens

Longer-lived tokens used to obtain new access tokens:

- **Lifetime**: Configurable via `REFRESH_TOKEN_TTL`
- **Format**: Random 64-byte hex string (not a JWT)
- **Storage**: SHA-256 hashed before storing in database
- **Usage**: Exchanged for new access tokens via refresh endpoint
- **Rotation**: Each refresh issues a new token and invalidates the old one

## Token validation flow

1. Client sends request with `Authorization: Bearer <token>`
2. Kong validates JWT signature against JWKS endpoint
3. Kong extracts claims and passes user info to backend
4. Backend AuthGuard makes user info available via `req.user`

**Note:** JWT validation only happens for routes with `@ApiBearerAuth()`. See [Two-layer authentication](/authentication/protected-routes#two-layer-authentication) for how Kong and AuthGuard work together.

## JWKS endpoint

The auth service exposes a JWKS (JSON Web Key Set) endpoint for public key discovery:

```
GET /auth/.well-known/jwks.json
```

Note: Route prefixes use the short service name (e.g., `/auth/`) not the full package name.

This enables key rotation without service restarts - Kong fetches keys dynamically.

## Configuration

JWT keys are managed through the secrets system. The framework generates RSA key pairs automatically.

| Secret | Description |
|--------|-------------|
| `JWT_PRIVATE_KEY_CURRENT` | RSA private key for signing |
| `JWT_PUBLIC_KEY_CURRENT` | RSA public key for verification |
| `JWT_KEY_ID_CURRENT` | Key ID (kid) for JWKS |
| `ACCESS_TOKEN_TTL` | Access token lifetime in seconds |
| `REFRESH_TOKEN_TTL` | Refresh token lifetime in seconds |

To customize token expiry, add to `.secrets.user.json`:

```json
{
  "secrets": {
    "ACCESS_TOKEN_TTL": "1800",
    "REFRESH_TOKEN_TTL": "1209600"
  }
}
```

## Key rotation

The framework supports seamless key rotation:

1. Generate new keys and set as `JWT_*_CURRENT`
2. Move old keys to `JWT_*_PREVIOUS`
3. JWKS endpoint returns both keys
4. Existing tokens remain valid until expiry

