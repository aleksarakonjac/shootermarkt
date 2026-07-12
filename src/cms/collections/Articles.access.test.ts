// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import { getPayload, type Payload } from "payload";

const testDatabaseUrl = process.env.CMS_TEST_DATABASE_URL;
const describeIntegration = testDatabaseUrl ? describe : describe.skip;

let payload: Payload;
let adminUserId: number;
let authorUserId: number;
let mediaId: number;

beforeAll(async () => {
  if (!testDatabaseUrl) return;

  process.env.DATABASE_URL = testDatabaseUrl;
  const { default: config } = await import("../../../payload.config");
  payload = await getPayload({ config });

  const admin = await payload.create({
    collection: "cms-users",
    data: {
      email: "test-admin@shootermarkt.test",
      password: "test-password-123",
      role: "admin",
      name: "Test Admin",
    },
  });
  adminUserId = admin.id as unknown as number;

  const author = await payload.create({
    collection: "cms-users",
    data: {
      email: "test-author@shootermarkt.test",
      password: "test-password-123",
      role: "author",
      name: "Test Author",
    },
  });
  authorUserId = author.id as unknown as number;

  const media = await payload.create({
    collection: "media",
    data: { alt: "test image" },
    filePath: path.resolve(__dirname, "../__fixtures__/test-image.png"),
  });
  mediaId = media.id as unknown as number;
}, 30000);

afterAll(async () => {
  if (!payload) return;

  if (adminUserId) await payload.delete({ collection: "cms-users", id: adminUserId });
  if (authorUserId) await payload.delete({ collection: "cms-users", id: authorUserId });
  if (mediaId) await payload.delete({ collection: "media", id: mediaId });
});

describeIntegration("Articles access control (integration; CMS_TEST_DATABASE_URL required)", () => {
  it("author cannot set status to published", async () => {
    const article = await payload.create({
      collection: "articles",
      data: {
        title: "Test Article",
        slug: "test-article-access",
        excerpt: "Test excerpt",
        content: {
          root: {
            type: "root",
            format: "",
            indent: 0,
            version: 1,
            direction: null,
            children: [
              {
                type: "paragraph",
                format: "",
                indent: 0,
                version: 1,
                direction: null,
                children: [
                  {
                    type: "text",
                    format: 0,
                    detail: 0,
                    mode: "normal",
                    style: "",
                    text: "Test content",
                    version: 1,
                  },
                ],
              },
            ],
          },
        },
        coverImage: mediaId,
        author: authorUserId,
        status: "draft",
      },
      user: { id: authorUserId, collection: "cms-users", role: "author" } as never,
      overrideAccess: false,
    });

    const updated = await payload.update({
      collection: "articles",
      id: article.id,
      data: { status: "published" },
      user: { id: authorUserId, collection: "cms-users", role: "author" } as never,
      overrideAccess: false,
    });

    expect(updated.status).not.toBe("published");

    await payload.delete({ collection: "articles", id: article.id });
  });

  it("admin can set status to published", async () => {
    const article = await payload.create({
      collection: "articles",
      data: {
        title: "Test Article 2",
        slug: "test-article-access-2",
        excerpt: "Test excerpt",
        content: {
          root: {
            type: "root",
            format: "",
            indent: 0,
            version: 1,
            direction: null,
            children: [
              {
                type: "paragraph",
                format: "",
                indent: 0,
                version: 1,
                direction: null,
                children: [
                  {
                    type: "text",
                    format: 0,
                    detail: 0,
                    mode: "normal",
                    style: "",
                    text: "Test content",
                    version: 1,
                  },
                ],
              },
            ],
          },
        },
        coverImage: mediaId,
        author: authorUserId,
        status: "draft",
      },
      user: { id: adminUserId, collection: "cms-users", role: "admin" } as never,
      overrideAccess: false,
    });

    const updated = await payload.update({
      collection: "articles",
      id: article.id,
      data: { status: "published" },
      user: { id: adminUserId, collection: "cms-users", role: "admin" } as never,
      overrideAccess: false,
    });

    expect(updated.status).toBe("published");

    await payload.delete({ collection: "articles", id: article.id });
  });

  it("draft articles are invisible to public reads, published articles are visible", async () => {
    const { getPublishedArticles } = await import("@/lib/cms/get-articles");

    const draft = await payload.create({
      collection: "articles",
      data: {
        title: "Draft Visibility Test",
        slug: "draft-visibility-test",
        excerpt: "Test excerpt",
        content: {
          root: {
            type: "root",
            format: "",
            indent: 0,
            version: 1,
            direction: null,
            children: [
              {
                type: "paragraph",
                format: "",
                indent: 0,
                version: 1,
                direction: null,
                children: [
                  {
                    type: "text",
                    format: 0,
                    detail: 0,
                    mode: "normal",
                    style: "",
                    text: "Test content",
                    version: 1,
                  },
                ],
              },
            ],
          },
        },
        coverImage: mediaId,
        author: authorUserId,
        status: "draft",
      },
      user: { id: adminUserId, collection: "cms-users", role: "admin" } as never,
      overrideAccess: false,
    });

    let publicSlugs = (await getPublishedArticles()).map((a) => a.slug);
    expect(publicSlugs).not.toContain("draft-visibility-test");

    await payload.update({
      collection: "articles",
      id: draft.id,
      data: { status: "published" },
      user: { id: adminUserId, collection: "cms-users", role: "admin" } as never,
      overrideAccess: false,
    });

    publicSlugs = (await getPublishedArticles()).map((a) => a.slug);
    expect(publicSlugs).toContain("draft-visibility-test");

    await payload.delete({ collection: "articles", id: draft.id });
  });
});
