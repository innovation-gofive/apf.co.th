import type { APIRoute } from "astro";

export const prerender = false;

const requiredFields = {
  inquiry: ["name", "email", "phone", "subject", "message"],
  demo: ["name", "email", "phone", "date", "time", "appointmentType", "message"],
} as const;

export const POST: APIRoute = async ({ request }) => {
  const endpoint = new URL("/wp-json/apf/v1/contact", import.meta.env.PUBLIC_WORDPRESS_API || "https://cms.apf.co.th");
  const secret = import.meta.env.WP_CONTACT_SECRET;

  if (!secret) {
    console.error("WP_CONTACT_SECRET is not configured.");
    return new Response(JSON.stringify({ message: "Contact service is unavailable" }), { status: 503 });
  }

  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid request" }), { status: 400 });
  }

  const formType = data.formType;
  if ((formType !== "inquiry" && formType !== "demo") || data.privacy !== "on" || !requiredFields[formType].every((field) => typeof data[field] === "string" && data[field].trim())) {
    return new Response(JSON.stringify({ message: "Invalid form data" }), { status: 400 });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-APF-Contact-Key": secret,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.error(`WordPress contact endpoint returned ${response.status}.`);
      return new Response(JSON.stringify({ message: "Unable to send message" }), { status: 502 });
    }
  } catch (error) {
    console.error("WordPress contact endpoint request failed.", error);
    return new Response(JSON.stringify({ message: "Unable to send message" }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
