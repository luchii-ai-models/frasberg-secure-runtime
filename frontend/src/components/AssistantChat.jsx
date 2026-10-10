import React, { useRef, useState } from "react";
import axios from "axios";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AssistantChat = () => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: "bot", text: "Hi, I'm Luchii. Ask me for prompt ideas or help with any studio." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useRef(null);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/assistant/chat`, { message: text, session_id: session.current });
      session.current = data.session_id;
      setMsgs((m) => [...m, { role: "bot", text: data.reply }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: "error", text: err.response?.data?.detail || "Luchii Chat is unavailable right now. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button data-testid="assistant-open-btn" onClick={() => setOpen(true)} aria-label="Open Luchii assistant"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#00F0FF] text-black flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:scale-105 transition-transform">
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div data-testid="assistant-panel" className="fixed bottom-6 right-6 z-50 w-[22rem] max-w-[calc(100vw-3rem)] h-[30rem] flex flex-col rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="font-semibold text-sm">Luchii Assistant <span className="text-neutral-400 font-normal">· luchii-6-plus</span></span>
        <button data-testid="assistant-close-btn" onClick={() => setOpen(false)} aria-label="Close"><X className="w-4 h-4 text-neutral-400 hover:text-white" /></button>
      </div>
      <div data-testid="assistant-messages" className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {msgs.map((m, i) => (
          <div key={i} data-testid={`assistant-msg-${m.role}`}
            className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${m.role === "user" ? "ml-auto bg-[#00F0FF]/15 border border-[#00F0FF]/30" : m.role === "error" ? "bg-red-500/10 border border-red-500/30 text-red-200" : "bg-white/5 border border-white/10"}`}>
            {m.text}
          </div>
        ))}
        {busy && <Loader2 data-testid="assistant-loading" className="w-4 h-4 animate-spin text-[#00F0FF]" />}
      </div>
      <form onSubmit={send} className="flex gap-2 p-3 border-t border-white/10">
        <input data-testid="assistant-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Luchii..."
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm outline-none focus:border-[#00F0FF]/50" />
        <button data-testid="assistant-send-btn" disabled={busy || !input.trim()} className="w-9 h-9 rounded-full bg-[#00F0FF] text-black flex items-center justify-center disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
