import { useState, useRef, useEffect, useCallback } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Link as LinkIcon, Image as ImageIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Note {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface NoteEditorProps {
  projectId: string;
  userId: string;
  availableCategories: string[];
  availableTags: string[];
  existingNote: Note;
  onDelete: () => void;
}

export function NoteEditor({ projectId, userId, availableCategories, availableTags, existingNote, onDelete }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [insertDialog, setInsertDialog] = useState<{type: 'link' | 'image', text: string, url: string} | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title || '');
      setContent(existingNote.content || '');
      setLastSaved(existingNote.updatedAt || null);
    }
  }, [existingNote?.id]);

  const saveNote = useCallback(async () => {
    if (!existingNote) return;

    setIsSaving(true);
    try {
      const updateData: any = {
        title: title.trim(),
        content: content.trim(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'notes', existingNote.id), updateData);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [title, content, existingNote?.id]);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (existingNote && (
        title !== (existingNote.title || '') ||
        content !== (existingNote.content || '')
      )) {
        saveNote();
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, saveNote, existingNote]);

  const applyFormat = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || defaultText;
    
    const before = content.substring(0, start);
    const after = content.substring(end);
    
    const newText = before + prefix + selectedText + suffix + after;
    setContent(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const insertMarkdown = (markdown: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const before = content.substring(0, start);
    const after = content.substring(end);

    const newText = before + markdown + after;
    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + markdown.length, start + markdown.length);
    }, 0);
  };

  const handleOpenInsertDialog = (type: 'link' | 'image') => {
    const textarea = textareaRef.current;
    let selectedText = '';
    if (textarea) {
      selectedText = content.substring(textarea.selectionStart, textarea.selectionEnd);
    }
    setInsertDialog({ type, text: selectedText, url: '' });
  };

  if (!existingNote) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => applyFormat('**', '**', 'жирный текст')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Жирный"><Bold className="w-4 h-4" /></button>
          <button type="button" onClick={() => applyFormat('_', '_', 'курсив')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Курсив"><Italic className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button type="button" onClick={() => applyFormat('# ', '', 'Заголовок 1')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Заголовок 1"><Heading1 className="w-4 h-4" /></button>
          <button type="button" onClick={() => applyFormat('## ', '', 'Заголовок 2')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Заголовок 2"><Heading2 className="w-4 h-4" /></button>
          <button type="button" onClick={() => applyFormat('### ', '', 'Заголовок 3')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Заголовок 3"><Heading3 className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button type="button" onClick={() => applyFormat('- ', '', 'Элемент списка')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Маркированный список"><List className="w-4 h-4" /></button>
          <button type="button" onClick={() => applyFormat('1. ', '', 'Элемент списка')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Нумерованный список"><ListOrdered className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button type="button" onClick={() => applyFormat('> ', '', 'Цитата')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Цитата"><Quote className="w-4 h-4" /></button>
          <button type="button" onClick={() => applyFormat('\n```\n', '\n```\n', 'код')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Блок кода"><Code className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button type="button" onClick={() => handleOpenInsertDialog('link')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Ссылка"><LinkIcon className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleOpenInsertDialog('image')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Изображение"><ImageIcon className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-4">
          {isSaving ? (
            <span className="text-xs text-gray-400">Сохранение...</span>
          ) : lastSaved ? (
            <span className="text-xs text-gray-400">Сохранено</span>
          ) : null}
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Удалить заметку">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
        <div className="text-sm text-gray-400 mb-6">
          Создано: {format(existingNote.createdAt, "d MMMM yyyy 'г. в' HH:mm", { locale: ru })}
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          className="w-full text-4xl font-bold text-gray-900 placeholder-gray-300 border-none focus:ring-0 px-0 mb-6 bg-transparent outline-none"
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Начните писать..."
          className="w-full h-full min-h-[500px] text-gray-800 border-none focus:ring-0 px-0 resize-none bg-transparent outline-none prose max-w-none"
        />
      </div>

      {insertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {insertDialog.type === 'link' ? 'Вставить ссылку' : 'Вставить изображение'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {insertDialog.type === 'link' ? 'Текст ссылки' : 'Альтернативный текст'}
                </label>
                <input
                  type="text"
                  value={insertDialog.text}
                  onChange={(e) => setInsertDialog({ ...insertDialog, text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  value={insertDialog.url}
                  onChange={(e) => setInsertDialog({ ...insertDialog, url: e.target.value })}
                  placeholder="https://"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setInsertDialog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  const md = insertDialog.type === 'link' 
                    ? `[${insertDialog.text || 'ссылка'}](${insertDialog.url})`
                    : `![${insertDialog.text || 'изображение'}](${insertDialog.url})`;
                  insertMarkdown(md);
                  setInsertDialog(null);
                }}
                disabled={!insertDialog.url}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Вставить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
