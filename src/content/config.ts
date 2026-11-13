import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional().default(false),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    // home
    tagline: z.string().optional(),
    headline: z.string().optional(),
    subtitle: z.string().optional(),
    newsletter_heading: z.string().optional(),
    newsletter_description: z.string().optional(),
    // writing
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
    heading: z.string().optional(),
    // connect
    title: z.string().optional(),
    description: z.string().optional(),
    // now
    lastUpdated: z.string().optional(),
  }),
});

export const collections = { blog, pages };
