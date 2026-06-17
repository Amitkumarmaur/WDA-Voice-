import React, { useState } from 'react';
import { Code2, Copy, Check, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  publicSlug: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 type-caption font-medium transition-colors shrink-0',
        copied
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-surface-2 text-ink-muted hover:text-ink border border-hairline'
      )}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function EmbedCodePanel({ publicSlug }: Props) {
  const [tab, setTab] = useState<'floating' | 'iframe'>('floating');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yourapp.com';
  const embedUrl = `${origin}/embed/${publicSlug}`;

  const floatingSnippet = `<!-- Voicera AI Voice Agent – floating button -->
<script>
(function() {
  var EMBED_URL = '${embedUrl}';

  // Floating button
  var btn = document.createElement('button');
  btn.id = 'voicera-btn';
  btn.setAttribute('aria-label', 'Open AI Voice Agent');
  btn.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'width:60px',
    'height:60px',
    'border-radius:50%',
    'background:#4f46e5',
    'border:none',
    'cursor:pointer',
    'box-shadow:0 4px 24px rgba(79,70,229,0.45)',
    'z-index:2147483646',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'transition:transform 0.2s',
  ].join(';');
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  btn.onmouseover = function() { btn.style.transform = 'scale(1.08)'; };
  btn.onmouseout  = function() { btn.style.transform = 'scale(1)'; };

  // Widget container
  var wrap = document.createElement('div');
  wrap.id = 'voicera-widget';
  wrap.style.cssText = [
    'display:none',
    'position:fixed',
    'bottom:96px',
    'right:24px',
    'width:380px',
    'height:620px',
    'border-radius:20px',
    'overflow:hidden',
    'box-shadow:0 20px 60px rgba(0,0,0,0.18)',
    'z-index:2147483645',
    'border:1px solid rgba(0,0,0,0.08)',
  ].join(';');

  var iframe = document.createElement('iframe');
  iframe.src = EMBED_URL;
  iframe.allow = 'microphone';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.title = 'Voicera AI Voice Agent';
  wrap.appendChild(iframe);

  var open = false;
  btn.onclick = function() {
    open = !open;
    wrap.style.display = open ? 'block' : 'none';
    btn.style.background = open ? '#3730a3' : '#4f46e5';
  };

  document.body.appendChild(wrap);
  document.body.appendChild(btn);
})();
</script>`;

  const iframeSnippet = `<!-- Voicera AI Voice Agent – inline embed -->
<iframe
  src="${embedUrl}"
  width="400"
  height="620"
  allow="microphone"
  style="border:none; border-radius:20px; box-shadow:0 8px 32px rgba(0,0,0,0.12);"
  title="Voicera AI Voice Agent"
></iframe>`;

  const activeSnippet = tab === 'floating' ? floatingSnippet : iframeSnippet;

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-hairline">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-canvas">
          <Code2 size={18} className="text-ink" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="type-body font-semibold text-ink">Embed on any website</h3>
          <p className="type-caption text-ink-muted">Paste the code snippet on any website to add your AI voice agent</p>
        </div>
        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 type-caption text-ink-muted hover:text-ink transition-colors"
        >
          Preview <ExternalLink size={12} />
        </a>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-surface-2 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('floating')}
            className={cn(
              'px-4 py-1.5 rounded-md type-body-sm font-medium transition-colors',
              tab === 'floating' ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            )}
          >
            Floating button
          </button>
          <button
            type="button"
            onClick={() => setTab('iframe')}
            className={cn(
              'px-4 py-1.5 rounded-md type-body-sm font-medium transition-colors',
              tab === 'iframe' ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            )}
          >
            Inline iframe
          </button>
        </div>

        {/* Description */}
        <p className="type-caption text-ink-muted">
          {tab === 'floating'
            ? 'A purple mic button appears in the bottom-right corner of your site. Clicking it opens the voice agent in a popup. Works on any website.'
            : 'Embed the voice agent inline — inside a contact page, sidebar, or landing section. Set width/height as needed.'}
        </p>

        {/* Code block */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="type-caption text-ink-tertiary font-mono">
              {tab === 'floating' ? 'Paste before </body>' : 'Paste anywhere in your HTML'}
            </span>
            <CopyButton text={activeSnippet} />
          </div>
          <pre className="rounded-lg border border-hairline bg-canvas p-4 type-mono text-[11px] text-ink overflow-x-auto leading-relaxed max-h-64 overflow-y-auto">
            {activeSnippet}
          </pre>
        </div>

        {/* Direct URL */}
        <div className="space-y-1.5">
          <p className="type-caption font-medium text-ink-muted uppercase tracking-wide">Direct embed URL</p>
          <div className="flex items-center gap-2 rounded-md border border-hairline bg-canvas px-3 py-2.5">
            <code className="type-mono text-xs text-ink min-w-0 flex-1 truncate">{embedUrl}</code>
            <CopyButton text={embedUrl} />
          </div>
        </div>

        {/* Note */}
        <div className="rounded-md border border-hairline bg-surface-2 px-4 py-3 type-caption text-ink-muted">
          <strong className="text-ink font-medium">Microphone permission:</strong> The embed requires microphone access.
          Modern browsers ask the visitor for permission on first use — this is normal and expected.
          Make sure your site is served over <strong>HTTPS</strong>.
        </div>
      </div>
    </div>
  );
}
