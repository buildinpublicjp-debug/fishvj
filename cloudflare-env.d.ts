/// <reference types="@cloudflare/workers-types" />

type FishVJImageBinding = {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: {
        format: string;
        quality: number;
      }): Promise<{ response(): Response }>;
    };
  };
};

declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB?: D1Database;
    IMAGES: FishVJImageBinding;
  }
}
