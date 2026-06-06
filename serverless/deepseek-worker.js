export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }
    if (request.method !== "POST") {
      return corsResponse({ error: "POST only" }, 405);
    }
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return corsResponse({ error: "DEEPSEEK_API_KEY is not configured" }, 500);
    }
    const body = await request.json();
    const context = typeof body.context === "string" ? body.context : JSON.stringify(body.context || {});
    const message = body.message || "";
    const model = body.model || "deepseek-chat";

    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are the Shanghai OptAgent five-agent assistant. Answer only from the supplied platform context. Be concise, quantitative, and explicit when the selected grid is an opportunity grid rather than an optimized selected grid."
          },
          {
            role: "user",
            content: `${context}\n\nUser question: ${message}`
          }
        ],
        temperature: 0.2
      })
    });
    const json = await upstream.json();
    if (!upstream.ok) {
      return corsResponse({ error: json }, upstream.status);
    }
    return corsResponse({
      answer: json.choices?.[0]?.message?.content || "DeepSeek returned no readable answer."
    });
  }
};

function corsResponse(payload, status = 200) {
  return new Response(payload ? JSON.stringify(payload) : null, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
