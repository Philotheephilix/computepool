# syntax=docker/dockerfile:1.7

# Stage 1: build the AXL node binary
FROM golang:1.25-bookworm AS axl-build

ENV GOTOOLCHAIN=go1.25.5
ENV CGO_ENABLED=0

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone --depth 1 https://github.com/gensyn-ai/axl.git /src/axl

WORKDIR /src/axl
RUN go build -o /out/node ./cmd/node/


# Stage 2: runtime image (worker + orchestrator)
FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates \
        curl \
        gosu \
        tini \
 && rm -rf /var/lib/apt/lists/*

COPY --from=axl-build /out/node /usr/local/bin/node
RUN chmod +x /usr/local/bin/node

WORKDIR /app

# Torch variant is selectable: build-arg TORCH_VARIANT defaults to "cpu"
# so plain `make build` produces a small CPU-only image. Pass cu121 / cu124 /
# etc. for the matching CUDA wheel — those bundle libcudart + libcublas, so
# the host just needs an NVIDIA driver, no CUDA toolkit base image required.
ARG TORCH_VARIANT=cpu
ARG TORCH_VERSION=2.5.1

COPY worker/requirements.txt /app/worker/requirements.txt
RUN pip install --no-cache-dir \
        --extra-index-url "https://download.pytorch.org/whl/${TORCH_VARIANT}" \
        "torch==${TORCH_VERSION}+${TORCH_VARIANT}" \
 && pip install --no-cache-dir -r /app/worker/requirements.txt

COPY orchestrator/requirements.txt /app/orchestrator/requirements.txt
RUN pip install --no-cache-dir -r /app/orchestrator/requirements.txt

COPY worker/ /app/worker/
COPY orchestrator/ /app/orchestrator/

COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

RUN mkdir -p /data

# 7000 worker, 7001 axl tcp, 9002 axl api, 8000 orchestrator
EXPOSE 7000 7001 9002 8000

ENTRYPOINT ["tini", "--", "/usr/local/bin/start.sh"]
CMD ["worker"]
