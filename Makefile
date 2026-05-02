.PHONY: build build-gpu up up-gpu up-ts down restart logs logs-orch logs-a logs-b ps status clean help

IMAGE         := dis-com:latest
ORCH          ?= http://localhost:8000

# Default: CPU build that runs anywhere. Override on the CLI for other variants:
#   make build TORCH_VARIANT=cu121
#   make build TORCH_VARIANT=cu124
TORCH_VARIANT ?= cpu
TORCH_VERSION ?= 2.5.1

# GPU compose: layer the override on top of the base file.
COMPOSE_GPU   := -f docker-compose.yml -f docker-compose.gpu.yml
# Tailscale compose: layer the capability override on top of the base file.
COMPOSE_TS    := -f docker-compose.yml -f docker-compose.tailscale.yml

help:
	@echo "Build:"
	@echo "  build         Build $(IMAGE) with CPU torch (default — small image, runs anywhere)"
	@echo "  build-gpu     Build $(IMAGE) with CUDA 12.1 torch (~7GB; needs nvidia driver to run)"
	@echo ""
	@echo "Run:"
	@echo "  up            Start the stack. Workers auto-detect: CUDA if visible, else CPU."
	@echo "  up-gpu        Start the stack and reserve 1 GPU per worker (forces TORCH_DEVICE=cuda)."
	@echo "  up-ts         Start the stack with Tailscale (requires TS_AUTHKEY=tskey-...)."
	@echo "  down          Stop the stack"
	@echo "  restart       down + up"
	@echo ""
	@echo "Inspect:"
	@echo "  ps            docker compose ps"
	@echo "  logs          tail all logs"
	@echo "  logs-orch     tail orchestrator"
	@echo "  logs-a        tail node-a"
	@echo "  logs-b        tail node-b"
	@echo "  status API_KEY=xx   GET /api/state"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean         down -v + remove the image"
	@echo ""
	@echo "Per-container override:"
	@echo "  Set TORCH_DEVICE=cpu|cuda|mps in your environment / .env to force a specific"
	@echo "  device on the workers. Unset = auto-detect via torch.cuda.is_available()."

build:
	docker compose build \
	  --build-arg TORCH_VARIANT=$(TORCH_VARIANT) \
	  --build-arg TORCH_VERSION=$(TORCH_VERSION)

build-gpu:
	$(MAKE) build TORCH_VARIANT=cu121

up:
	docker compose up -d

up-gpu:
	docker compose $(COMPOSE_GPU) up -d

up-ts:
	TS_AUTHKEY=$(TS_AUTHKEY) docker compose $(COMPOSE_TS) up -d

down:
	docker compose down

restart: down up

ps:
	docker compose ps

logs:
	docker compose logs -f --tail=200

logs-orch:
	docker compose logs -f orchestrator

logs-a:
	docker compose logs -f node-a

logs-b:
	docker compose logs -f node-b

status:
	@curl -sf -H "X-API-Key: $(API_KEY)" $(ORCH)/api/state | python3 -m json.tool

clean:
	docker compose down -v
	-docker rmi $(IMAGE)
