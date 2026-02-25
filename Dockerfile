# Tang-edge deploy image — contains all platform CLIs.
# Usage: docker run --rm -e CLOUDFLARE_API_TOKEN=xxx ghcr.io/tang-edge/tang-edge cloudflare
# See: docs/docker.md

FROM oven/bun:1

ARG TARGETARCH
ARG DENO_VERSION=v2.7.1
ARG FASTLY_VERSION=v14.0.1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (pinned version, direct binary download)
RUN set -e; \
    if [ "$TARGETARCH" = "arm64" ]; then DENO_ARCH="aarch64-unknown-linux-gnu"; \
    else DENO_ARCH="x86_64-unknown-linux-gnu"; fi; \
    curl -fsSL "https://github.com/denoland/deno/releases/download/${DENO_VERSION}/deno-${DENO_ARCH}.zip" \
      -o /tmp/deno.zip && \
    unzip /tmp/deno.zip -d /usr/local/bin/ && \
    rm /tmp/deno.zip && \
    deno --version

# Install Fastly CLI (pinned version, direct binary download)
RUN set -e; \
    if [ "$TARGETARCH" = "arm64" ]; then FASTLY_ARCH="arm64"; else FASTLY_ARCH="amd64"; fi; \
    VER="${FASTLY_VERSION#v}"; \
    curl -fsSL "https://github.com/fastly/cli/releases/download/${FASTLY_VERSION}/fastly_${FASTLY_VERSION}_linux-${FASTLY_ARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin/ fastly && \
    fastly version

# Install npm-based CLIs
RUN bun add -g \
      wrangler@3 \
      vercel \
      netlify-cli@20 \
      supabase@2 \
      azure-functions-core-tools@4 \
      --unsafe-perm

# Install deployctl (Deno Deploy CLI)
RUN deno install -Arf jsr:@deno/deployctl

WORKDIR /tang-edge

# Install app dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

ENTRYPOINT ["/tang-edge/deploy.sh"]
