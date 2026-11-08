export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method === "GET") {
      return new Response("Marcus V6 is online.", {
        headers: corsHeaders
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({
        error: "Method not allowed."
      }, 405);
    }

    try {
      if (!env.AI) {
        return jsonResponse({
          error: "Workers AI binding is missing. Check your AI binding."
        }, 500);
      }

      const body = await request.json();
      const message = body.message;

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return jsonResponse({
          error: "Please enter a message."
        }, 400);
      }

      if (message.length > 10000) {
        return jsonResponse({
          error: "Message is too long."
        }, 413);
      }

      const result = await env.AI.run(
        "@cf/google/gemma-4-26b-a4b-it",
        {
          messages: [
            {
              role: "system",
              content: `
You are Marcus V6, a helpful AI assistant.

Your name is Marcus.

Be intelligent, friendly, clear and helpful.
Understand the user's messages.
Respond naturally and conversationally.
Give useful explanations and practical assistance.
Keep answers easy to understand.
`
            },
            {
              role: "user",
              content: message
            }
          ],
          chat_template_kwargs: {
            enable_thinking: false
          }
        }
      );

      const reply = result?.response;

      if (!reply) {
        return jsonResponse({
          error: "Marcus received no response. Please try again."
        }, 502);
      }

      return jsonResponse({
        success: true,
        reply: reply
      });

    } catch (error) {
      return jsonResponse({
        error: error.message ||
          "Marcus encountered an unexpected error."
      }, 500);
    }
  }
};
          
