# Contributing

## Development

```bash
git clone https://github.com/your-org/stellar-guardian.git
cd stellar-guardian
npm install
cp .env.example .env
# edit .env with your settings
npm run db:push
npm run dev
```

## Adding Detectors

Create a new detector by extending `BaseDetector`:

```typescript
export class MyDetector extends BaseDetector {
  async detect(event: StellarEvent): Promise<DetectionResult | null> {
    // your logic here
    if (shouldAlert) {
      return {
        isMatch: true,
        severity: 'MEDIUM',
        title: 'My Alert',
        description: 'Something happened',
        metadata: {}
      };
    }
    return null;
  }
}
```

## Plugin Development

Plugins go in the `plugins/` directory. Each plugin needs:
- `manifest.json` with metadata
- Main detector file implementing the detection logic

See `plugins/example-detector/` for a working example.

## Testing

```bash
npm test              # run all tests
npm run test:watch    # watch mode
```

## Code Style

We use ESLint and Prettier. Run `npm run lint` to check.

## Pull Requests

- Fork the repo
- Create a feature branch
- Make your changes
- Add tests if needed
- Submit PR

Keep PRs focused on a single change when possible.