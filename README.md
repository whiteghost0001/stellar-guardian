# stellar-guardian

Soroban contract event indexer and alerting system.

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your database URL and RPC endpoints
npm run db:push
npm run dev
```

## What it does

- Indexes Soroban contract events from Stellar network
- Runs configurable detectors on events (whale transfers, failed txs, etc)
- Sends webhook alerts when detectors trigger
- Basic REST API for querying events and alerts

## Structure

```
src/
├── core/           # shared types and business logic
├── detectors/      # event detection modules
├── ingestor/       # blockchain data ingestion
├── alerts/         # webhook system
├── dashboard/      # basic API endpoints
└── plugins/        # plugin loader (WIP)
```

## Database

Uses PostgreSQL with Prisma. Main tables:
- `contract_events` - indexed blockchain events
- `security_alerts` - detector outputs
- `watched_contracts` - contracts to monitor
- `risk_scores` - risk assessment data

## Detectors

Built-in detectors:
- **whale-transfer**: Large value transfers above configurable thresholds
- **failed-transaction**: Failed contract calls and transactions

Add custom detectors by implementing the `BaseDetector` interface.

## API

Basic endpoints:
- `GET /api/alerts` - list alerts
- `GET /api/events` - list contract events  
- `GET /api/contracts` - watched contracts
- `POST /api/contracts` - add contract to watch

## Webhooks

Register webhook endpoints to get alerts:
```bash
curl -X POST localhost:3000/api/webhooks \
  -d '{"url": "https://your-app.com/webhook", "alertTypes": ["whale_transfer"]}'
```

## Docker

```bash
docker-compose up -d
```

Includes PostgreSQL, Redis, and monitoring stack.

## Config

Key env vars:
```
DATABASE_URL=postgresql://...
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
WHALE_TRANSFER_XLM_THRESHOLD=1000000
```

## Development

```bash
npm run dev     # start dev server
npm test        # run tests
npm run lint    # check code style
```

## License

MIT