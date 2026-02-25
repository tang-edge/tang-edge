# Tang-edge deploy image — contains all platform CLIs.
# Usage: docker run --rm -e CLOUDFLARE_API_TOKEN=xxx ghcr.io/tang-edge/tang-edge cloudflare
# See: docs/docker.md

FROM oven/bun:1@sha256:856da45d07aeb62eb38ea3e7f9e1794c0143a4ff63efb00e6c4491b627e2a521

ARG TARGETARCH
ARG DENO_VERSION=v2.7.1
ARG FASTLY_VERSION=v14.0.1

# System deps (ca-certificates required for curl HTTPS downloads)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      unzip \
      python3-minimal \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2 (pinned via official installer URL)
RUN set -e; \
    if [ "$TARGETARCH" = "arm64" ]; then AWS_ARCH="aarch64"; else AWS_ARCH="x86_64"; fi; \
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o /tmp/awscli.zip && \
    unzip /tmp/awscli.zip -d /tmp/awscli && \
    /tmp/awscli/aws/install && \
    rm -rf /tmp/awscli /tmp/awscli.zip && \
    aws --version

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

# Install deployctl (Deno Deploy CLI; --global required in deno v2)
RUN deno install --global -Arf jsr:@deno/deployctl

WORKDIR /tang-edge

# Install app dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .
RUN chmod +x /tang-edge/deploy.sh

ENTRYPOINT ["/tang-edge/deploy.sh"]
