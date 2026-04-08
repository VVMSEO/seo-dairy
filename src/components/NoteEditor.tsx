import { useState, useRef, useEffect, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { X, Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Link as LinkIcon, Image as ImageIcon, Check } from 'lucide-react';

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
  existingNote?: Note | null;
  onClose: () => void;
}

export function NoteEditor({ projectId, userId, availableCategories, availableTags, existingNote, onClose }: NoteEditorProps) {
  const [title, setTitle] = useState(existingNote?.title || '');
  const [content, setContent] = useState(existingNote?.content || '');
  const [category, setCategory] = useState(existingNote?.category || '');
  const [tags, setTags] = useState<string[]>(existingNote?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(existingNote?.id || null);
  const [lastSaved, setLastSaved] = useState<Date | null>(existingNote?.updatedAt || null);
  const [insertDialog, setInsertDialog] = useState<{type: 'link' | 'image', text: string, url: string} | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveNote = useCallback(async () => {
    if (!title.trim() && !content.trim() && !category.trim() && tags.length === 0) return;
    
    setIsSaving(true);
    try {
      const finalCategory = category.trim();
      let currentNoteId = noteId;

      if (!currentNoteId) {
        const noteData: any = {
          projectId,
          title: title.trim(),
          content: content.trim(),
          userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (finalCategory) noteData.category = finalCategory;
        if (tags.length > 0) noteData.tags = tags;

        const docRef = await addDoc(collection(db, 'notes'), noteData);
        currentNoteId = docRef.id;
        setNoteId(currentNoteId);
      } else {
        const updateData: any = {
          title: title.trim(),
          content: content.trim(),
          updatedAt: serverTimestamp(),
        };
        if (finalCategory) {
          updateData.category = finalCategory;
        } else {
          updateData.category = deleteField();
        }
        
        if (tags.length > 0) {
          updateData.tags = tags;
        } else {
          updateData.tags = deleteField();
        }
        
        await updateDoc(doc(db, 'notes', currentNoteId), updateData);
      }

      setLastSaved(new Date());

      // Update project's available tags/categories if there are new ones
      const projectRef = doc(db, 'projects', projectId);
      const updates: any = {};
      
      if (finalCategory && !availableCategories.includes(finalCategory)) {
        updates.availableCategories = arrayUnion(finalCategory);
      }
      
      const newTags = tags.filter(t => !availableTags.includes(t));
      if (newTags.length > 0) {
        updates.availableTags = arrayUnion(...newTags);
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(projectRef, updates);
      }

    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [title, content, category, tags, noteId, projectId, userId, availableCategories, availableTags]);

  // Auto-save effect
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Don't auto-save if everything is empty and it's a new note
    if (!noteId && !title.trim() && !content.trim() && !category.trim() && tags.length === 0) {
      return;
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, category, tags, saveNote, noteId]);

  const handleClose = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (title.trim() || content.trim() || category.trim() || tags.length > 0) {
      await saveNote();
    }
    onClose();
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !tags.includes(newTag) && tags.length < 20) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

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

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden max-w-4xl mx-auto">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">{existingNote ? 'Edit Note' : 'New Note'}</h3>
        <div className="flex items-center gap-3 text-sm">
          {isSaving ? (
            <span className="text-gray-500 flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </span>
          ) : lastSaved ? (
            <span className="text-green-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Saved
            </span>
          ) : null}
        </div>
      </div>
      
      <div className="p-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            autoFocus={!existingNote}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Keyword Research for Q3"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              id="category"
              type="text"
              list="categories-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Select or type new category"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <datalist id="categories-list">
              {availableCategories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags (Press Enter to add)
            </label>
            <input
              id="tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type tag and press Enter"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {availableTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-gray-500 mr-1">Suggested:</span>
                {availableTags.filter(t => !tags.includes(t)).slice(0, 5).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTags([...tags, tag])}
                    className="text-xs text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
            <span>Content</span>
            <span className="text-gray-400 font-normal text-xs">Markdown supported</span>
          </label>
          <div className="border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
              <button type="button" onClick={() => applyFormat('**', '**', 'bold text')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Bold"><Bold className="w-4 h-4" /></button>
              <button type="button" onClick={() => applyFormat('_', '_', 'italic text')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Italic"><Italic className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <button type="button" onClick={() => applyFormat('# ', '', 'Heading 1')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Heading 1"><Heading1 className="w-4 h-4" /></button>
              <button type="button" onClick={() => applyFormat('## ', '', 'Heading 2')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Heading 2"><Heading2 className="w-4 h-4" /></button>
              <button type="button" onClick={() => applyFormat('### ', '', 'Heading 3')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Heading 3"><Heading3 className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <button type="button" onClick={() => applyFormat('- ', '', 'List item')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Bullet List"><List className="w-4 h-4" /></button>
              <button type="button" onClick={() => applyFormat('1. ', '', 'List item')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <button type="button" onClick={() => applyFormat('> ', '', 'Quote')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Quote"><Quote className="w-4 h-4" /></button>
              <button type="button" onClick={() => applyFormat('\n```\n', '\n```\n', 'code block')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Code Block"><Code className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <button type="button" onClick={() => handleOpenInsertDialog('link')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Link"><LinkIcon className="w-4 h-4" /></button>
              <button type="button" onClick={() => handleOpenInsertDialog('image')} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Image"><ImageIcon className="w-4 h-4" /></button>
            </div>
            <textarea
              ref={textareaRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here... You can use Markdown for lists, tables, links, and images."
              rows={12}
              className="w-full px-4 py-3 border-0 focus:ring-0 font-mono text-sm resize-y outline-none"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Done
          </button>
        </div>
      </div>

      {insertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {insertDialog.type === 'link' ? 'Insert Link' : 'Insert Image'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {insertDialog.type === 'link' ? 'Link Text' : 'Alt Text'}
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
                Cancel
              </button>
              <button
                onClick={() => {
                  const md = insertDialog.type === 'link' 
                    ? `[${insertDialog.text || 'link'}](${insertDialog.url})`
                    : `![${insertDialog.text || 'image'}](${insertDialog.url})`;
                  insertMarkdown(md);
                  setInsertDialog(null);
                }}
                disabled={!insertDialog.url}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
