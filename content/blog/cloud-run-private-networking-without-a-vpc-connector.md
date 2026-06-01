---
title: "Cloud Run private networking without a VPC Connector"
description: "Direct VPC Egress + Cloud DNS + Private Google Access gets you internal service-to-service calls on Cloud Run for ~$0.20/month instead of $14-30."
date: "2026-05-07"
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: "https://tsdevstack.dev/blog/cloud-run-private-networking-without-a-vpc-connector"
  - - meta
    - property: "og:title"
      content: "Cloud Run private networking without a VPC Connector"
  - - meta
    - property: "og:description"
      content: "Direct VPC Egress + Cloud DNS + Private Google Access gets you internal service-to-service calls on Cloud Run for ~$0.20/month instead of $14-30."
  - - meta
    - property: "og:image"
      content: "https://tsdevstack.dev/blog/cloudrun-private-networking.webp"
  - - meta
    - property: "og:type"
      content: "article"
  - - meta
    - property: "article:published_time"
      content: "2026-05-07"
  - - meta
    - name: "twitter:card"
      content: "summary_large_image"
  - - meta
    - name: "twitter:image"
      content: "https://tsdevstack.dev/blog/cloudrun-private-networking.webp"
  - - script
    - type: "application/ld+json"
    - '{"@context":"https://schema.org","@type":"Article","headline":"Cloud Run private networking without a VPC Connector","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-05-07","dateModified":"2026-05-07","image":"https://tsdevstack.dev/blog/cloudrun-private-networking.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/cloud-run-private-networking-without-a-vpc-connector"}'
---

![Cloud Run private networking without a VPC Connector](/blog/cloudrun-private-networking.webp)

# Cloud Run private networking without a VPC Connector

_Published May 7, 2026 by [gyorgy](https://github.com/gyrgy)_

If you Google how to call one Cloud Run service from another over private networking, every result tells you to provision a Serverless VPC Access Connector. It works. It also runs a managed pool of e2-micro instances you pay for whether you use them or not, costs $14 to $30 per month, and is no longer the recommended pattern.

Google has documented a cleaner approach in at least three different places. It uses Direct VPC Egress, a Cloud DNS private zone, and Private Google Access on your subnet. It costs about $0.20 per month. And it gives you something the connector path quietly fails at: keeping egress: private-ranges-only on your services while still reaching external APIs without a Cloud NAT.

## The problem

You have backend services on Cloud Run that should be unreachable from the public internet. They need to call each other. They need to call external APIs (Stripe, Resend, OpenAI, whatever). And the database and Redis live on private IPs in your VPC.

The "unreachable from the public internet" part is easy. Cloud Run gives you `ingress: internal`. Set it, done.

The hard part is the rest: services calling each other, services calling external APIs, all without re-exposing them or paying for a NAT. Cloud Run lets you set `egress` on outbound traffic, with two useful values:

`all-traffic` routes every outbound packet through your VPC. To reach the public internet from there, you need a Cloud NAT, which is another ~$30 per month plus data processing. Every call to Stripe now hairpins through your network just to leave it again.

`private-ranges-only` only routes private destinations through the VPC. Public IPs go straight out via Google's edge, no NAT needed. This is what you want for external APIs.

But there's a catch. Cloud Run service URLs (`*.run.app`) resolve to public IPs by default. So when service A calls `https://service-b-123.region.run.app`, that traffic exits over the internet path, hits the public Cloud Run frontend, and gets blocked because service B has `ingress: internal`. You see connection failures on your own infrastructure.

The connector approach works around this by routing everything through the VPC and using `all-traffic` egress. That works, but as discussed, it brings the NAT problem back.

## The Google-documented fix

Make `*.run.app` resolve to private IPs from inside your VPC. Specifically, to the `private.googleapis.com` range: `199.36.153.8/30`.

This is not a hack. The [VPC Private Google Access docs](https://cloud.google.com/vpc/docs/configure-private-google-access) explicitly list `*.run.app` among the domains supported via this range, alongside `*.gcr.io`, `*.pkg.dev`, and `*.gke.goog`. The [Cloud Run private networking page](https://cloud.google.com/run/docs/securing/private-networking) recommends it. The [networking best practices doc](https://cloud.google.com/run/docs/configuring/networking-best-practices) calls `private-ranges-only` with Private Google Access the recommended option for reaching Google APIs over Direct VPC Egress. Google maintains a [codelab](https://codelabs.developers.google.com/codelabs/how-to-access-internal-only-service-while-retaining-internet) walking through the exact setup.

Three pieces of Terraform:

```hcl
# 1. Subnet with Private Google Access enabled
resource "google_compute_subnetwork" "subnet" {
  name                     = "${var.project_name}-subnet"
  ip_cidr_range            = "10.0.0.0/24"
  region                   = var.region
  network                  = google_compute_network.vpc.id
  private_ip_google_access = true
}

# 2. Cloud DNS private zone overriding *.run.app
resource "google_dns_managed_zone" "cloudrun_internal" {
  name        = "cloudrun-internal"
  dns_name    = "run.app."
  description = "Route Cloud Run URLs through VPC"
  visibility  = "private"

  private_visibility_config {
    networks {
      network_url = google_compute_network.vpc.id
    }
  }
}

resource "google_dns_record_set" "cloudrun_a" {
  name         = "*.run.app."
  managed_zone = google_dns_managed_zone.cloudrun_internal.name
  type         = "A"
  ttl          = 300
  rrdatas      = [
    "199.36.153.8",
    "199.36.153.9",
    "199.36.153.10",
    "199.36.153.11",
  ]
}

# 3. Cloud Run service with Direct VPC Egress
resource "google_cloud_run_v2_service" "backend" {
  name     = "auth-service"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    vpc_access {
      network_interfaces {
        network    = google_compute_network.vpc.id
        subnetwork = google_compute_subnetwork.subnet.id
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "us-central1-docker.pkg.dev/${var.project_id}/repo/auth-service:latest"
    }
  }
}
```

If you serve IPv6 traffic, also add an AAAA record pointing to `2600:2d00:0002:2000::`.

What happens at runtime: a request from service A to `service-b-123.region.run.app` does a DNS lookup, the private zone returns `199.36.153.x`, and Direct VPC Egress with `private-ranges-only` treats those addresses as internal and routes the traffic through the VPC's Private Google Access path. Traffic stays on Google's network, hits Cloud Run's internal frontend, passes the `ingress: internal` check, and reaches service B.

External APIs still work because they resolve to ordinary public IPs, fall outside the DNS override, and bypass the VPC entirely. No Cloud NAT needed.

A Cloud Run service that needs to be reached by an external Load Balancer (a Kong gateway in front of your stack, for instance) uses `ingress: internal-and-cloud-load-balancing` instead. Same egress and VPC config; slightly looser ingress.

## Is this actually secure?

Reasonable question. Changing how DNS resolves can sound like the kind of thing that accidentally undoes a security boundary.

It does not. Three reasons.

First, `ingress: internal` is enforced at the Cloud Run frontend, not by DNS. The check is "did this request arrive from an allowed network source?" Public traffic still hits a Google-managed boundary that rejects it regardless of how DNS resolved. Resolving `service.run.app` to a different IP doesn't unlock anything; it changes which Google entry point your traffic uses.

Second, IAM is still enforced. The caller's service account needs `roles/run.invoker` on the target. If you remove that binding, requests fail even from inside the VPC. The DNS path doesn't bypass IAM.

Third, the `199.36.153.8/30` range is not "a public IP we are tricking the network to treat as private." It is a Google-owned, Google-routed range published specifically for Private Google Access traffic. It only carries traffic between your VPC and Google services, never to or from the broader internet.

The pattern that would be insecure is setting `ingress: all` and relying on the DNS trick to keep services private. Don't do that. Stack `ingress: internal` plus IAM plus the DNS routing. That is defense in depth, not security through DNS.

## What this costs

| Approach                             | Recurring cost                                 | Components                                                 |
| ------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------- |
| VPC Connector + Cloud NAT            | $44 to $60 per month                           | Connector instance pool ($14 to $30) plus Cloud NAT (~$30) |
| VPC Connector, `all-traffic`, no NAT | $14 to $30 per month, but external APIs broken | Connector only                                             |
| Direct VPC Egress + DNS override     | ~$0.20 per month                               | Cloud DNS private zone                                     |

Direct VPC Egress itself is free. Private Google Access is free. The only line item is the Cloud DNS zone at $0.20 per zone per month, plus $0.40 per million queries.

There's a performance angle too. The connector adds an extra network hop through a managed proxy pool that maxes out around 1 Gbps. Direct VPC Egress is a direct network path with no proxy hop, lower latency, and higher throughput. Google's own [launch blog](https://cloud.google.com/blog/products/serverless/announcing-direct-vpc-egress-for-cloud-run) leads with this when announcing the feature.

## Why is this not the default in tutorials?

Speculation, but: the connector shipped first, and most "Cloud Run private networking" content online predates Direct VPC Egress reaching general availability. The DNS-override pattern is documented across three Google pages (VPC, Cloud Run, codelabs), and it's easy to miss if you only read the first hit on a search. The connector is also conceptually simpler to explain in a one-paragraph blog post: "spin up a connector, point your service at it, done." The DNS-override path requires understanding Private Google Access, which most introductory material skips.

The result is an ecosystem default that is strictly worse than what the platform owner recommends.

## References

- Cloud Run private networking: https://cloud.google.com/run/docs/securing/private-networking
- Configure Private Google Access: https://cloud.google.com/vpc/docs/configure-private-google-access
- Cloud Run networking best practices: https://cloud.google.com/run/docs/configuring/networking-best-practices
- Codelab walkthrough: https://codelabs.developers.google.com/codelabs/how-to-access-internal-only-service-while-retaining-internet
- Direct VPC Egress launch blog: https://cloud.google.com/blog/products/serverless/announcing-direct-vpc-egress-for-cloud-run

---

This is the default GCP networking setup for [tsdevstack](https://tsdevstack.dev). The Terraform above is essentially what the framework generates from a single config file.
