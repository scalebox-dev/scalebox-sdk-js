# Locality Matrix Test (16 Cases)

This test verifies the **public locality behavior contract** of the SDK against real API responses.

File: `tests/sandbox/locality-matrix.test.ts`

## What it covers

The matrix includes 16 create-sandbox cases:

- No locality / empty locality
- `autoDetect` variants
- `force` variants
- Valid region (best-effort and force)
- No-capacity region (best-effort success + force failure)
- Invalid region failures

Expected contract:

- Best-effort (`force: false`, default) can fall back to other available regions.
- Hard constraint (`force: true`) fails when the requested region cannot be scheduled.
- Invalid region returns validation error.

## How to run

```bash
SCALEBOX_API_KEY=your_key \
SCALEBOX_API_URL=https://api.scalebox.dev \
VITEST_SERIAL=1 \
pnpm vitest run tests/sandbox/locality-matrix.test.ts
```

## How to read the result

- `16 passed` means the SDK locality contract is working as expected.
- Any failed case indicates a behavior regression or backend contract change.

## Scope and limitation

This SDK-side matrix validates **observable API behavior** only.  
`createSandbox` responses do not expose `clusterId`, so this test does not assert physical cluster placement directly.

If you need cluster-level placement verification, use backend diagnostics/E2E workflows with privileged observability.
