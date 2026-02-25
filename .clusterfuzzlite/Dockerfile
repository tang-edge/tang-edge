FROM node:22-slim@sha256:74a21da88cf4b2e8fde34558376153c5cd80b00ca81da2e659387e76524edc73

COPY . $SRC/tang-edge
WORKDIR $SRC/tang-edge

RUN bun install --frozen-lockfile
