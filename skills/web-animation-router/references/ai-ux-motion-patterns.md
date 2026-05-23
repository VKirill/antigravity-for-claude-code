# AI Product UX Motion Patterns (2026)

This guide establishes the production standards for AI interface motion design in 2026. It details the animation guidelines and React (Motion v12) code templates for streaming tokens, agent tool executions, optimistic state updates, and dynamic skeleton transitions.

Cross-reference core systems and tokens via:
*   [motion-tokens-and-springs.md](motion-tokens-and-springs.md) (Standard ease values & spring conversion math)
*   [motiondev-v12-react.md](motiondev-v12-react.md) (Declarative animations, gestures, and layoutId)
*   [microinteractions-catalog.md](microinteractions-catalog.md) (State buttons and skeleton loaders)

---

## 1. Industry Motion Reference Standards

| System Reference | UI Context | Motion Signature Specs | UX Objective |
| :--- | :--- | :--- | :--- |
| **Claude (Anthropic)** | Artifacts Panel | `stiffness: 380`, `damping: 32` spring | Prevents panel bouncing during slides. |
| **Gemini (Google)** | Thinking State | 3-color mesh gradient rotation (10s), `blur(12px)` | Conveys fluid reasoning. |
| **ChatGPT (OpenAI)** | Chat Streaming | Continuous vertical scroll pin, pulsing orb loader | Signals system focus. |
| **Perplexity** | Citation Reveal | Horizontal slide-in, `staggerChildren: 0.04s` | Displays sources efficiently. |
| **v0 / Notion AI** | Component Swap | `blur(4px) -> blur(0px)`, `opacity` crossfade (200ms) | Prevents layout flashing on load. |

---

## 2. Copy-Paste AI Motion Components

### 1. Gemini-Style Mesh Thinking Indicator
Renders a fluid, multi-colored mesh gradient bubble that rotates and pulses to convey deep reasoning steps.

```tsx
'use client';

import React from 'react';
import { motion } from 'motion/react';

export function ThinkingGradient() {
  return (
    <div className="relative w-full max-w-md h-32 rounded-2xl overflow-hidden bg-black/40 border border-zinc-800 flex items-center justify-center">
      {/* Dynamic blurred gradient mesh */}
      <motion.div
        className="absolute inset-0 opacity-40 blur-2xl filter"
        style={{
          background: 'radial-gradient(circle at 20% 30%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 70%, #a855f7 0%, transparent 50%), radial-gradient(circle at 50% 50%, #ec4899 0%, transparent 60%)',
          backgroundSize: '200% 200%',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 100%', '0% 0%'],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 8,
          ease: 'linear',
          repeat: Infinity,
        }}
      />
      
      <div className="relative flex items-center gap-3">
        {/* Pulsing Core Indicator */}
        <motion.span
          className="h-3 w-3 rounded-full bg-blue-400"
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="text-sm font-semibold text-zinc-400">Agent is processing...</span>
      </div>
    </div>
  );
}
```

---

### 2. Layout-Shift-Free Streaming Text Box
Handles incoming chunk updates. Uses a smart observer hook that pins the viewport scroll position to the bottom *only* if the user is already scrolled to the bottom, avoiding scroll hijacking.

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function StreamingText({ textStream }: { textStream: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  // Monitor user scrolling to avoid scroll-hijacking
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    // Check if user is scrolled up by more than 80px
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setIsUserScrolledUp(distanceToBottom > 80);
  };

  // Keep pinned to bottom on incoming stream updates
  useEffect(() => {
    if (isUserScrolledUp || !sentinelRef.current) return;
    sentinelRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [textStream, isUserScrolledUp]);

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="w-full max-w-2xl h-80 overflow-y-auto border border-zinc-800 bg-zinc-950 p-4 rounded-xl"
    >
      <div className="space-y-4 text-zinc-200 leading-relaxed text-sm">
        {/* Split stream text into tokens to fade-in */}
        <p>
          {textStream.split(' ').map((token, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, filter: 'blur(2px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="inline-block mr-1"
            >
              {token}
            </motion.span>
          ))}
          {/* Typing Cursor */}
          <motion.span
            className="inline-block w-2 h-4 bg-blue-500 ml-0.5"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </p>
        <div ref={sentinelRef} />
      </div>
    </div>
  );
}
```

---

### 3. Tool-Execution Collapsible Log
Visualizes live agent tool run statuses. Minimizes terminal logs until toggled, scaling open natively.

```tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ToolRunProps {
  toolName: string;
  status: 'running' | 'completed' | 'failed';
  logs: string[];
}

export function ToolExecutionLog({ toolName, status, logs }: ToolRunProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full max-w-lg border border-zinc-800 rounded-lg bg-zinc-900 overflow-hidden">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {status === 'running' && (
            <motion.svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </motion.svg>
          )}
          {status === 'completed' && (
            <span className="h-5 w-5 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center text-xs font-bold">✓</span>
          )}
          {status === 'failed' && (
            <span className="h-5 w-5 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center text-xs font-bold">!</span>
          )}
          <span className="text-sm font-semibold text-zinc-200">Tool: {toolName}</span>
        </div>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="h-4 w-4 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
          >
            <div className="p-4 bg-black/30 border-t border-zinc-800 font-mono text-xs text-zinc-400 space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="truncate">
                  <span className="text-zinc-600">$</span> {log}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

### 4. Perplexity-Style Citation Cards
Source citation badges that reveal comprehensive metadata cards on hover.

```tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface CitationProps {
  index: number;
  url: string;
  title: string;
}

export function CitationBadge({ index, url, title }: CitationProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded text-xs font-semibold hover:bg-zinc-700 transition-colors">
        [{index}]
      </button>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 450, damping: 24 }} // snappy
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-xl z-50 pointer-events-none"
          >
            <h4 className="text-xs font-bold text-zinc-100 line-clamp-1">{title}</h4>
            <p className="text-[10px] text-zinc-500 mt-1 truncate">{url}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

### 5. Multi-Step Agent Progress Indicators
Visualizes live steps in an agent sequence. Highlights the current step with a pulse, marking completed ones with a check.

```tsx
'use client';

import React from 'react';
import { motion } from 'motion/react';

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

export function AgentProgress({ steps }: { steps: Step[] }) {
  return (
    <div className="w-full max-w-sm space-y-4 bg-zinc-950 p-4 border border-zinc-800 rounded-xl">
      {steps.map((step, index) => {
        const isCompleted = step.status === 'completed';
        const isActive = step.status === 'active';

        return (
          <div key={step.id} className="flex items-center gap-3 relative">
            {/* Step Connection line */}
            {index < steps.length - 1 && (
              <div className="absolute left-[9px] top-6 w-[2px] h-6 bg-zinc-800" />
            )}

            {/* Indicator Circle */}
            <div className="relative h-5 w-5 flex items-center justify-center">
              {isActive && (
                <motion.span
                  className="absolute inset-0 bg-blue-500/30 rounded-full"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              <motion.div
                className={`h-2.5 w-2.5 rounded-full z-10 transition-colors duration-300 ${
                  isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-zinc-800'
                }`}
                animate={isActive ? { scale: [1, 1.2, 1] } : {}}
              />
            </div>

            <span className={`text-xs font-semibold transition-colors duration-300 ${
              isActive ? 'text-white font-bold' : isCompleted ? 'text-zinc-300' : 'text-zinc-600'
            }`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

---

### 6. Optimistic Message Send & Error Swapping
Animates user prompts onto the chat timeline immediately in a pending style, swapping smoothly to an error retry display on request timeout.

```tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  text: string;
  status: 'pending' | 'success' | 'failed';
}

export function OptimisticChatList() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSendMessage = (text: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      status: 'pending',
    };
    
    // Add message instantly
    setMessages((prev) => [...prev, newMessage]);

    // Mock API request resolution
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessage.id
            ? { ...msg, status: Math.random() > 0.3 ? 'success' : 'failed' }
            : msg
        )
      );
    }, 2000);
  };

  return (
    <div className="w-full max-w-md bg-zinc-950 p-4 border border-zinc-800 rounded-xl space-y-4">
      <div className="h-60 overflow-y-auto space-y-3 pr-2">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 450, damping: 25 }} // snappy
              className={`p-3 rounded-lg text-xs leading-relaxed max-w-[80%] ${
                msg.status === 'failed'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-200 ml-auto'
                  : 'bg-zinc-800 text-zinc-100 ml-auto'
              }`}
            >
              <div className="flex flex-col gap-2">
                <p>{msg.text}</p>
                
                {/* State Labels */}
                {msg.status === 'pending' && (
                  <span className="text-[9px] text-zinc-500 animate-pulse">Sending...</span>
                )}
                {msg.status === 'failed' && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-red-500 font-bold">Failed to send</span>
                    <button className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[9px] font-semibold hover:bg-red-600 transition-colors">
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input trigger mock */}
      <input 
        type="text" 
        placeholder="Type message..." 
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-zinc-700"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value) {
            handleSendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}
```

---

## 3. Accessibility & Antipatterns

### Accessibility Requirements (a11y)
1.  **Stop Animations**: Always allow users to pause animated loaders.
2.  **No Scroll Hijacking**: If the user scrolls up in a chat stream, disable auto-scrolling to the bottom. Forcing scroll jumps violates basic accessibility principles for keyboard and screen-reader navigation.
3.  **Error Announcement**: When a message state transitions to `failed`, announce the status using an element equipped with `role="alert"` or `aria-live="assertive"`.

### Antipatterns
*   **Antipattern: Character-by-Character Layout Shifting**: Animating raw width or margin values on incoming characters. This causes the surrounding layout to shift continuously, creating visual vibration. Always position text within containers with locked font metrics.
*   **Antipattern: Heavy Particle Loops**: Spawning particle bursts on every single streamed token. This causes intense GPU overhead on low-end devices. Restrict animations to container reveals.
*   **Antipattern: Flashing Page Skeletons**: Swapping skeleton states with finished pages without a crossfade wrapper. This causes sudden flashes that strain user vision. Use a minimum 200ms blur-fade transition.
