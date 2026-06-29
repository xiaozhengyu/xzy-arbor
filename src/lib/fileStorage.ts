import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import {
  parseMindMapDocument,
  serializeMindMapDocument,
  validateMindMapDocument,
} from './tree';
import { MindMapDocument, MindMapDocumentError } from './types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export type OpenedMindMapFile = {
  path: string;
  document: MindMapDocument;
};

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export async function openMindMapFile(): Promise<OpenedMindMapFile | null> {
  ensureTauriRuntime();

  const selected = await open({
    multiple: false,
    filters: [{ name: 'Mind Map JSON', extensions: ['json'] }],
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  try {
    const content = await readTextFile(selected);
    return { path: selected, document: parseMindMapDocument(content) };
  } catch (error) {
    if (error instanceof MindMapDocumentError) {
      throw error;
    }

    throw new MindMapDocumentError('READ_FAILED', '无法读取文件');
  }
}

export async function saveMindMapFile(
  document: MindMapDocument,
  path: string | null,
): Promise<string | null> {
  ensureTauriRuntime();

  const targetPath = path ?? (await chooseSavePath());
  if (!targetPath) {
    return null;
  }

  try {
    validateMindMapDocument(document);
    await writeTextFile(targetPath, serializeMindMapDocument(document));
    return targetPath;
  } catch (error) {
    if (error instanceof MindMapDocumentError) {
      throw error;
    }

    throw new MindMapDocumentError('WRITE_FAILED', '无法保存文件');
  }
}

export async function saveMindMapFileAs(document: MindMapDocument): Promise<string | null> {
  return saveMindMapFile(document, null);
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new MindMapDocumentError('WRITE_FAILED', '请在 Tauri 桌面应用中使用本地文件功能');
  }
}

async function chooseSavePath(): Promise<string | null> {
  return save({
    defaultPath: 'mindmap.json',
    filters: [{ name: 'Mind Map JSON', extensions: ['json'] }],
  });
}
