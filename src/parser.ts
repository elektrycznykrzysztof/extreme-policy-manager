export type LineKind = "blank" | "comment" | "entry" | "field" | "text";

export interface ParsedLine {
  line: number;
  text: string;
  kind: LineKind;
}

export interface PolicyRule {
  line: number;
  name: string;
  condition: string;
  sourceAddress: string;
  sourcePort: string;
  destinationAddress: string;
  destinationPort: string;
  protocol: string;
  action: string;
}

export interface ParsedPolFile {
  rules: PolicyRule[];
  lines: ParsedLine[];
  stats: {
    lines: number;
    comments: number;
    rules: number;
  };
}

const COMMENT_PREFIXES = ["#", "!", ";", "//"];

function isComment(value: string): boolean {
  return COMMENT_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function cleanValue(value: string): string {
  return value
    .replace(/\s*;\s*$/, "")
    .replace(/\s*#.*$/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function emptyRule(line: number, name: string): PolicyRule {
  return {
    line,
    name,
    condition: "",
    sourceAddress: "",
    sourcePort: "",
    destinationAddress: "",
    destinationPort: "",
    protocol: "",
    action: "",
  };
}

function findClosingBrace(source: string, openingIndex: number): number {
  let depth = 0;
  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return source.length;
}

function withoutComments(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/(?:^|\s)(?:#|!|\/\/).*$/, ""))
    .join("\n");
}

function parseRuleBody(body: string, line: number, name: string): PolicyRule {
  const rule = emptyRule(line, name);
  const cleanBody = withoutComments(body);

  const conditionMatch = cleanBody.match(/\bif(?:\s+match\s+(all|any))?\b/i);
  if (conditionMatch) {
    rule.condition = conditionMatch[1]
      ? `if match ${conditionMatch[1].toLowerCase()}`
      : "if";
  }

  // Pola kończy wartość na średniku. Dzięki temu kilka pól w jednej linii
  // jest rozpoznawanych dokładnie tak samo jak pola w osobnych liniach.
  const fieldPattern = /\b(source-address|source[-\s]port|destination-address|destination[-\s]port|protocol)\s+([^;{}\r\n]+?)(?:\s*;|(?=\s*}))/gi;
  for (const match of cleanBody.matchAll(fieldPattern)) {
    const key = match[1].toLowerCase().replace(/\s+/g, "-");
    const value = cleanValue(match[2]);
    if (key === "source-address") rule.sourceAddress = value;
    if (key === "source-port") rule.sourcePort = value;
    if (key === "destination-address") rule.destinationAddress = value;
    if (key === "destination-port") rule.destinationPort = value;
    if (key === "protocol") rule.protocol = value;
  }

  // Akcja jest pobierana tylko z bloku then, a nie z dowolnego tekstu reguły.
  const thenMatch = cleanBody.match(/\bthen\s*\{([\s\S]*?)\}/i);
  if (thenMatch) {
    const actionMatch = thenMatch[1].match(/\b(permit|deny)\b/i);
    if (actionMatch) rule.action = actionMatch[1].toLowerCase();
  }

  return rule;
}

/**
 * Parser plików polityk ExtremeXOS.
 *
 * Każdy blok `entry ... { ... }` jest zamieniany na jedną regułę. Pola
 * wewnątrz bloków są rozdzielane średnikami, dlatego parser obsługuje też
 * kilka pól zapisanych w jednej linii. Brakująca wartość pozostaje pustym
 * stringiem i jest prezentowana jako puste pole w tabeli.
 */
export function parsePol(content: string): ParsedPolFile {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const sourceLines = normalized.split("\n");
  const lines: ParsedLine[] = sourceLines.map((text, index) => {
    const trimmed = text.trim();
    const kind: LineKind = !trimmed
      ? "blank"
      : isComment(trimmed)
        ? "comment"
        : /^entry\s+/i.test(trimmed)
          ? "entry"
          : /\b(?:if(?:\s+match\s+(?:all|any))?|source-address|source[-\s]port|destination-address|destination[-\s]port|protocol|permit|deny)\b/i.test(trimmed)
            ? "field"
            : "text";
    return { line: index + 1, text, kind };
  });

  const rules: PolicyRule[] = [];
  const entryPattern = /^\s*entry\s+([^{}\n]+?)\s*\{/gim;
  for (const match of normalized.matchAll(entryPattern)) {
    const openingIndex = normalized.indexOf("{", match.index ?? 0);
    if (openingIndex < 0) continue;
    const closingIndex = findClosingBrace(normalized, openingIndex);
    const body = normalized.slice(openingIndex + 1, closingIndex);
    const line = normalized.slice(0, match.index ?? 0).split("\n").length;
    const name = cleanValue(match[1]);
    rules.push(parseRuleBody(body, line, name));
  }

  return {
    rules,
    lines,
    stats: {
      lines: sourceLines.length,
      comments: lines.filter((line) => line.kind === "comment").length,
      rules: rules.length,
    },
  };
}
