# Object Storage

tsdevstack provides unified object storage across all cloud providers. Add a bucket, import `StorageModule`, and your code works identically on local [MinIO](https://min.io/), AWS S3, GCP Cloud Storage, and Azure Blob Storage.

## Quick start

Add a storage bucket to your project:

```bash
npx tsdevstack add-bucket-storage --name uploads
```

This updates `config.json`. Then sync to regenerate docker-compose, secrets, and start MinIO:

```bash
npx tsdevstack sync
```

Import the module in your NestJS service:

```typescript
import { Module } from '@nestjs/common';
import { StorageModule } from '@tsdevstack/nest-common';

@Module({
  imports: [
    StorageModule.forRoot({ buckets: ['uploads'] }),
  ],
})
export class AppModule {}
```

Use it in a service:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectStorage } from '@tsdevstack/nest-common';
import type { StorageProvider } from '@tsdevstack/nest-common';

@Injectable()
export class FileService {
  constructor(
    @InjectStorage('uploads') private readonly storage: StorageProvider,
  ) {}

  async uploadFile(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.storage.upload(key, data, contentType);
  }

  async getDownloadUrl(key: string): Promise<string> {
    return this.storage.getPresignedUrl(key, 3600); // 1 hour
  }
}
```

## How it works

The `StorageProvider` interface is the same across all environments. The adapter is selected automatically at runtime based on the `SECRETS_PROVIDER` environment variable:

| `SECRETS_PROVIDER` | Storage Adapter | Used When |
|-------------------|-----------------|-----------|
| `local` | S3 (MinIO) | Local development |
| `aws` | S3 (AWS) | AWS cloud |
| `gcp` | GCS | Google Cloud |
| `azure` | Azure Blob | Azure cloud |

No code changes are needed between environments. The same `StorageProvider` calls work everywhere.

## Local development (MinIO)

When storage buckets are configured, `docker-compose.yml` includes [MinIO](https://min.io/) — an S3-compatible object storage server.

| Service | URL | Purpose |
|---------|-----|---------|
| MinIO API | http://localhost:9000 | S3-compatible API endpoint |
| MinIO Console | http://localhost:9001 | Web-based storage browser |

Default credentials: `minioadmin` / `minioadmin`

### What happens on `docker compose up`

1. MinIO container starts on ports 9000 + 9001
2. `minio-init` job runs automatically — creates all configured buckets using the `mc` CLI
3. Bucket names follow the cloud naming pattern: `{project}-{name}-dev`

### Data persistence

MinIO data is stored in `./data/minio/` (bind mount), the same pattern used by PostgreSQL (`./data/{name}/`) and Redis (`./data/redis/`). Data persists across container restarts.

## StorageModule setup

### Static configuration

Use `forRoot` when bucket names are known at compile time:

```typescript
StorageModule.forRoot({ buckets: ['uploads', 'media-assets'] })
```

### Async configuration

Use `forRootAsync` when you need dynamic configuration (e.g., reading from SecretsService during initialization):

```typescript
StorageModule.forRootAsync({ buckets: ['uploads', 'media-assets'] })
```

Both register the module globally — import once in `AppModule` and `@InjectStorage` works everywhere.

### Multi-bucket access

For services that need multiple buckets, inject each one separately:

```typescript
@Injectable()
export class MediaService {
  constructor(
    @InjectStorage('uploads') private readonly uploads: StorageProvider,
    @InjectStorage('media-assets') private readonly media: StorageProvider,
  ) {}
}
```

Or use `StorageService` to access any bucket dynamically:

```typescript
import { Injectable } from '@nestjs/common';
import { StorageService } from '@tsdevstack/nest-common';

@Injectable()
export class DynamicService {
  constructor(private readonly storageService: StorageService) {}

  async copyToMedia(key: string): Promise<void> {
    const uploads = this.storageService.getProvider('uploads');
    const media = this.storageService.getProvider('media-assets');

    const data = await uploads.download(key);
    await media.upload(key, data);
  }
}
```

## File Uploads

There are two approaches to handling file uploads. Choose based on your requirements.

### Traditional upload (through backend)

Files flow through the full stack: Client → Next.js → Kong → NestJS → Storage.

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(
  @UploadedFile() file: Express.Multer.File,
): Promise<{ url: string }> {
  await this.storage.upload(`files/${file.originalname}`, file.buffer, file.mimetype);
  const url = await this.storage.getPresignedUrl(`files/${file.originalname}`, 3600);
  return { url };
}
```

**Use when:** You need server-side validation, custom naming, synchronous post-processing, or atomic database + file operations.

**Size limits:**

| Layer | Default | Configurable |
|-------|---------|-------------|
| Kong (`client_max_body_size`) | 10MB | `kong.maxUploadSize` in `infrastructure.json` |
| GCP Cloud Run | 32MB | No (hard ceiling) |
| AWS ALB / ECS Fargate | No documented limit | — |
| Azure Front Door | 100MB (Standard) | Tier-dependent |
| NestJS / Multer | No default | `limits.fileSize` on `FileInterceptor` |

Configure the Kong limit in `infrastructure.json`:

```json
{
  "prod": {
    "kong": {
      "maxUploadSize": "25m"
    }
  }
}
```

### Presigned URL upload (direct to storage)

Files go directly from the client to the storage provider, bypassing WAF, load balancer, Kong, and NestJS entirely.

```typescript
// Backend: generate a presigned upload URL
const uploadUrl = await this.storage.getPresignedUrl('files/report.pdf', {
  action: 'put',
  expiresInSeconds: 3600,
  contentType: 'application/pdf',
});
return { uploadUrl };

// Client: upload directly to the URL
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': 'application/pdf' },
});
```

**Use when:** Files are large (>10MB), you want to avoid server-side memory/CPU load, or you need to exceed provider WAF/LB size limits.

**Key details:**
- Works across all providers (GCS v4 signatures, S3 presigned URLs, Azure SAS tokens)
- Maximum URL expiration: 7 days (all providers), configurable via `expiresInSeconds`
- No size limit imposed by WAF or Kong — the file goes directly to the storage bucket
- The backend only handles URL generation (fast, no file data in memory)

## StorageProvider API

All methods are available on every provider adapter.

| Method | Signature | Description |
|--------|-----------|-------------|
| `upload` | `(key: string, data: Buffer \| Readable, contentType?: string) => Promise<void>` | Upload a file. Supports Buffer or stream. |
| `download` | `(key: string) => Promise<Buffer>` | Download a file as Buffer. |
| `downloadStream` | `(key: string) => Promise<Readable>` | Download a file as a readable stream. Use for large files. |
| `delete` | `(key: string) => Promise<void>` | Delete a file. No error if the file doesn't exist. |
| `list` | `(prefix?: string) => Promise<StorageObject[]>` | List files, optionally filtered by prefix. |
| `copy` | `(sourceKey: string, destinationKey: string) => Promise<void>` | Copy a file within the same bucket. |
| `getMetadata` | `(key: string) => Promise<StorageMetadata>` | Get file metadata (size, content type, last modified). |
| `getPresignedUrl` | `(key: string, expiresInSeconds?: number) => Promise<string>` | Generate a temporary download URL. Default expiry varies by provider. |
| `exists` | `(key: string) => Promise<boolean>` | Check if a file exists. |
| `getNativeClient` | `() => S3Client \| Storage \| BlobServiceClient` | Get the underlying provider SDK client for advanced operations. |

### Types

```typescript
interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
}

interface StorageMetadata {
  contentType: string;
  contentLength: number;
  lastModified: Date;
  etag?: string;
}
```

## Bucket naming

| Property | Rule |
|----------|------|
| Logical name | Kebab-case, 2-30 characters (e.g., `uploads`, `media-assets`) |
| Cloud name (GCP/Azure) | `{project}-{name}-{env}` (max 63 characters) |
| Cloud name (AWS) | `{project}-{name}-{env}-{accountId}` (max 63 characters) |
| Azure storage account | `{project}{env}storage` (alphanumeric only, max 24 characters) |
| Reserved names | `minio`, `storage`, `gateway`, `kong`, `redis`, `postgres`, etc. |

Cloud bucket names are derived automatically. You only specify the logical name.

## Secrets

Storage secrets are **framework-managed** and **shared-scope** — they are auto-assigned to all services via `secret-map.json`. You never need to manually add them to `.secrets.user.json`.

### Local secrets

| Secret | Value | Purpose |
|--------|-------|---------|
| `STORAGE_ENDPOINT` | `http://minio:9000` | MinIO API endpoint (internal Docker network) |
| `STORAGE_ACCESS_KEY` | `minioadmin` | MinIO root user |
| `STORAGE_SECRET_KEY` | `minioadmin` | MinIO root password |
| `STORAGE_BUCKET_{NAME}` | `{project}-{name}-dev` | Bucket name per configured bucket |

### Cloud secrets

In cloud environments, only `STORAGE_BUCKET_{NAME}` secrets exist. Credentials are handled by IAM roles — no access keys in containers:

| Provider | Authentication | Secrets |
|----------|---------------|---------|
| AWS | ECS Task Role (IAM) | `STORAGE_BUCKET_*` only |
| GCP | Cloud Run service account | `STORAGE_BUCKET_*` only |
| Azure | Managed Identity + `AZURE_STORAGE_ACCOUNT_NAME` env var | `STORAGE_BUCKET_*` only |

For deeper coverage, see [How Secrets Work](/secrets/how-secrets-work).

## Cloud deployment

Running `infra:deploy` handles everything:

1. **Terraform creates cloud buckets** — S3 buckets (AWS), GCS buckets (GCP), or Azure Blob containers
2. **IAM permissions are granted** — service roles get read/write access to buckets
3. **Post-Terraform sync** pushes `STORAGE_BUCKET_*` secret values to the cloud secret manager
4. **Services are deployed** with access to the new bucket names via SecretsService

### Per-provider details

| | AWS | GCP | Azure |
|---|-----|-----|-------|
| **Resource** | S3 bucket | GCS bucket | Blob container in shared storage account |
| **Access** | Block all public access | Uniform bucket-level access | Private container |
| **Encryption** | AES-256 server-side | Google-managed | Microsoft-managed |
| **IAM** | `s3:GetObject/PutObject/DeleteObject/ListBucket` on ECS task roles | `roles/storage.objectUser` + `roles/iam.serviceAccountTokenCreator` per service account | `Storage Blob Data Contributor` on managed identity |
| **CORS** | `*` | `*` | `*` |

CORS is set to `*` on all providers. Buckets are private — presigned URLs are the security boundary, not CORS. Browser access requires a presigned URL obtained via your API (which is protected by Kong's CORS).

For provider-specific architecture details, see [GCP Architecture](/infrastructure/providers/gcp/architecture), [AWS Architecture](/infrastructure/providers/aws/architecture), or [Azure Architecture](/infrastructure/providers/azure/architecture).

## Removing a bucket

```bash
npx tsdevstack remove-bucket-storage --name uploads
```

**What it does locally:**
- Removes bucket from `config.json`
- Regenerates `docker-compose.yml` (removes MinIO entirely if this was the last bucket)
- Regenerates secrets (removes `STORAGE_*` secrets if this was the last bucket)
- Does **NOT** delete local MinIO data — it remains in `./data/minio/`

**What it does NOT do:**
- Does not remove cloud resources (S3 buckets, GCS buckets, Azure Blob containers)
- Does not remove `STORAGE_BUCKET_*` secrets from cloud secret managers
- Does not delete any stored files

**To clean up cloud resources:**

1. Run `infra:deploy --env {env}` to apply Terraform changes

:::warning
This **permanently deletes all data** in the cloud bucket. Back up your data first if needed.
:::

2. Remove cloud secrets: `cloud-secrets:remove STORAGE_BUCKET_UPLOADS --env {env}`
3. If this was the last bucket, also remove `StorageModule` imports from your NestJS code
