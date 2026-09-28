/**
 * Thin wrapper around the official Composio SDK.
 *
 * Phase 1 does NOT install or call Composio. This class exists so the
 * integration is introduced later in one place: the API key is read from the
 * server-side environment and is never returned to the browser.
 *
 * Phase 5 will construct the real Composio client here.
 */
export interface ComposioConfig {
  apiKey: string;
  /** Optional: a specific connected account id for the YouTube toolkit. */
  connectedAccountId?: string;
}

export class ComposioNotConfiguredError extends Error {
  constructor() {
    super('Composio is not configured. Set COMPOSIO_API_KEY in your local .env file.');
    this.name = 'ComposioNotConfiguredError';
  }
}

export class ComposioClient {
  private readonly apiKey: string | undefined;
  private readonly connectedAccountId: string | undefined;

  constructor(config: Partial<ComposioConfig> = {}) {
    this.apiKey = config.apiKey ?? process.env.COMPOSIO_API_KEY;
    this.connectedAccountId = config.connectedAccountId ?? process.env.COMPOSIO_YOUTUBE_CONNECTED_ACCOUNT_ID;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  /** Throws rather than silently continuing with a missing key. */
  requireApiKey(): string {
    if (!this.isConfigured()) throw new ComposioNotConfiguredError();
    return this.apiKey as string;
  }

  getConnectedAccountId(): string | undefined {
    return this.connectedAccountId;
  }
}
