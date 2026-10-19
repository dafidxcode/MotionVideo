export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Strip markdown code fences from a string.
 * Handles ```tsx, ```ts, ```jsx, ```js and plain ``` fences.
 */
export function stripMarkdownFences(code: string): string {
  let result = code;
  result = result.replace(/^```(?:tsx?|jsx?)?\n?/, "");
  result = result.replace(/\n?```\s*$/, "");
  return result.trim();
}

/**
 * Lightweight validation to check if GPT response contains valid JSX and component structure.
 * Prevents false positives on TypeScript generic types (e.g. Array<string>).
 */
export function validateGptResponse(response: string): ValidationResult {
  const trimmed = response.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "The response was empty. Please try again.",
    };
  }

  // Must contain component export or declaration
  const hasComponentDecl =
    /(?:export\s+(?:default\s+)?(?:const|function)|function\s+[A-Z]\w*|const\s+[A-Z]\w*\s*=)/.test(
      trimmed,
    );

  // Check for JSX tags (avoiding false positives on generic types like Array<string>)
  const hasJsxTag =
    /<(?:[A-Z][a-zA-Z0-9]*|div|span|h[1-6]|p|svg|path|circle|rect|audio|video|img|canvas)\b[^>]*?(?:\/?>|<\/)/.test(
      trimmed,
    ) || /return\s*\(\s*</.test(trimmed);

  if (!hasComponentDecl && !hasJsxTag) {
    return {
      isValid: false,
      error:
        "The response was not a valid motion graphics component. Please try a different prompt.",
    };
  }

  return {
    isValid: true,
    error: null,
  };
}

/**
 * Extract only the component code, removing any trailing text/commentary.
 * Supports:
 * - export const Main: React.FC = () => {
 * - export const Main = () => {
 * - export function Main() {
 * - export default function Main() {
 * - export const Main = function() {
 * Uses brace counting to find the end of the component.
 */
export function extractComponentCode(code: string): string {
  // Find component declaration start across various export conventions
  const exportPattern =
    /export\s+(?:default\s+)?(?:const\s+\w+(?:\s*:\s*React\.FC(?:\s*<[^>]*>)?)?\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>\s*\{|const\s+\w+(?:\s*:\s*React\.FC(?:\s*<[^>]*>)?)?\s*=\s*function\s*\([^)]*\)\s*\{|function\s+\w+\s*\([^)]*\)\s*\{)/;

  const exportMatch = code.match(exportPattern);

  if (exportMatch && exportMatch.index !== undefined) {
    const declarationStart = exportMatch.index;
    const bodyStart = declarationStart + exportMatch[0].length;

    // Count braces to find the matching closing brace
    let braceCount = 1;
    let endIndex = bodyStart;

    for (let i = bodyStart; i < code.length; i++) {
      const char = code[i];
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (braceCount === 0) {
      // Return everything from start of code to end of component (including closing brace and semicolon)
      let result = code.slice(0, endIndex + 1);
      // Add semicolon if not present
      if (!result.trim().endsWith(";")) {
        result = result.trimEnd() + ";";
      }
      return result.trim();
    }
  }

  // Fallback: return as-is
  return code;
}
