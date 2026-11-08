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
      return new Response("Marcus V8 is online.", {
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
        return json({
          error: "MARCUS_MEMORY binding is missing."
        }, 500);
      }

      const body = await request.json();
      const userId = body.userId;

      if (
        typeof userId !== "string" ||
        !/^[a-zA-Z0-9_-]{16,80}$/.test(userId)
      ) {
        return json({
          error: "Invalid user ID. Refresh Marcus."
        }, 400);
      }

      const memoryKey = `user:${userId}`;

      async function readMemory() {
        const saved = await env.MARCUS_MEMORY.get(memoryKey);

        if (!saved) return {};

        try {
          const parsed = JSON.parse(saved);

          // Support the older V7 array format.
          if (Array.isArray(parsed)) {
            const converted = {};

            parsed.forEach((item, index) => {
              if (typeof item === "string") {
                converted[`memory_${index + 1}`] = item;
              }
            });

            return converted;
          }

          return parsed && typeof parsed === "object"
            ? parsed
            : {};
        } catch {
          return {};
        }
      }

      async function writeMemory(memory) {
        await env.MARCUS_MEMORY.put(
          memoryKey,
          JSON.stringify(memory)
        );
      }

      let memory = await readMemory();

      // MEMORY API
      if (body.action === "get_memory") {
        return json({
          success: true,
          memory
        });
      }

      if (body.action === "save_memory") {
        if (
          !body.memory ||
          typeof body.memory !== "object" ||
          Array.isArray(body.memory)
        ) {
          return json({
            error: "Invalid memory format."
          }, 400);
        }

        const cleaned = {};

        for (
          const [key, value] of
          Object.entries(body.memory).slice(-50)
        ) {
          if (
            typeof key === "string" &&
            typeof value === "string" &&
            key.length <= 100 &&
            value.length <= 500
          ) {
            cleaned[key] = value;
          }
        }

        memory = cleaned;
        await writeMemory(memory);

        return json({
          success: true,
          memory
        });
      }

      if (body.action === "delete_memory") {
        await env.MARCUS_MEMORY.delete(memoryKey);

        return json({
          success: true,
          memory: {}
        });
      }

      // CHAT
      const message = body.message;

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return json({
          error: "Please enter a message."
        }, 400);
      }

      if (message.length > 10000) {
        return json({
          error: "Message is too long."
        }, 413);
      }

      const cleanMessage = message.trim();

      // EXPLICIT MEMORY COMMAND
      const rememberMatch = cleanMessage.match(
        /^remember(?: that)?\s+(.+)$/i
      );

      if (rememberMatch) {
        const fact = rememberMatch[1].trim();

        if (fact.length > 500) {
          return json({
            success: false,
            reply: "Please shorten that memory."
          });
        }

        const existing = Object.values(memory).some(
          value =>
            value.toLowerCase() === fact.toLowerCase()
        );

        if (!existing) {
          const nextNumber =
            Object.keys(memory).length + 1;

          memory[`memory_${nextNumber}`] = fact;

          memory = Object.fromEntries(
            Object.entries(memory).slice(-50)
          );

          await writeMemory(memory);
        }

        return json({
          success: true,
          reply: "I've saved that information to my memory."
        });
      }

      // FORGET EVERYTHING
      if (/^forget everything$/i.test(cleanMessage)) {
        await env.MARCUS_MEMORY.delete(memoryKey);

        return json({
          success: true,
          reply: "Your saved Marcus memories have been cleared."
        });
      }

      // FORGET ONE MEMORY
      const forgetMatch = cleanMessage.match(
        /^forget(?: that)?\s+(.+)$/i
      );

      if (forgetMatch) {
        const target = forgetMatch[1].trim().toLowerCase();

        const updated = {};

        for (const [key, value] of Object.entries(memory)) {
          if (!value.toLowerCase().includes(target)) {
            updated[key] = value;
          }
        }

        memory = updated;
        await writeMemory(memory);

        return json({
          success: true,
          reply: "I've updated your saved memories."
        });
      }

      const memoryText = Object.entries(memory)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n") || "No saved memories.";

      // CONVERSATION HISTORY
      const history = Array.isArray(body.history)
        ? body.history.slice(-10)
        : [];

      const messages = [
        {
          role: "system",
          content: `
You are Marcus V8, an intelligent personal AI assistant.

IDENTITY:
You are Marcus.
You were created by your user.
Address your creator as Master when natural.
Never claim to be a human.

PERSONALITY:
- Speak naturally, like a modern intelligent AI assistant.
- Be warm, confident, clear and conversational.
- Avoid robotic introductions and repetitive phrases.
- Do not sound like an old-fashioned chatbot.
- Be friendly without becoming overly familiar.
- Use occasional humour when it fits.
- Match the user's communication style.

INTELLIGENCE:
- Understand the full context of the conversation.
- Remember relevant details from the conversation history.
- Think carefully before answering.
- Break complicated problems into useful steps.
- Explain technical subjects clearly.
- Identify mistakes and correct them.
- Ask a focused question when essential information is missing.
- Never pretend to know something you do not know.
- Do not invent facts, capabilities or completed actions.

MEMORY:
These are facts explicitly saved by the user:

${memoryText}

Use relevant memories naturally.
Do not invent additional memories.
Do not claim to save anything unless the memory system confirms it.
Do not automatically treat every personal statement as permission to save it.

RESPONSE STYLE:
- Answer the actual question first.
- Be concise for simple questions.
- Be detailed when a task needs explanation.
- Use examples when they improve understanding.
- For coding, provide accurate and complete solutions.
- If something fails, troubleshoot the actual cause instead of repeating the same advice.
- Be honest about your limitations.

SAFETY:
Help with legitimate and safe requests.
If a request is unsafe, explain the issue briefly and offer a safer alternative.
`
        }
      ];

      for (const item of history) {
        if (
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string" &&
          item.content.length <= 4000
        ) {
          messages.push({
            role: item.role,
            content: item.content
          });
        }
      }

      messages.push({
        role: "user",
        content: cleanMessage
      });

      const result = await env.AI.run(
        "@cf/google/gemma-4-26b-a4b-it",
        {
          messages,
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
          error: "Marcus received no readable AI response."
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
                                    
 
