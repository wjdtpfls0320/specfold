import type { Attachment } from './types';
import { uid } from './util';

async function pdfText(buf: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it: any) => ('str' in it ? it.str : '')).join(' '));
  }
  return pages.join('\n\n');
}

async function docxText(buf: ArrayBuffer) {
  const mammoth: any = await import('mammoth');
  const res = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: buf });
  return res.value as string;
}

const readDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export const ACCEPT = '.md,.markdown,.txt,.docx,.pdf,image/png,image/jpeg,image/webp,image/gif';

export async function readAttachment(f: File): Promise<Attachment> {
  const name = f.name;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (f.type.startsWith('image/')) return { id: uid('a'), name, kind: 'image', dataUrl: await readDataUrl(f) };
  if (ext === 'pdf') return { id: uid('a'), name, kind: 'text', text: await pdfText(await f.arrayBuffer()) };
  if (ext === 'docx') return { id: uid('a'), name, kind: 'text', text: await docxText(await f.arrayBuffer()) };
  return { id: uid('a'), name, kind: 'text', text: await f.text() };
}
