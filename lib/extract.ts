/**
 * Text extraction. All of it runs in the browser, so lecture material never
 * leaves the machine except as the plain text the model needs.
 *
 * Every reader is imported lazily: a student who only ever pastes text should
 * not download a PDF engine.
 */

export class ExtractError extends Error {}

const PAGE_LIMIT = 120;

export function countWords(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // The worker ships with the package. This URL form is resolved at build time.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = await readArrayBuffer(file);
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  const limit = Math.min(doc.numPages, PAGE_LIMIT);

  for (let p = 1; p <= limit; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) pages.push(line);
  }

  const text = pages.join("\n\n");
  if (countWords(text) < 25) {
    throw new ExtractError(
      "This PDF holds almost no selectable text, so it is probably a scan. Paste the text instead, or use a text-based export.",
    );
  }
  return text;
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await readArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.replace(/\n{3,}/g, "\n\n").trim();
}

async function extractPptx(file: File): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await readArrayBuffer(file));

  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.replace(/\D+/g, "")) - Number(b.replace(/\D+/g, "")));

  if (slideNames.length === 0) {
    throw new ExtractError("No slides were found inside this file.");
  }

  const xmls = await Promise.all(slideNames.map((name) => zip.files[name].async("string")));

  return xmls
    .map((xml, i) => {
      const runs = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? [];
      const text = runs
        .map((run) => run.replace(/<[^>]+>/g, ""))
        .join(" ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      return text ? `Slide ${i + 1}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".pptx")) return extractPptx(file);
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
    return (await file.text()).trim();
  }
  if (name.endsWith(".doc")) {
    throw new ExtractError("Old .doc files are not readable here. Save it as .docx or PDF first.");
  }
  if (name.endsWith(".ppt")) {
    throw new ExtractError("Old .ppt files are not readable here. Save the deck as .pptx or PDF first.");
  }
  throw new ExtractError("That file type is not supported. Use a PDF, DOCX, PPTX, TXT, or MD file.");
}
