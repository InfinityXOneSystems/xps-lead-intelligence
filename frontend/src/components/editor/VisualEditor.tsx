'use client';

import { useState, useRef } from 'react';
import { Sparkles, Play, Save, RotateCcw, Copy, Check, Code2, Eye, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type PreviewMode = 'split' | 'code' | 'preview';

const STARTER_CODE = `'use client';
import { useState } from 'react';

export default function MyComponent() {
  const [count, setCount] = useState(0);
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a14, #10101e)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'system-ui',
    }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24 }}>
        ✨ AI-Generated Component
      </h1>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{
          padding: '12px 32px',
          background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
          border: 'none',
          borderRadius: 8,
          color: 'white',
          fontSize: 16,
          cursor: 'pointer',
        }}
      >
        Clicked {count} times
      </button>
    </div>
  );
}`;

function buildPreviewDoc(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a14; color: white; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useCallback, useMemo } = React;
    ${code.replace(/^'use client';\n?/, '').replace(/^import[^;]*;\n?/gm, '').replace(/^export default /, '')}
    const root = document.getElementById('root');
    const Comp = typeof MyComponent !== 'undefined' ? MyComponent : () => React.createElement('div', {style:{color:'red',padding:20}}, 'Component not found');
    ReactDOM.createRoot(root).render(React.createElement(Comp));
  </script>
</body>
</html>`;
}

export function VisualEditor() {
  const [code, setCode] = useState(STARTER_CODE);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<PreviewMode>('split');
  const [copied, setCopied] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [toolLog, setToolLog] = useState<string[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const generateCode = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setToolLog([]);
    try {
      const fullPrompt = `Use the code_generate tool to create a complete React functional component called MyComponent for: ${text}

Requirements for the generated component:
- Named export: export default function MyComponent()
- Use ONLY inline styles (no CSS imports, no Tailwind, no external stylesheets)
- Electric/metallic dark design aesthetic: backgrounds #0a0a14/#10101e, white text, blue/purple gradient accents
- Use CSS animations via inline style keyframes in a <style> tag injected once via useEffect if needed
- Complete working code — no TODOs, no placeholders
- Include useState/useEffect hooks as needed for interactivity
- Make it visually impressive

Return ONLY the component code starting with 'use client'; — no markdown, no explanation.`;

      const res = await api.xps.execute(fullPrompt, sessionId);
      setSessionId(res.sessionId);

      let generated = res.message;
      // Strip markdown code fences
      const fenceMatch = generated.match(/```(?:tsx?|jsx?|react)?\n?([\s\S]+?)```/);
      if (fenceMatch) generated = fenceMatch[1];

      if (generated.trim().length > 50) {
        setCode(generated.trim());
      }
      if (res.toolCalls?.length) {
        setToolLog(res.toolCalls.map((t) => `${t.tool} (${t.durationMs}ms)`));
      }
    } catch (err) {
      console.error('Code generation error:', err);
    } finally {
      setLoading(false);
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void generateCode(); }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)', color: 'white' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(99,179,237,0.15)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">AI Visual Editor</span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.2)', color: 'var(--electric-1)' }}>
            Lovable / V0
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['split', 'code', 'preview'] as PreviewMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className="px-2.5 py-1 text-xs rounded-md transition-all"
              style={mode === m
                ? { background: 'rgba(99,179,237,0.2)', color: 'var(--electric-1)', border: '1px solid rgba(99,179,237,0.4)' }
                : { color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
          <button onClick={copyCode} className="p-1.5 rounded-md transition-colors ml-1"
            style={{ color: copied ? '#68d391' : 'rgba(255,255,255,0.4)' }}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={() => setCode(STARTER_CODE)} className="p-1.5 rounded-md"
            style={{ color: 'rgba(255,255,255,0.4)' }} title="Reset to starter">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI prompt bar */}
      <div className="flex gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(99,179,237,0.1)', background: 'rgba(10,10,20,0.6)' }}>
        <div className="flex-1 relative">
          <Sparkles className="absolute left-3 top-3 w-4 h-4 pointer-events-none" style={{ color: 'var(--electric-2)' }} />
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what to build… e.g. 'A metrics dashboard with animated counters and gradient cards'"
            rows={1}
            className="w-full pl-9 pr-3 py-2.5 text-sm resize-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(99,179,237,0.2)',
              borderRadius: 8,
              color: 'white',
              outline: 'none',
              minHeight: 42,
              maxHeight: 100,
            }}
          />
        </div>
        <button
          onClick={() => void generateCode()}
          disabled={!prompt.trim() || loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 disabled:opacity-40 transition-all"
          style={{ background: 'linear-gradient(135deg, var(--electric-1), var(--electric-2))', color: 'white', border: 'none' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {/* Tool call log */}
      {toolLog.length > 0 && (
        <div className="px-4 py-2 flex-shrink-0 flex flex-wrap gap-1.5"
          style={{ borderBottom: '1px solid rgba(99,179,237,0.08)', background: 'rgba(123,47,247,0.04)' }}>
          {toolLog.map((t, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(123,47,247,0.15)', border: '1px solid rgba(123,47,247,0.3)', color: 'rgba(255,255,255,0.55)' }}>
              ⚡ {t}
            </span>
          ))}
        </div>
      )}

      {/* Editor + Preview */}
      <div className="flex flex-1 overflow-hidden">
        {(mode === 'code' || mode === 'split') && (
          <div className={`flex flex-col ${mode === 'split' ? 'w-1/2' : 'w-full'}`}
            style={{ borderRight: mode === 'split' ? '1px solid rgba(99,179,237,0.1)' : undefined }}>
            <div className="px-3 py-1 text-xs flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', background: '#0d0d1a' }}>
              MyComponent.tsx
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 code-editor"
              style={{ border: 'none', borderRadius: 0, background: '#0a0a14' }}
              spellCheck={false}
            />
          </div>
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`flex flex-col ${mode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="px-3 py-1 text-xs flex-shrink-0 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', background: '#0d0d1a' }}>
              <Eye className="w-3 h-3" /> Live Preview
              {loading && <span className="text-blue-400 animate-pulse ml-1">Generating…</span>}
            </div>
            <iframe
              srcDoc={buildPreviewDoc(code)}
              sandbox="allow-scripts"
              title="Component Preview"
              className="flex-1 w-full"
              style={{ border: 'none', background: '#0a0a14' }}
            />
          </div>
        )}
      </div>

      {/* Bottom status */}
      <div className="px-4 py-1.5 text-xs flex items-center justify-between flex-shrink-0"
        style={{ borderTop: '1px solid rgba(99,179,237,0.08)', color: 'rgba(255,255,255,0.25)' }}>
        <span>Enter to generate · Shift+Enter for new line · Edit code directly</span>
        <span>Groq llama3-70b · XPS Orchestrator</span>
      </div>
    </div>
  );
}
