"use client";

import { useState } from "react";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-box">
      <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label="Your MCP link" />
      <button
        type="button"
        className="btn btn-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked: the field is still selectable */
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
