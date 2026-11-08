export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response("Marcus V6 is online", { headers: cors });
    }

    try {
      const { message } = await request.json();

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            input: message
          })
        }
      );

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      });

    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Marcus connection failed" }),
        { status: 500, headers: cors }
      );
    }
  }
};
