
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

    // Allow browser preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Check worker status
    if (request.method === "GET") {
      return new Response("Marcus V6 is online.", {
        status: 200,
        headers: corsHeaders
      });
    }

    // Only accept POST requests for chat
    if (request.method !== "POST") {
      return jsonResponse({
        error: "Method not allowed."
      }, 405);
    }

    try {
      // Check API key
      if (!env.OPENAI_API_KEY) {
        return jsonResponse({
          error: "Missing API key. Add OPENAI_API_KEY to Cloudflare secrets."
        }, 500);
      }

      // Read incoming message
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

      // Connect to OpenAI Responses API
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            instructions: `
You are Marcus V6, a helpful AI assistant.

Your name is Marcus.
Be intelligent, friendly, clear and helpful.
Understand the user's messages and respond naturally.
Give useful explanations and practical assistance.
Keep answers easy to understand.
`,
            input: message,
            max_output_tokens: 1200
          })
        }
      );

      // Read OpenAI response
      const data = await openaiResponse.json();

      // Handle API errors
      if (!openaiResponse.ok) {
        return jsonResponse({
          error: data.error?.message || "OpenAI API request failed.",
          status: openaiResponse.status
        }, 502);
      }

      // Extract Marcus's answer
      const reply = (data.output || [])
        .flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("\n");

      if (!reply) {
        return jsonResponse({
          error: "Marcus received no text response. Please try again."
        }, 502);
      }

      // Send answer back to website
      return jsonResponse({
        success: true,
        reply: reply
      });

    } catch (error) {
      return jsonResponse({
        error: error.message || "Marcus encountered an unexpected error."
      }, 500);
    }
  }
};
      
