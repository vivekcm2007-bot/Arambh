import { createHash } from 'node:crypto';
import type { AdversarialFlag, Modality } from '../shared/types.ts';

export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

const INJECTION_PATTERNS: Array<{ regex: RegExp; code: string; summary: string }> = [
  {
    regex: /ignore\s+(all\s+)?(previous|prior|earlier|above)\s+(instructions|conflicts|discrepancies|records|evidence)/i,
    code: 'PROMPT_INJECTION_IGNORE',
    summary: 'Contains instruction-override language attempting to suppress prior evidence or contradictions.',
  },
  {
    regex: /\[?\s*(system\s+directive|priority\s+override|admin\s+override|assistant\s+instruction)\s*[:\]]/i,
    code: 'SPOOFED_SYSTEM_DIRECTIVE',
    summary: 'Embeds a synthetic system/priority directive block inside untrusted document text.',
  },
  {
    regex: /(mark|report|treat|certify)\s+.*\s+as\s+(100%\s+)?(compliant|verified|valid|true)\s+(in\s+all\s+outputs)?/i,
    code: 'FORCED_VERDICT_INJECTION',
    summary: 'Attempts to force downstream reasoning outputs to declare compliance unconditionally.',
  },
  {
    regex: /[\u200B-\u200D\uFEFF]/,
    code: 'ZERO_WIDTH_OBFUSCATION',
    summary: 'Contains hidden zero-width Unicode characters commonly used to obfuscate text payloads.',
  },
];

export function scanDeterministicIntegrity(
  modality: Modality,
  textContent?: string
): AdversarialFlag[] {
  const flags: AdversarialFlag[] = [];
  if (!textContent) {
    return flags;
  }

  for (const rule of INJECTION_PATTERNS) {
    const match = textContent.match(rule.regex);
    if (match) {
      flags.push({
        code: rule.code,
        severity: 'high',
        summary: rule.summary,
        excerpt: match[0].slice(0, 140),
      });
    }
  }

  if (modality === 'table') {
    const lines = textContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length >= 2) {
      const headerCols = lines[0].split(',').length;
      const raggedRows = lines.slice(1).filter((line) => line.split(',').length !== headerCols);
      if (raggedRows.length > 0) {
        flags.push({
          code: 'CSV_SCHEMA_DRIFT',
          severity: 'medium',
          summary: `${raggedRows.length} CSV row(s) do not match header column count (${headerCols}).`,
          excerpt: raggedRows[0].slice(0, 120),
        });
      }
    }
  }

  if (modality === 'dataset') {
    try {
      JSON.parse(textContent);
    } catch {
      flags.push({
        code: 'MALFORMED_JSON_DATASET',
        severity: 'high',
        summary: 'JSON dataset failed strict structural parsing; record may be truncated or tampered.',
      });
    }
  }

  return flags;
}

export function sanitizeUntrustedText(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '[ZW_CHAR]');
}
