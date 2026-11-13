import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { studioEmail } from "@/data/studio";

const welcomeMessage = {
  role: "assistant",
  content: "Hello, I’m Luma, the studio’s AI booking assistant. I can help you explore collections and prepare an enquiry. What are you planning?",
};

export default function LumaChat({
  open,
  onClose,
  onBook,
  session,
  setSession,
}) {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open && messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, busy, open]);
  async function send(event) {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    setError("");
    setMessages((previous) => [...previous, { role: "user", content }]);
    setInput("");
    try {
      const result = await api("/luma/chat", {
        message: content,
        session_id: session?.session_id || null,
      });
      if (typeof result?.reply !== "string" || !result.reply.trim()) {
        throw new Error("Luma returned an empty response. Please retry your message.");
      }
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: result.reply },
      ]);
      setSession(result);
    } catch (err) {
      // Restore the unsent message in the input. Never imply it was delivered.
      setInput(content);
      setError(err.message);
      if (err.status === 404) {
        setSession(null);
        setMessages([{
          role: "assistant",
          content: "Your previous conversation has expired. Send your message again to start a new enquiry.",
        }]);
      } else {
        setMessages((previous) => previous.slice(0, -1));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="luma-panel"
      hidden={!open}
      aria-label="Chat with Luma"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header>
        <div>
          <Sparkles size={18} />
          <strong>Luma</strong>
          <span>Your studio guide · AI</span>
        </div>
        <button
          className="icon-button"
          aria-label="Close Luma chat"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div
        ref={messagesRef}
        className="chat-messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message, index) => (
          <p key={index} className={`chat-message ${message.role}`}>
            {message.content}
          </p>
        ))}
        {busy && (
          <p className="chat-thinking" role="status">
            Luma is thinking…
          </p>
        )}
      </div>
      {error && (
        <p className="chat-error" role="alert">
          {error} <a href={`mailto:${studioEmail}`}>Email the studio</a>
        </p>
      )}
      <button
        className="chat-book"
        onClick={() => {
          if (session?.booking_state === "awaiting_studio_confirmation") {
            // Completed conversations must not carry into new enquiries.
            setSession(null);
            setMessages([welcomeMessage]);
            setError("");
            onBook({});
          } else {
            onBook(session?.draft || {});
          }
        }}
      >
        {session?.booking_state === "awaiting_studio_confirmation"
          ? "Start another enquiry"
          : "Review and send an enquiry"}{" "}
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
      <form className="chat-input" onSubmit={send}>
        <label className="sr-only" htmlFor="luma-message">
          Your message to Luma
        </label>
        <input
          ref={inputRef}
          id="luma-message"
          placeholder="Ask about your session…"
          maxLength={2000}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
        />
        <button aria-label="Send message" disabled={busy || !input.trim()}>
          <ArrowUp size={18} />
        </button>
      </form>
      <p className="chat-disclosure">
        AI can make mistakes. The studio confirms all dates and bookings.
        Messages are processed by OpenAI and stored to support your enquiry.
      </p>
    </section>
  );
}
