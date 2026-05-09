# Stellar Guardian

A real-time monitoring system for Stellar's Soroban smart contracts. Think of it as a security camera for your blockchain - it watches contract activity and alerts you when something suspicious happens.

## What does this do?

**Simple explanation:** This tool connects to the Stellar blockchain, watches smart contract activity in real-time, and sends you alerts when it detects potentially suspicious behavior like large transfers or failed transactions.

**For developers:** It's an event indexer and alerting system specifically built for Soroban (Stellar's smart contract platform). It ingests blockchain data, runs configurable detection algorithms, and provides webhook notifications plus a REST API.

## Why would I use this?

- **Security monitoring**: Get notified of large transfers, failed transactions, or suspicious contract behavior
- **Compliance**: Track and audit contract activity for regulatory requirements  
- **Analytics**: Build dashboards using the indexed event data
- **Integration**: Receive real-time alerts in your existing systems via webhooks

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Stellar network access (testnet or mainnet)

### Installation

1. **Clone and install**
```bash
git clone https://github.com/whiteghost0001/stellar-guardian.git
cd stellar-guardian
npm install
```

2. **Configure your environment**
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```bash
# Your PostgreSQL database
DATABASE_URL="postgresql://user:password@localhost:5432/stellar_guardian"

# Which Stellar network to monitor
STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"  # or mainnet
SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"     # or mainnet

# Alert thresholds (adjust as needed)
WHALE_TRANSFER_XLM_THRESHOLD=1000000  # Alert on transfers > 1M XLM
```

3. **Setup database**
```bash
npm run db:push
```

4. **Start monitoring**
```bash
npm run dev
```

The system will start monitoring the Stellar network and the API will be available at `http://localhost:3000`

## How it works

```
Stellar Network → Ingestor → Detectors → Alerts → Your Systems
     ↓              ↓          ↓         ↓
   Events      Index to DB   Analysis  Webhooks/API
```

1. **Ingestor**: Connects to Stellar Horizon API and Soroban RPC to stream contract events
2. **Detectors**: Analyze each event for suspicious patterns (large transfers, failures, etc.)
3. **Alerts**: Send notifications via webhooks when detectors trigger
4. **API**: Query historical events and alerts via REST endpoints

## Built-in Detectors

The system comes with several pre-built detectors:

### 🐋 Whale Transfer Detector
**What it does**: Alerts on unusually large token transfers
**Why it matters**: Large transfers often indicate major market movements or potential security issues
**Configuration**:
```bash
WHALE_TRANSFER_XLM_THRESHOLD=1000000    # Alert on XLM transfers > 1M
WHALE_TRANSFER_USDC_THRESHOLD=100000    # Alert on USDC transfers > 100K
```

### ❌ Failed Transaction Detector  
**What it does**: Monitors failed contract calls and transactions
**Why it matters**: High failure rates can indicate contract bugs, attacks, or network issues
**Configuration**:
```bash
FAILED_TX_CONSECUTIVE_THRESHOLD=3       # Alert after 3 consecutive failures
```

## API Endpoints

Once running, you can query the system:

```bash
# Get recent alerts
curl http://localhost:3000/api/alerts

# Get contract events
curl http://localhost:3000/api/events

# Get events for specific contract
curl http://localhost:3000/api/events?contractId=CXXX...

# Add a contract to monitor
curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{"contractId": "CXXX...", "name": "My Contract"}'
```

## Webhook Alerts

Get real-time notifications by registering webhook endpoints:

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "alertTypes": ["whale_transfer", "failed_transaction"]
  }'
```

When alerts trigger, you'll receive HTTP POST requests like:
```json
{
  "alertId": "alert-123",
  "severity": "HIGH", 
  "alertType": "whale_transfer",
  "title": "Large Transfer Detected",
  "description": "1M XLM transfer detected",
  "contractId": "CXXX...",
  "timestamp": "2024-01-01T00:00:00Z",
  "metadata": {
    "amount": 1000000,
    "asset": "XLM",
    "from": "GXXX...",
    "to": "GYYY..."
  }
}
```

## Docker Setup

For production or easier development:

```bash
# Start everything (PostgreSQL, Redis, monitoring)
docker-compose up -d

# View logs
docker-compose logs -f stellar-guardian
```

## Project Structure

```
stellar-guardian/
├── src/
│   ├── core/           # Business logic, types, risk scoring
│   ├── detectors/      # Built-in detection algorithms  
│   ├── ingestor/       # Stellar blockchain data ingestion
│   ├── alerts/         # Webhook notification system
│   ├── dashboard/      # REST API endpoints
│   ├── plugins/        # Plugin system for custom detectors
│   └── schema/         # Database schema (Prisma)
├── plugins/            # Community/custom detector plugins
├── tests/              # Test suites
└── config/             # Configuration files
```

## Custom Detectors (Plugin System)

You can create custom detectors for your specific use cases:

### Creating a Custom Detector

1. **Create detector file** in `plugins/my-detector/`:

```javascript
// plugins/my-detector/my-detector.js
const { BaseDetector } = require('../../src/core/detector.interface');

class MyDetector extends BaseDetector {
  async detect(event) {
    // Your custom logic here
    if (event.eventData.amount > 50000) {
      return {
        isMatch: true,
        severity: 'MEDIUM',
        title: 'Custom Alert',
        description: `Detected ${event.eventData.amount} transfer`,
        metadata: { contractId: event.contractId }
      };
    }
    return null;
  }
  
  getName() { return 'My Custom Detector'; }
  getDescription() { return 'Detects my specific use case'; }
  getVersion() { return '1.0.0'; }
}

module.exports = MyDetector;
```

2. **Create manifest file**:

```json
// plugins/my-detector/manifest.json
{
  "name": "my-detector",
  "version": "1.0.0", 
  "description": "My custom detector",
  "author": "Your Name",
  "detectors": [{
    "id": "my-detector",
    "name": "My Custom Detector",
    "enabled": true,
    "parameters": {
      "threshold": 50000
    }
  }]
}
```

3. **Restart the system** - plugins are loaded automatically

## Common Use Cases

### DeFi Protocol Monitoring
- Monitor DEX contract for large swaps
- Alert on liquidity pool changes
- Track governance proposal activity

### Security Monitoring  
- Detect unusual contract interaction patterns
- Monitor for potential exploit attempts
- Track admin function calls

### Compliance & Auditing
- Log all contract interactions for audit trails
- Monitor specific accounts or contracts
- Generate compliance reports

### Business Intelligence
- Track user adoption metrics
- Monitor transaction volumes
- Analyze contract usage patterns

## Troubleshooting

### Common Issues

**"Failed to connect to database"**
- Check your `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Run `npm run db:push` to create tables

**"No events being processed"**  
- Verify `STELLAR_HORIZON_URL` and `SOROBAN_RPC_URL` are correct
- Check network connectivity
- Ensure you're monitoring the right network (testnet vs mainnet)

**"Webhooks not working"**
- Verify webhook URL is accessible from the internet
- Check webhook endpoint logs for errors
- Test with a service like webhook.site first

### Getting Help

- Check the logs: `docker-compose logs stellar-guardian`
- Review configuration in `.env` file
- Test API endpoints manually with curl
- Check database connectivity: `npm run db:studio`

## Development

```bash
npm run dev     # start dev server with hot reload
npm test        # run test suite
npm run lint    # check code style
npm run build   # build for production
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Adding new detectors
- Improving existing functionality  
- Reporting bugs and requesting features
- Code style and testing requirements

## License

MIT - see [LICENSE](LICENSE) file for details.