import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Sparkles, Loader2, Copy, Check,
  PenSquare, MessageSquare, ChevronDown, Zap
} from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// --- CONFIGURATION ---
// After creating your Space at https://huggingface.co/spaces,
// replace the URL below with: https://mohit7739-YOUR-SPACE-NAME.hf.space
const SPACE_URL = "https://mohit7739-tinyllama-python-coder.hf.space";
// Gradio v6 API: two-step call → POST to get event_id, then GET SSE stream
const GRADIO_API = `${SPACE_URL}/gradio_api/call/generate`;

// --- CODE BLOCK COMPONENT ---
const CodeBlock = ({ language, children }) => {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-white/10 text-left bg-[#1e1e1e]">
      <div className="flex justify-between items-center bg-[#2a2a2a] px-4 py-2 text-xs text-gray-400 border-b border-white/10">
        <span className="font-mono uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors duration-150"
        >
          {copied
            ? <><Check size={13} className="text-green-400" /><span className="text-green-400">Copied!</span></>
            : <><Copy size={13} /><span>Copy</span></>
          }
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'python'}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: '1.25rem', background: '#1e1e1e', fontSize: '0.875rem', lineHeight: '1.6' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

// --- MARKDOWN COMPONENTS (react-markdown v10 compatible) ---
const markdownComponents = {
  // Block code — parent is <pre>
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    // If there's a language class, it's a fenced code block
    if (match) {
      return <CodeBlock language={match[1]}>{children}</CodeBlock>;
    }
    // Inline code
    return (
      <code
        className="bg-white/10 text-pink-300 px-1.5 py-0.5 rounded text-sm font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
};

// --- WELCOME SCREEN ---
const WelcomeScreen = ({ onSuggestion }) => {
  const suggestions = [
    "Write a Python function to reverse a linked list",
    "Explain the difference between list and tuple in Python",
    "Write a binary search algorithm in Python",
    "Create a decorator that measures execution time",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/20">
        <Zap size={32} className="text-white" />
      </div>
      <h2 className="text-3xl font-semibold text-white mb-2">PythonCoder</h2>
      <p className="text-gray-400 text-sm mb-10 max-w-xs">Powered by a fine-tuned TinyLlama model. Ask me anything about Python!</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(s)}
            className="text-left p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-gray-300 hover:text-white transition-all duration-150"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- MAIN APP ---
function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(null); // null | number
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Countdown helper — counts down `seconds` updating state each second
  const runCountdown = (seconds) => new Promise(resolve => {
    setRetryCountdown(seconds);
    let remaining = seconds;
    const id = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(id);
        setRetryCountdown(null);
        resolve();
      } else {
        setRetryCountdown(remaining);
      }
    }, 1000);
  });

  const callModel = async (text) => {
    // Step 1: POST to Gradio API to submit the job → returns { event_id }
    const submitRes = await fetch(GRADIO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [text, 400, 0.7] }),
    });

    if (submitRes.status === 503) {
      const err = new Error('Model is currently loading');
      err.status = 503;
      throw err;
    }

    if (!submitRes.ok) {
      const errBody = await submitRes.json().catch(() => ({}));
      const msg = errBody?.detail || errBody?.error || `HTTP ${submitRes.status}`;
      if (submitRes.status === 503 || msg.toLowerCase().includes('loading')) {
        const err = new Error('Model is currently loading');
        err.status = 503;
        throw err;
      }
      throw new Error(msg);
    }

    const { event_id } = await submitRes.json();
    if (!event_id) throw new Error('No event_id returned from Space');

    // Step 2: GET the SSE stream to retrieve the result
    const resultRes = await fetch(`${GRADIO_API}/${event_id}`);
    if (!resultRes.ok) {
      throw new Error(`Failed to fetch result: HTTP ${resultRes.status}`);
    }

    const sseText = await resultRes.text();
    // Parse SSE: look for "event: complete\ndata: [...]"
    let aiContent = '';
    const lines = sseText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('data: ')) {
        try {
          const parsed = JSON.parse(lines[i].slice(6));
          // Gradio returns an array of outputs; first element is our text
          aiContent = (Array.isArray(parsed) ? parsed[0] : parsed) || '';
        } catch {
          // If not JSON, use the raw data
          aiContent = lines[i].slice(6);
        }
      }
    }

    aiContent = aiContent.trim();

    if (!aiContent.includes('```') && aiContent.length > 10) {
      aiContent = '```python\n' + aiContent + '\n```';
    }
    return aiContent || '_(empty response — try rephrasing your request)_';
  };

  const handleSend = async (overrideInput) => {
    const text = (overrideInput ?? input).trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 30; // seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const aiContent = await callModel(text);
        setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
        setIsLoading(false);
        return;
      } catch (error) {
        const isWakingUp = error?.message?.includes('503') ||
          error?.message?.includes('loading') ||
          error?.message?.includes('currently loading') ||
          error?.status === 503;

        if (isWakingUp && attempt < MAX_RETRIES) {
          // Wait with countdown then retry
          await runCountdown(RETRY_DELAY);
          // continue to next attempt
        } else {
          // Not a loading error OR we've exhausted retries
          const msg = attempt >= MAX_RETRIES
            ? `❌ **Model failed to respond after ${MAX_RETRIES} attempts.** The Hugging Face API may be temporarily unavailable. Please try again in a minute.`
            : `⚠️ **Unexpected error.** \`${error?.message || 'Unknown error'}\`\n\nPlease check your API token and try again.`;
          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
          setIsLoading(false);
          return;
        }
      }
    }

    setIsLoading(false);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <div className="flex h-screen bg-[#212121] text-gray-100 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── SIDEBAR ── */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 transition-all duration-300 overflow-hidden bg-[#171717] flex flex-col`}
      >
        <div className="flex flex-col h-full p-3">
          {/* New Chat */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm text-gray-200 transition-colors duration-150 mb-1"
          >
            <PenSquare size={16} />
            <span>New chat</span>
          </button>

          {/* Model Badge */}
          <div className="mx-1 my-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={12} className="text-blue-400" />
              <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-widest">Active Model</span>
            </div>
            <p className="text-xs text-gray-300 font-mono truncate">tiny-python-coder</p>
            <p className="text-[10px] text-gray-500 mt-0.5">tiny-python-coder</p>
          </div>

          {/* Chat History placeholder */}
          <div className="mt-4 px-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Today</p>
            {messages.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/10 text-xs text-gray-300 cursor-default">
                <MessageSquare size={13} className="flex-shrink-0 text-gray-400" />
                <span className="truncate">{messages[0].content.slice(0, 40)}…</span>
              </div>
            )}
            {messages.length === 0 && (
              <p className="text-xs text-gray-600 px-2">No conversations yet.</p>
            )}
          </div>

          {/* Footer */}
          <div className="mt-auto border-t border-white/10 pt-3">
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                MK
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">Mohit Kumar</p>
                <p className="text-[10px] text-gray-500 truncate">model</p>
              </div>
              <ChevronDown size={14} className="text-gray-500 ml-auto flex-shrink-0" />
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#212121] z-10 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            title="Toggle sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">PythonCoder</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono tracking-wide">TinyLlama 1.1B</span>
          </div>
        </header>

        {/* Chat Messages */}
        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestion={(s) => { setInput(s); setTimeout(() => handleSend(s), 0); }} />
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-1">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 px-2 py-4 rounded-2xl ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-blue-500/20">
                      <Bot size={16} className="text-white" />
                    </div>
                  )}

                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                    {msg.role === 'user' ? (
                      <div className="bg-[#2f2f2f] text-gray-100 rounded-3xl px-5 py-3 text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="prose-chat text-gray-200 text-sm">
                        <ReactMarkdown components={markdownComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-[#3f3f3f] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-gray-200">
                      MK
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 px-2 py-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Loader2 size={16} className="animate-spin text-white" />
                  </div>
                  {retryCountdown !== null ? (
                    <div className="flex flex-col justify-center">
                      <p className="text-sm text-yellow-400 font-medium">⏳ Model is waking up…</p>
                      <p className="text-xs text-gray-500 mt-0.5">Retrying automatically in <span className="text-yellow-400 font-mono font-semibold">{retryCountdown}s</span></p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          )}
        </main>

        {/* Input Area */}
        <footer className="flex-shrink-0 px-4 pb-4 pt-2 bg-[#212121]">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-[#2f2f2f] rounded-3xl border border-white/10 px-4 py-3 shadow-xl focus-within:border-white/25 transition-colors">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Message PythonCoder…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 resize-none focus:outline-none text-sm leading-relaxed max-h-48 overflow-y-auto"
                style={{ minHeight: '24px' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150
                  disabled:bg-[#404040] disabled:text-gray-600 disabled:cursor-not-allowed
                  enabled:bg-white enabled:text-black enabled:hover:bg-gray-200 enabled:active:scale-95"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-600 mt-2.5">
              PythonCoder can make mistakes. Consider checking important information.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default App;