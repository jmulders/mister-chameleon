/**
 * Mock Storyblok Client
 *
 * A testable StoryblokClient subclass that serves stories from an in-memory
 * slug map instead of making HTTP requests to the Storyblok CDN API.
 *
 * Usage:
 *   import { heroVariantSlug } from '@/cms/queries/storyblok';
 *
 *   const client = new MockStoryblokClient({
 *     [heroVariantSlug('hero_test')]: STORYBLOK_HERO_STORY,
 *   });
 *   const provider = new StoryblokProvider(client);
 */

import { StoryblokClient, type StoryblokStory } from '@/cms/providers/storyblok-client';

export class MockStoryblokClient extends StoryblokClient {
  private readonly slugMap: Record<string, StoryblokStory<unknown>>;

  /**
   * @param slugMap  A map of full story slug → StoryblokStory envelope.
   *                 Slugs not present in the map return null, simulating a
   *                 Storyblok CDN 404 (story not found or not published).
   */
  constructor(slugMap: Record<string, StoryblokStory<unknown>>) {
    // The parent constructor arguments are never used — fetchStory is fully
    // overridden. We pass placeholder values to satisfy the constructor signature.
    super('mock-token', 'https://mock.storyblok.test/v2/cdn', 'published');
    this.slugMap = slugMap;
  }

  override async fetchStory<TContent>(
    slug: string,
  ): Promise<StoryblokStory<TContent> | null> {
    return (this.slugMap[slug] as StoryblokStory<TContent>) ?? null;
  }
}
