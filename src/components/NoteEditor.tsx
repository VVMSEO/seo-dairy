import { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code, Link as LinkIcon, Image as ImageIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';

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
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [insertDialog, setInsertDialog] = useState<{type: 'link' | 'image', text: string, url: string} | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image,
      Placeholder.configure({
        placeholder: 'Начните писать...',
      }),
    ],
    content: '',
    onUpdate: () => {
      // Trigger save on content change
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNote();
      }, 1000);
    },
  });

  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title || '');
      setLastSaved(existingNote.updatedAt || null);
      
      if (editor) {
        // Check if content is markdown or HTML
        const content = existingNote.content || '';
        if (content && !content.startsWith('<') && (content.includes('**') || content.includes('#') || content.includes('- '))) {
          // It's likely markdown, parse it
          const html = marked.parse(content) as string;
          editor.commands.setContent(html);
        } else {
          editor.commands.setContent(content);
        }
      }
    }
  }, [existingNote?.id, editor]);

  const saveNote = useCallback(async () => {
    if (!existingNote || !editor) return;

    setIsSaving(true);
    try {
      const updateData: any = {
        title: title.trim(),
        content: editor.getHTML(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'notes', existingNote.id), updateData);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [title, editor, existingNote?.id]);

  // Title auto-save
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (existingNote && title !== (existingNote.title || '')) {
        saveNote();
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, saveNote, existingNote]);

  const handleOpenInsertDialog = (type: 'link' | 'image') => {
    if (!editor) return;
    
    let selectedText = '';
    if (type === 'link') {
      const { from, to } = editor.state.selection;
      selectedText = editor.state.doc.textBetween(from, to, ' ');
    }
    
    setInsertDialog({ type, text: selectedText, url: '' });
  };

  if (!existingNote || !editor) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1 flex-wrap">
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleBold().run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Жирный"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleItalic().run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Курсив"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleStrike().run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('strike') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Зачеркнутый"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Заголовок 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Заголовок 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Заголовок 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleBulletList().run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Маркированный список"
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleOrderedList().run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Нумерованный список"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleTaskList().run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('taskList') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Чек-лист"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleBlockquote().run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('blockquote') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Цитата"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('codeBlock') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Блок кода"
          >
            <Code className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button 
            type="button" 
            onClick={() => handleOpenInsertDialog('link')} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('link') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Ссылка"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => handleOpenInsertDialog('image')} 
            className={`p-1.5 rounded transition-colors ${editor.isActive('image') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} 
            title="Изображение"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
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

        <div className="prose max-w-none">
          <EditorContent editor={editor} />
        </div>
      </div>

      {insertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {insertDialog.type === 'link' ? 'Вставить ссылку' : 'Вставить изображение'}
            </h3>
            <div className="space-y-4">
              {insertDialog.type === 'link' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Текст ссылки
                  </label>
                  <input
                    type="text"
                    value={insertDialog.text}
                    onChange={(e) => setInsertDialog({ ...insertDialog, text: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
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
                  if (insertDialog.type === 'link') {
                    if (insertDialog.url === '') {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    } else {
                      editor.chain().focus().extendMarkRange('link').setLink({ href: insertDialog.url }).run();
                    }
                  } else {
                    editor.chain().focus().setImage({ src: insertDialog.url }).run();
                  }
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
