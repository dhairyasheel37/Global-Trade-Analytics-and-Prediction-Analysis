#!/usr/bin/env bash
# ==============================================================================
# Global Trade Analytics & Predictive Intelligence Platform
# 1-Click Deployment Script for Linux / macOS / Cloud VPS
# ==============================================================================

set -euo pipefail

# Text formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}============================================================${NC}"
echo -e "${BLUE}  GLOBAL TRADE ANALYTICS & PREDICTIVE INTELLIGENCE PLATFORM  ${NC}"
echo -e "${CYAN}  Docker Deployment Orchestrator (Linux / macOS)            ${NC}"
echo -e "${CYAN}============================================================${NC}\n"

# Determine Docker Compose Command
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERROR] Neither 'docker compose' nor 'docker-compose' found.${NC}"
    echo -e "${YELLOW}Please install Docker Engine & Compose plugin: https://docs.docker.com/engine/install/${NC}"
    exit 1
fi

# Verify Docker Daemon
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Docker daemon is not running or current user lacks docker group permissions.${NC}"
    echo -e "${YELLOW}Try: sudo systemctl start docker (or add user to docker group: sudo usermod -aG docker \$USER)${NC}"
    exit 1
fi

ACTION="up"
BUILD_FLAG=""
DETACH_FLAG="-d"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --build|-b)
            BUILD_FLAG="--build"
            shift
            ;;
        --down|-d)
            ACTION="down"
            shift
            ;;
        --logs|-l)
            ACTION="logs"
            shift
            ;;
        --status|-s|ps)
            ACTION="ps"
            shift
            ;;
        --foreground|-f)
            DETACH_FLAG=""
            shift
            ;;
        --help|-h)
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --build, -b       Rebuild Docker images before starting"
            echo "  --down, -d        Stop and remove containers"
            echo "  --logs, -l        Follow container log outputs"
            echo "  --status, -s      Show running container status"
            echo "  --foreground, -f  Run in foreground (attached mode)"
            echo "  --help, -h        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
done

if [[ "$ACTION" == "down" ]]; then
    echo -e "${YELLOW}[ACTION] Stopping containers...${NC}"
    $COMPOSE_CMD down
    echo -e "${GREEN}[OK] Containers stopped.${NC}"
    exit 0
fi

if [[ "$ACTION" == "logs" ]]; then
    $COMPOSE_CMD logs -f
    exit 0
fi

if [[ "$ACTION" == "ps" ]]; then
    $COMPOSE_CMD ps
    exit 0
fi

# Prepare environment file
echo -e "${YELLOW}[1/4] Preparing environment...${NC}"
if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        cp .env.example .env
        echo -e "${GREEN}      Generated .env from .env.example${NC}"
    else
        touch .env
        echo -e "${YELLOW}      Created blank .env${NC}"
    fi
else
    echo -e "${GREEN}      Active .env detected.${NC}"
fi

# Prepare persistent data directories
echo -e "${YELLOW}[2/4] Ensuring data directory structures...${NC}"
mkdir -p data/raw

# Launch Containers
echo -e "${YELLOW}[3/4] Starting containers...${NC}"
$COMPOSE_CMD up $BUILD_FLAG $DETACH_FLAG

# Summary
echo -e "\n${GREEN}[4/4] Deployment Successful!${NC}"
echo -e "${CYAN}------------------------------------------------------------${NC}"
echo -e "  Web Application:   ${CYAN}http://localhost${NC} (or http://localhost:5173)"
echo -e "  FastAPI Backend:   ${CYAN}http://localhost:8000${NC}"
echo -e "  Interactive Docs:  ${CYAN}http://localhost:8000/docs${NC}"
echo -e "  Health Check:      ${CYAN}http://localhost:8000/api/health${NC}"
echo -e "${CYAN}------------------------------------------------------------${NC}"
echo -e "${YELLOW}Helpful Commands:${NC}"
echo -e "  View Logs:         ./deploy.sh --logs"
echo -e "  Container Status:  ./deploy.sh --status"
echo -e "  Stop Platform:     ./deploy.sh --down"
echo -e "  Rebuild Images:    ./deploy.sh --build\n"
