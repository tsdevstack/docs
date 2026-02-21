# Prerequisites

Before installing tsdevstack, make sure you have the following:

## Required

### Node.js 20+

tsdevstack requires Node.js 20 or later.

```bash
node --version
# v20.x.x or higher
```

[Install Node.js](https://nodejs.org/en/download/) if you don't have it.

### Docker

Docker is required for running local infrastructure (Postgres, Redis, Kong).

```bash
docker --version
# Docker version 24.x.x or higher
```

Make sure Docker Desktop (or Docker Engine) is running.

[Install Docker Desktop](https://docs.docker.com/get-docker/)

### Terraform (for cloud deployment)

Terraform is required for deploying to cloud environments.

```bash
terraform --version
# Terraform v1.9.x or higher
```

[Install Terraform](https://developer.hashicorp.com/terraform/install)

You don't need Terraform for local development - only when you're ready to deploy to the cloud.

## Optional but recommended

### Git

For version control and CI/CD integration.

