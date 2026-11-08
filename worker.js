
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    if (request.method === "GET") {
      return new Response("Marcus V7 is online.", {
        headers: cors
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    try {
      if (!env.AI) {
        return json({ error: "AI binding is missing." }, 500);
      }

      if (!env.MARCUS_MEMORY) {
        return json({ error: "MARCUS_MEMORY binding is missing." }, 500);
      }

      const body = await request.json();
      const message = body.message;
      const userId = body.userId;

      if (typeof message !== "string" || !message.trim()) {
        return json({ error: "Please enter a message." }, 400);
      }

      if (message.length > 10000) {
        return json({ error: "Message is too long." }, 413);
      }

      if (
        typeof userId !== "string" ||
        !/^[a-zA-Z0-9_-]{16,80}$/.test(userId)
      ) {
        return json({ error: "Invalid user ID. Refresh the website." }, 400);
      }

      const memoryKey = `user:${userId}`;

      let memories = [];

      const saved = await env.MARCUS_MEMORY.get(memoryKey);

      if (saved) {
        try {
          memories = JSON.parse(saved);
          if (!Array.isArray(memories)) memories = [];
        } catch {
          memories = [];
        }
      }

      const cleanMessage = message.trim();

      // SAVE MEMORY
      const rememberMatch = cleanMessage.match(
        /^remember(?: that)?\s+(.+)$/i
      );

      if (rememberMatch) {
        const fact = rememberMatch[1].trim();

        if (fact.length > 500) {
          return json({
            success: false,
            reply: "That memory is too long. Please shorten it."
          });
        }

        const exists = memories.some(
          item => item.toLowerCase() === fact.toLowerCase()
        );

        if (!exists) {
          memories.push(fact);
        }

        memories = memories.slice(-50);

        await env.MARCUS_MEMORY.put(
          memoryKey,
          JSON.stringify(memories)
        );

        return json({
          success: true,
          reply: `I've saved this to your memory: "${fact}". I'll use it in future conversations.`
        });
      }

      // FORGET ALL MEMORIES
      if (/^forget everything$/i.test(cleanMessage)) {
        await env.MARCUS_MEMORY.delete(memoryKey);

        return json({
          success: true,
          reply: "I've cleared the memories saved for this browser ID."
        });
      }

      // FORGET A SPECIFIC MEMORY
      const forgetMatch = cleanMessage.match(
        /^forget(?: that)?\s+(.+)$/i
      );

      if (forgetMatch) {
        const target = forgetMatch[1].trim().toLowerCase();

        const before = memories.length;

        memories = memories.filter(
          item => !item.toLowerCase().includes(target)
        );

        await env.MARCUS_MEMORY.put(
          memoryKey,
          JSON.stringify(memories)
        );

        return json({
          success: true,
          reply: before === memories.length
            ? "I couldn't find that memory."
            : "I've removed the matching memory."
        });
      }

      const memoryText = memories.length
        ? memories.map((item, i) => `${i + 1}. ${item}`).join("\n")
        : "No saved memories yet.";

      const result = await env.AI.run(
        "@cf/google/gemma-4-26b-a4b-it",
        {
          messages: [
            {
              role: "system",
              content: `
You are Marcus V7, a helpful personal AI assistant developed by CJ.

PERSONALITY:
- Friendly, intelligent and respectful.
- Speak naturally.
- Give clear and useful answers.
- Help with coding, learning, creativity and problem solving.
- Admit when you don't know something.

SAVED USER MEMORIES:
${memoryText}

Use these memories when relevant.
Do not claim to have saved a new memory unless the memory system confirms it.
Do not invent memories.
`
            },
            {
              role: "user",
              content: cleanMessage
            }
          ],
          chat_template_kwargs: {
            enable_thinking: false
          }
        }
      );

      let reply = "";

      if (typeof result === "string") {
        reply = result;
      } else if (typeof result?.response === "string") {
        reply = result.response;
      } else if (
        typeof result?.choices?.[0]?.message?.content === "string"
      ) {
        reply = result.choices[0].message.content;
      } else if (typeof result?.output_text === "string") {
        reply = result.output_text;
      }

      if (!reply.trim()) {
        return json({
          error: "AI returned no readable text.",
          responseFormat: Object.keys(result || {})
        }, 502);
      }

      return json({
        success: true,
        reply: reply.trim()
      });

    } catch (error) {
      return json({
        error: error.message || "Marcus encountered an error."
      }, 500);
    }
  }
};
                          
 
