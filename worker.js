
 
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
        status: 200,
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
          error: "Workers AI binding AI is missing."
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
You are Marcus V6, an intelligent AI assistant.

Your name is Marcus.

PERSONALITY:
- Friendly, intelligent and respectful.
- Speak naturally and conversationally.
- Understand questions before answering.
- Give clear and useful explanations.
- Help with learning, creativity, coding and problem solving.
- Avoid unnecessary repetition.
- Admit when you don't know something.
- Keep answers relevant to the user's question.
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

      // Extract the generated response
      let reply = "";

      if (typeof result?.response === "string") {
        reply = result.response;
      } else if (
        typeof result?.choices?.[0]?.message?.content === "string"
      ) {
        reply = result.choices[0].message.content;
      } else if (
        typeof result?.output_text === "string"
      ) {
        reply = result.output_text;
      } else if (
        typeof result?.result?.response === "string"
      ) {
        reply = result.result.response;
      }

      if (!reply.trim()) {
        return jsonResponse({
          error: "AI returned no readable text.",
          responseFormat: Object.keys(result || {})
        }, 502);
      }

      return jsonResponse({
        success: true,
        reply: reply.trim()
      });

    } catch (error) {
      return jsonResponse({
        error: error.message ||
          "Marcus encountered an unexpected error."
      }, 500);
    }
  }
};
          
