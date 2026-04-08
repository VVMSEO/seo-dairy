import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Plus, Folder, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { ConfirmModal } from './ConfirmModal';

interface Project {
  id: string;
  name: string;
}

interface ProjectListProps {
  userId: string;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
}

export function ProjectList({ userId, selectedProjectId, onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData: Project[] = [];
      snapshot.forEach((doc) => {
        projectsData.push({ id: doc.id, name: doc.data().name });
      });
      setProjects(projectsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, [userId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await addDoc(collection(db, 'projects'), {
        name: newProjectName.trim(),
        userId,
        createdAt: serverTimestamp(),
        availableCategories: [],
        availableTags: [],
      });
      setNewProjectName('');
      setIsCreating(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setProjectToDelete(projectId);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    
    // Clear selection first to unmount ProjectView and its snapshot listeners
    if (selectedProjectId === projectToDelete) {
      onSelectProject(''); 
    }
    try {
      await deleteDoc(doc(db, 'projects', projectToDelete));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectToDelete}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Projects</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="New Project"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreateProject} className="mb-4">
            <input
              type="text"
              autoFocus
              placeholder="Project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={!newProjectName.trim()}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {projects.length === 0 && !isCreating ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No projects yet. Create one to get started.
          </div>
        ) : (
          <ul className="space-y-1">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  onClick={() => onSelectProject(project.id)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left group",
                    selectedProjectId === project.id
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Folder className={clsx("w-4 h-4 shrink-0", selectedProjectId === project.id ? "text-blue-600" : "text-gray-400")} />
                    <span className="truncate">{project.name}</span>
                  </div>
                  <div
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={!!projectToDelete}
        title="Delete Project"
        message="Are you sure you want to delete this project? All notes inside it will be lost. This action cannot be undone."
        onConfirm={confirmDeleteProject}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
}
