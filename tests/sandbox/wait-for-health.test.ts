import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sandbox } from '../../src'

function createSandboxForHealthTest(): Sandbox {
  return new Sandbox({
    sandboxId: 'sbx-health-test',
    sandboxDomain: 'health-test.scalebox.dev',
    envdAccessToken: 'test-token',
  })
}

describe('Sandbox.waitForHealth', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('retries on non-2xx responses using retryInterval until timeout', async () => {
    vi.useFakeTimers()
    const sandbox = createSandboxForHealthTest()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('not ready', { status: 503 }))

    const healthPromise = sandbox.waitForHealth({
      timeout: 500,
      retryInterval: 200,
    })
    const rejectionAssertion = expect(healthPromise).rejects.toThrow(
      'Health check timeout'
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(199)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(400)
    await rejectionAssertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries on fetch errors using retryInterval until timeout', async () => {
    vi.useFakeTimers()
    const sandbox = createSandboxForHealthTest()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'))

    const healthPromise = sandbox.waitForHealth({
      timeout: 500,
      retryInterval: 200,
    })
    const rejectionAssertion = expect(healthPromise).rejects.toThrow(
      'Health check timeout'
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(200)
    await rejectionAssertion
  })

  it('returns immediately when health endpoint responds with 2xx', async () => {
    const sandbox = createSandboxForHealthTest()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    await expect(
      sandbox.waitForHealth({ timeout: 500, retryInterval: 200 })
    ).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('succeeds after transient 503 responses within timeout', async () => {
    vi.useFakeTimers()
    const sandbox = createSandboxForHealthTest()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('not ready', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const healthPromise = sandbox.waitForHealth({
      timeout: 500,
      retryInterval: 200,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(199)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(healthPromise).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
