import React from "react";
import { MessageSquare } from "lucide-react";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHAT_ENDPOINTS = [
  { method: "GET", path: "/chat/models", desc: "List Luchii chat models (luchii-6-plus, luchii-6-mini, luchii-70b...). No auth." },
  { method: "POST", path: "/chat/send", desc: "Send a message. Streams the reply as Server-Sent Events. Body: message, model, conversation_id?" },
  { method: "GET", path: "/chat/conversations", desc: "List saved conversations for the caller." },
  { method: "GET", path: "/chat/conversations/{id}", desc: "Full conversation with every message." },
  { method: "DELETE", path: "/chat/conversations/{id}", desc: "Delete a conversation." },
  { method: "POST", path: "/chat/agents/tasks", desc: "Send a Luchii agent to work. Body: type (image | video | music), prompt, style?, duration?" },
  { method: "GET", path: "/chat/agents/tasks/{id}", desc: "Agent task status, result and live job progress." },
  { method: "POST", path: "/chat/agents/bundle", desc: "One idea becomes an image, a video and a song. Body: idea, image_model?, style?" },
  { method: "GET", path: "/chat/agents/bundle/{id}", desc: "Status of all three agent tasks in a bundle." },
];

const Code = ({ children }) => (
  <pre className="mt-3 rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs md:text-sm text-neutral-300 overflow-x-auto whitespace-pre">{children}</pre>
);

export const ChatDocs = () => (
  <section className="mt-16" data-testid="api-chat-docs">
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1 pr-3 py-1 text-xs text-neutral-300">
      <img src="/luchii-logo.png" alt="Luchii logo" className="w-5 h-5 rounded-full object-contain" /> Luchii Chat API
    </div>
    <h2 className="font-display font-bold tracking-tight text-2xl md:text-3xl mt-4 flex items-center gap-2">
      <MessageSquare className="w-6 h-6 text-[#00F0FF]" /> Connect Luchii Chat to your platform
    </h2>
    <p className="mt-3 text-neutral-400 text-sm md:text-base max-w-2xl">
      For Frasberg platforms such as frasberg.com, frasbergai.com and frasberg-ai.com. Authenticate with a signed-in user token
      (<code className="text-neutral-200">Authorization: Bearer &lt;jwt&gt;</code>) or a Frasberg platform key
      (<code className="text-neutral-200">X-Frasberg-Key: frb_live_...</code>). Keep platform keys on your server, never in a browser.
    </p>
    <div className="mt-4 text-xs text-neutral-500">Base URL: <code className="text-[#00F0FF]" data-testid="api-chat-base-url">{BASE}</code></div>

    <div className="mt-6 space-y-2.5">
      {CHAT_ENDPOINTS.map((e) => (
        <div key={e.method + e.path} data-testid={`api-chat-endpoint-${e.method.toLowerCase()}-${e.path.replace(/[^a-z]+/g, "-")}`}
          className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
          <div className="flex items-center gap-3 md:w-80 shrink-0">
            <span className="text-[10px] font-bold text-black bg-[#00F0FF] rounded px-2 py-0.5 w-14 text-center">{e.method}</span>
            <code className="text-sm text-white">{e.path}</code>
          </div>
          <div className="text-sm text-neutral-400">{e.desc}</div>
        </div>
      ))}
    </div>

    <h3 className="mt-8 text-sm font-semibold text-neutral-200">Stream a reply</h3>
    <Code>{`curl -N -X POST ${BASE}/chat/send \\
  -H "X-Frasberg-Key: $FRASBERG_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Write a tagline for a sci-fi short","model":"luchii-6-plus"}'

data: {"conversation_id": "c0ffee...", "model": "luchii-6-plus"}
data: {"delta": "Beyond "}
data: {"delta": "the stars..."}
data: {"done": true, "error": null, "conversation_id": "c0ffee..."}`}</Code>

    <h3 className="mt-6 text-sm font-semibold text-neutral-200">Read the stream in JavaScript</h3>
    <Code>{`const res = await fetch("${BASE}/chat/send", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
  body: JSON.stringify({ message, model: "luchii-6-plus", conversation_id }),
});
const reader = res.body.getReader();
const dec = new TextDecoder();
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  for (const line of dec.decode(value).split("\\n")) {
    if (!line.startsWith("data:")) continue;
    const ev = JSON.parse(line.slice(5));
    if (ev.delta) render(ev.delta);
    if (ev.done) conversation_id = ev.conversation_id;
  }
}`}</Code>

    <h3 className="mt-6 text-sm font-semibold text-neutral-200">Send a Luchii agent to work</h3>
    <Code>{`curl -X POST ${BASE}/chat/agents/bundle \\
  -H "X-Frasberg-Key: $FRASBERG_KEY" -H "Content-Type: application/json" \\
  -d '{"idea":"A lighthouse on a stormy cliff at night"}'

curl ${BASE}/chat/agents/bundle/<bundle_id> -H "X-Frasberg-Key: $FRASBERG_KEY"`}</Code>
    <p className="mt-3 text-xs text-neutral-500">Switch models any time by sending a different <code>model</code> in the same conversation.</p>
  </section>
);
