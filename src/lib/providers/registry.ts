import { Provider } from "./provider";

export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  register(provider: Provider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider with id '${provider.id}' is already registered.`);
    }
    this.providers.set(provider.id, provider);
  }

  get(id: string): Provider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider with id '${id}' not found. Please ensure it is registered.`);
    }
    return provider;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  list(): Provider[] {
    return Array.from(this.providers.values());
  }
}

// Export a singleton instance for standard use across the app
export const providerRegistry = new ProviderRegistry();
