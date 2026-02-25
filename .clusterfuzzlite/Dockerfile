FROM ghcr.io/nicholasgasior/oss-fuzz-base:bun

COPY . $SRC/tang-edge
WORKDIR $SRC/tang-edge

RUN bun install --frozen-lockfile
