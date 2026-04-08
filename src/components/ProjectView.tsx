import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { NoteEditor } from './NoteEditor';
import { Plus, Filter, X, Tag, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx } from 'clsx';
import { ConfirmModal } from './ConfirmModal';

interface Note {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectData {
  name: string;
  availableCategories: string[];
  availableTags: string[];
}

interface ProjectViewProps {
  projectId: string;
  userId: string;
}

export function ProjectView({ projectId, userId }: ProjectViewProps) {
  const [projectData, setProjectData] = useState<ProjectData>({ name: '', availableCategories: [], availableTags: [] });
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Fetch project details
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'projects', projectId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProjectData({
          name: data.name,
          availableCategories: data.availableCategories || [],
          availableTags: data.availableTags || [],
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}`);
    });

    return () => unsubscribe();
  }, [projectId]);

  // Fetch notes
  useEffect(() => {
    const q = query(
      collection(db, 'notes'),
      where('projectId', '==', projectId),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData: Note[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        notesData.push({
          id: doc.id,
          title: data.title,
          content: data.content,
          category: data.category,
          tags: data.tags || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });
      setNotes(notesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes');
    });

    return () => unsubscribe();
  }, [projectId, userId]);

  const handleDeleteNote = (noteId: string) => {
    setNoteToDelete(noteId);
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await deleteDoc(doc(db, 'notes', noteToDelete));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${noteToDelete}`);
    }
  };

  const toggleFilterTag = (tag: string) => {
    setFilterTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterTags([]);
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      if (filterCategory && note.category !== filterCategory) return false;
      if (filterTags.length > 0) {
        if (!note.tags) return false;
        // Note must have ALL selected tags
        if (!filterTags.every(t => note.tags!.includes(t))) return false;
      }
      return true;
    });
  }, [notes, filterCategory, filterTags]);

  // Group notes by month
  const groupedNotes = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    filteredNotes.forEach(note => {
      const monthKey = format(note.createdAt, 'yyyy-MM'); // e.g., "2026-04"
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(note);
    });
    return groups;
  }, [filteredNotes]);

  const monthKeys = useMemo(() => Object.keys(groupedNotes).sort((a, b) => b.localeCompare(a)), [groupedNotes]);

  // Auto-select the most recent month if none is selected
  useEffect(() => {
    if (monthKeys.length > 0 && (!selectedMonth || !monthKeys.includes(selectedMonth))) {
      setSelectedMonth(monthKeys[0]);
    } else if (monthKeys.length === 0) {
      setSelectedMonth(null);
    }
  }, [monthKeys, selectedMonth]);

  const displayedNotes = selectedMonth ? groupedNotes[selectedMonth] || [] : [];

  const activeFilterCount = (filterCategory ? 1 : 0) + filterTags.length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{projectData.name || 'Loading...'}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium border",
              activeFilterCount > 0 || isFilterOpen
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            )}
          >
            <Filter className="w-4 h-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsCreatingNote(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Note
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Categories</option>
                {projectData.availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {projectData.availableTags.length === 0 ? (
                  <span className="text-sm text-gray-500 italic py-2">No tags available</span>
                ) : (
                  projectData.availableTags.map(tag => {
                    const isSelected = filterTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleFilterTag(tag)}
                        className={clsx(
                          "px-3 py-1 text-sm rounded-full border transition-colors",
                          isSelected
                            ? "bg-blue-100 border-blue-300 text-blue-800"
                            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {monthKeys.length > 0 && (
        <div className="px-6 pt-4 border-b border-gray-200 bg-gray-50/50 shrink-0 overflow-x-auto">
          <div className="flex gap-6">
            {monthKeys.map(monthKey => {
              const [year, month] = monthKey.split('-');
              const date = new Date(parseInt(year), parseInt(month) - 1);
              const label = format(date, 'MMMM yyyy');
              
              return (
                <button
                  key={monthKey}
                  onClick={() => setSelectedMonth(monthKey)}
                  className={clsx(
                    "pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    selectedMonth === monthKey
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  {label}
                  <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                    {groupedNotes[monthKey].length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {(isCreatingNote || editingNote) && (
          <div className="mb-8">
            <NoteEditor 
              projectId={projectId} 
              userId={userId} 
              availableCategories={projectData.availableCategories}
              availableTags={projectData.availableTags}
              existingNote={editingNote}
              onClose={() => {
                setIsCreatingNote(false);
                setEditingNote(null);
              }} 
            />
          </div>
        )}

        {!(isCreatingNote || editingNote) && filteredNotes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {notes.length === 0 ? (
              <>
                <p>No notes in this project yet.</p>
                <button 
                  onClick={() => setIsCreatingNote(true)}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  Create your first note
                </button>
              </>
            ) : (
              <p>No notes match your current filters.</p>
            )}
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {displayedNotes.map(note => (
              <div key={note.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {note.title || 'Untitled Note'}
                      {note.category && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">
                          {note.category}
                        </span>
                      )}
                    </h3>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                            <Tag className="w-3 h-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm whitespace-nowrap">
                      {format(note.createdAt, 'MMM d, yyyy • h:mm a')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setEditingNote(note)} 
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteNote(note.id)} 
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6 prose prose-blue max-w-none prose-sm sm:prose-base">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {note.content || '*Empty note*'}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!noteToDelete}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        onConfirm={confirmDeleteNote}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
}
