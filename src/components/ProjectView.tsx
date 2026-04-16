import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { NoteEditor } from './NoteEditor';
import { Plus } from 'lucide-react';
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
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

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

  const handleCreateNote = async () => {
    try {
      const docRef = await addDoc(collection(db, 'notes'), {
        projectId,
        userId,
        title: 'Новая заметка',
        content: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedNoteId(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    }
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await deleteDoc(doc(db, 'notes', noteToDelete));
      if (selectedNoteId === noteToDelete) {
        setSelectedNoteId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${noteToDelete}`);
    }
  };

  const selectedNote = notes.find(n => n.id === selectedNoteId) || null;

  return (
    <div className="flex h-full overflow-hidden bg-white">
      {/* Left Sidebar - Notes List */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50 shrink-0">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleCreateNote}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" /> Новая заметка
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notes.map(note => (
            <div
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                selectedNoteId === note.id ? 'bg-white border-l-4 border-l-yellow-400' : 'hover:bg-gray-100 border-l-4 border-l-transparent'
              }`}
            >
              <div className="font-semibold text-gray-900 truncate">{note.title || 'Новая заметка'}</div>
              <div className="text-xs text-gray-500 mt-1">{format(note.createdAt, 'dd.MM.yyyy')}</div>
              <div className="text-sm text-gray-500 truncate mt-1">
                {note.content ? note.content.replace(/<[^>]*>?/gm, '') : 'Нет текста'}
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              Нет заметок. Создайте первую!
            </div>
          )}
        </div>
      </div>

      {/* Right Area - Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {selectedNote ? (
          <NoteEditor
            projectId={projectId}
            userId={userId}
            availableCategories={projectData.availableCategories}
            availableTags={projectData.availableTags}
            existingNote={selectedNote}
            onDelete={() => setNoteToDelete(selectedNote.id)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 bg-white">
            Выберите заметку из списка или создайте новую
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!noteToDelete}
        title="Удалить заметку"
        message="Вы уверены, что хотите удалить эту заметку? Это действие нельзя отменить."
        onConfirm={confirmDeleteNote}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
}
