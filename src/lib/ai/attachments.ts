/** Text-file attachments for Aetheris — CSV/JSON/Markdown/plain text read
 *  client-side and folded into the outgoing prompt as a fenced block. Scoped
 *  to text on purpose: true multimodal (image) support would mean touching
 *  every provider adapter's request shape in providers.ts, which is a bigger,
 *  riskier change than "let the model read a file" needs to be. */

export interface FileAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
}

const MAX_FILE_SIZE = 1_500_000; // ~1.5MB of text is already a lot of tokens
const SUPPORTED_TYPES = ["text/csv", "application/json", "text/markdown", "text/plain", "text/x-markdown"];
const SUPPORTED_EXTENSIONS = [".csv", ".json", ".md", ".txt"];

function isSupported(file: File): boolean {
  if (SUPPORTED_TYPES.includes(file.type)) return true;
  return SUPPORTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

export async function readAttachment(file: File): Promise<FileAttachment | { error: string }> {
  if (!isSupported(file)) return { error: `unsupported:${file.name}` };
  if (file.size > MAX_FILE_SIZE) return { error: `toolarge:${file.name}` };
  try {
    const data = await file.text();
    return { id: crypto.randomUUID(), name: file.name, mimeType: file.type || "text/plain", size: file.size, data };
  } catch {
    return { error: `failed:${file.name}` };
  }
}

/** Fold attachments into a message's outgoing content as fenced blocks — this
 *  only touches the payload sent to the model, never the human-readable text
 *  stored in the chat session. */
export function withAttachments(text: string, attachments: FileAttachment[]): string {
  if (attachments.length === 0) return text;
  const blocks = attachments.map((a) => `File "${a.name}":\n\`\`\`\n${a.data}\n\`\`\``).join("\n\n");
  return text ? `${text}\n\n${blocks}` : blocks;
}
