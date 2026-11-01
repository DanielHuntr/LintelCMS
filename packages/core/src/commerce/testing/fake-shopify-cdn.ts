import sharp from "sharp";

/**
 * Shopify's image server for the importer's tests: a `fetch` that serves photos from
 * memory and records every address asked for, so a test can check nothing else was fetched.
 *
 *   …/linen-shirt-front.jpg, …/linen-shirt-back.jpg   small PNG photos
 *   …/moved-tote.jpg                                    redirects off Shopify's servers
 *   …/huge-socks.jpg                                    says it is 30 MB
 */
export class FakeShopifyCdn {
  readonly requested: string[] = [];
  private readonly photos = new Map<string, Promise<Buffer>>();

  readonly fetch: typeof fetch = async (input) => {
    const address = String(input);
    this.requested.push(address);
    const url = new URL(address);
    const name = url.pathname.split("/").pop() ?? "";
    if (url.hostname !== "cdn.shopify.com") {
      return new Response("Not here", { status: 404 });
    }
    if (name === "moved-tote.jpg") {
      return new Response(null, {
        status: 301,
        headers: { location: "https://images.example.net/tote.jpg" },
      });
    }
    if (name === "huge-socks.jpg") {
      return new Response("tiny", {
        headers: { "content-type": "image/jpeg", "content-length": String(30 * 1024 * 1024) },
      });
    }
    if (name.startsWith("linen-shirt")) {
      return new Response(new Uint8Array(await this.photo(name)), {
        headers: { "content-type": "image/png" },
      });
    }
    return new Response("Not found", { status: 404 });
  };

  /** A different little picture for every name, so each is its own asset. */
  private photo(name: string): Promise<Buffer> {
    let photo = this.photos.get(name);
    if (!photo) {
      const shade = (this.photos.size * 70) % 255;
      photo = sharp({
        create: { width: 4, height: 4, channels: 3, background: { r: shade, g: 120, b: 200 } },
      })
        .png()
        .toBuffer();
      this.photos.set(name, photo);
    }
    return photo;
  }
}
