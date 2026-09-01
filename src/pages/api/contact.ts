import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const wordpressContactUrl =
  env.WORDPRESS_CONTACT_URL || "https://www.apf.co.th/wp-json/apf/v1/contact";
const contactSecret = env.WP_CONTACT_SECRET;

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!contactSecret || contactSecret === "replace-with-a-long-random-secret") {
      console.error("WordPress contact endpoint is not configured.");
      return new Response(null, { status: 503 });
    }

    const response = await fetch(wordpressContactUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-APF-Contact-Key": contactSecret,
      },
      body: await request.text(),
    });

    if (!response.ok) {
      console.error(`WordPress contact endpoint failed with ${response.status}.`);
    }

    return new Response(response.ok ? JSON.stringify({ ok: true }) : null, {
      status: response.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Contact form submission failed:", error);
    return new Response(null, { status: 500 });
  }
};
