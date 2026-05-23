# Motion (motion.dev) v12 for React 19

This document establishes the architecture, lifecycle management, and implementation recipes for **Motion v12** (formerly Framer Motion) under the new `@gsap/react` cross-reference.

---

## 1. Core Architecture & Hybrid Engine

### The Hybrid WAAPI / JS Engine
In v12, Motion implements a hybrid execution engine:
1. **Compositor WAAPI Mode**: Simple, non-interpolated transitions (e.g. `opacity`, `transform` using standard eases) are executed off-thread via the native **Web Animations API** (WAAPI). This ensures 0% main-thread blockage (*без блокировки основного потока*).
2. **JS Physics Fallback**: Whenever springs, custom velocity-based tracking, `drag`, `layout`, or complex scroll timelines (`useScroll`) are active, the engine falls back to its highly optimized JavaScript animation frame loop.

### Package & Imports (May 2026 Spec)
```bash
npm install motion@12.40.0
```

Recommended import path for React 19 integrations:
```typescript
import { motion, AnimatePresence, useAnimate } from 'motion/react';
```

---

## 2. When to Choose: Motion vs. GSAP 3.15

Choose your tool based on this explicit design-engineering rule:

*   **Choose Motion (motion.dev)**: If the animation is bound to the **React Component Lifecycle** (components mounting/unmounting, shared layout-id elements changing containers, gestural button micro-interactions, page route transitions, or CSS variable interpolation in Client Components).
*   **Choose GSAP (ScrollTrigger/Flip)**: If the animation requires **Canvas/WebGL/Three.js** orchestration, vector manipulations (morphing/drawing SVGs), custom snap points, scroll layout pinning (*фиксация экрана при прокрутке*), global event observation (Observer), or layout recalculation independent of React's render tree.

### Bundle Size comparison
*   **Motion Core**: `~30 KB` (Gzipped). By utilizing `LazyMotion` and `domAnimation` features, the initial chunk overhead can be reduced to `~15 KB`.
*   **GSAP Core + ScrollTrigger**: `~42 KB` (Gzipped).

---

## 3. Core Engine Recipes

### A. Custom Component Wrapper via `motion.create`
Allows animating third-party library elements or custom forwardRef components:
```tsx
import React, { forwardRef } from 'react';
import { motion } from 'motion/react';

const CustomButton = forwardRef<HTMLButtonElement, React.ComponentPropsWithRef<'button'>>((props, ref) => (
  <button ref={ref} {...props} className="btn-base" />
));
CustomButton.displayName = 'CustomButton';

// Upgrade to motion capability
export const MotionButton = motion.create(CustomButton);
```

### B. Shared Layout Transition (`layout` + `layoutId`)
Smoothly morph elements changing positions across container rerenders:
```tsx
import { useState } from 'react';
import { motion } from 'motion/react';

export function TabNav() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['Overview', 'Analytics', 'Settings'];

  return (
    <nav className="tab-container">
      {tabs.map((tab, idx) => (
        <button key={tab} className="tab-btn" onClick={() => setActiveTab(idx)}>
          <span className="tab-label">{tab}</span>
          {activeTab === idx && (
            // Morph layout element smoothly between siblings
            <motion.div 
              layoutId="active-indicator" 
              className="tab-highlight"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      ))}
    </nav>
  );
}
```

### C. Timing Sequence Orchestration via `useAnimate`
Imperative animation control without creating multi-variant layouts:
```tsx
import { useAnimate } from 'motion/react';

export function SequenceTrigger() {
  const [scope, animate] = useAnimate();

  const handleSequence = async () => {
    // 1. Initial scale down
    await animate(scope.current, { scale: 0.95 }, { duration: 0.2 });
    
    // 2. Multi-target parallel stagger
    await animate('.stagger-target', { opacity: 1, y: 0 }, { 
      delay: 0.1, 
      duration: 0.4, 
      ease: 'easeOut' 
    });
    
    // 3. Reset parent
    animate(scope.current, { scale: 1 }, { type: 'spring', stiffness: 200 });
  };

  return (
    <div ref={scope} onClick={handleSequence} className="sequence-panel">
      <div className="stagger-target" style={{ opacity: 0, transform: 'translateY(10px)' }}>A</div>
      <div className="stagger-target" style={{ opacity: 0, transform: 'translateY(10px)' }}>B</div>
    </div>
  );
}
```

---

## 4. Ready-to-Use Components

### 1. Page Transition (Route wrapper)
```tsx
import { motion } from 'motion/react';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

### 2. Modal Dialogue (with AnimatePresence)
```tsx
import { motion, AnimatePresence } from 'motion/react';

export function Modal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div 
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Modal Content</h3>
            <button onClick={onClose}>Close</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 3. Staggered List Item Entrance
```tsx
import { motion } from 'motion/react';

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 24 }
  }
};

export function StaggeredList({ items }: { items: string[] }) {
  return (
    <motion.ul variants={listVariants} initial="hidden" animate="visible">
      {items.map((item) => (
        <motion.li key={item} variants={itemVariants} className="list-item">
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### 4. Parallax Image Grid
```tsx
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

export function ScrollParallax() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const translateSlow = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const translateFast = useTransform(scrollYProgress, [0, 1], [0, -220]);

  return (
    <div ref={containerRef} className="parallax-grid">
      <motion.div style={{ y: translateSlow }} className="layer-slow">
        <img src="/img-slow.jpg" alt="Background" />
      </motion.div>
      <motion.div style={{ y: translateFast }} className="layer-fast">
        <img src="/img-fast.jpg" alt="Foreground" />
      </motion.div>
    </div>
  );
}
```

### 5. Magnetic Physics Button
```tsx
import { useRef, useState } from 'react';
import { motion } from 'motion/react';

export function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = ref.current.getBoundingClientRect();
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);
    
    // Magnetic pull threshold
    setPosition({ x: x * 0.35, y: y * 0.35 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
      className="magnetic-btn"
    >
      {children}
    </motion.button>
  );
}
```

### 6. Optimistic AI Streaming Message Card
Simulates realistic mechanical typography layout adjustments during token generation (*эффект динамической допечатки текста*).

```tsx
import { motion, AnimatePresence } from 'motion/react';

interface MessageProps {
  id: string;
  text: string;
  isStreaming: boolean;
}

export function AIStreamingCard({ id, text, isStreaming }: MessageProps) {
  return (
    <motion.div
      layout // Animates size adjustments dynamically as text expands
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="message-card ai-response"
    >
      <div className="message-content">
        <span>{text}</span>
        <AnimatePresence>
          {isStreaming && (
            <motion.span
              layoutId={`${id}-cursor`}
              initial={{ opacity: 0.2 }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="streaming-cursor"
            >
              █
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
```

---

## 5. Reduced Motion & Accessibility

Ensure animations conform to the WCAG 2.2 preference checks natively using the `useReducedMotion` hook:

```tsx
import { motion, useReducedMotion } from 'motion/react';

export function AccessibleCard() {
  const shouldReduce = useReducedMotion();

  // Define variants that adapt to user settings
  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: shouldReduce ? 0 : 20 
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: shouldReduce ? 0.1 : 0.4,
        ease: 'easeOut'
      }
    }
  };

  return (
    <motion.div 
      variants={cardVariants} 
      initial="hidden" 
      animate="visible" 
      className="card"
    >
      Accessibility First Content
    </motion.div>
  );
}
```
*   **Rule**: Never disable opacity transitions under `prefers-reduced-motion`; only scale down spatial translations (`y`, `x`, `scale`) to zero to prevent vestibular sickness.
