import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  addLabel as svcAddLabel,
  archiveTask as svcArchiveTask,
  createProject as svcCreateProject,
  createTask as svcCreateTask,
  deleteLabel as svcDeleteLabel,
  deleteProject as svcDeleteProject,
  deleteTask as svcDeleteTask,
  migrate,
  moveTask as svcMoveTask,
  unarchiveTask as svcUnarchiveTask,
  updateLabel as svcUpdateLabel,
  updateProject as svcUpdateProject,
  updateTask as svcUpdateTask,
  type ProjectInput,
  type TaskInput,
} from "./service";
import { emptyBoard, makeId, type BoardData, type Project, type ProjectLabel, type Task, type TaskStatus } from "./types";

export const BOARD_STORAGE_KEY = "kairos.board.v1";
/** Fired by the sync engine after it rewrites localStorage with remote data;
 *  the store re-hydrates in place (no reload needed — single-domain luxury). */
export const BOARD_PULLED_EVENT = "kairos:board-pulled";

function readStored(): BoardData {
  try {
    const raw = localStorage.getItem(BOARD_STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : emptyBoard();
  } catch {
    return emptyBoard();
  }
}

interface BoardCtx {
  data: BoardData;
  createProject: (input: ProjectInput) => string;
  updateProject: (id: string, patch: Partial<Pick<Project, "name" | "description" | "color" | "archivedAt">>) => void;
  deleteProject: (id: string) => void;
  addLabel: (projectId: string, input: { name: string; color: string }) => string;
  updateLabel: (projectId: string, labelId: string, patch: Partial<Pick<ProjectLabel, "name" | "color">>) => void;
  deleteLabel: (projectId: string, labelId: string) => void;
  createTask: (input: TaskInput) => string;
  updateTask: (id: string, patch: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "dueDate" | "labels" | "checklist">>) => void;
  moveTask: (id: string, toStatus: TaskStatus, toIndex: number) => void;
  deleteTask: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  /** Replace the whole board (Aetheris actions, imports). */
  replaceBoard: (next: BoardData) => void;
}

const Ctx = createContext<BoardCtx | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BoardData>(readStored);

  // Write-through persistence: the sync engine mirrors this key to Supabase.
  useEffect(() => {
    try {
      localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or unavailable — keep running in memory */
    }
  }, [data]);

  // Re-hydrate after a cloud pull, and converge across tabs of the same browser.
  useEffect(() => {
    const rehydrate = () => setData(readStored());
    const onStorage = (e: StorageEvent) => {
      if (e.key === BOARD_STORAGE_KEY) rehydrate();
    };
    window.addEventListener(BOARD_PULLED_EVENT, rehydrate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(BOARD_PULLED_EVENT, rehydrate);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const createProject = useCallback((input: ProjectInput) => {
    const id = makeId();
    setData((d) => svcCreateProject(d, input, id).data);
    return id;
  }, []);

  const updateProject = useCallback<BoardCtx["updateProject"]>((id, patch) => {
    setData((d) => svcUpdateProject(d, id, patch));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setData((d) => svcDeleteProject(d, id));
  }, []);

  const addLabel = useCallback((projectId: string, input: { name: string; color: string }) => {
    const id = makeId();
    setData((d) => svcAddLabel(d, projectId, input, id).data);
    return id;
  }, []);

  const updateLabel = useCallback<BoardCtx["updateLabel"]>((projectId, labelId, patch) => {
    setData((d) => svcUpdateLabel(d, projectId, labelId, patch));
  }, []);

  const deleteLabel = useCallback((projectId: string, labelId: string) => {
    setData((d) => svcDeleteLabel(d, projectId, labelId));
  }, []);

  const replaceBoard = useCallback((next: BoardData) => {
    setData(migrate(next));
  }, []);

  const createTask = useCallback((input: TaskInput) => {
    const id = makeId();
    setData((d) => svcCreateTask(d, input, id).data);
    return id;
  }, []);

  const updateTask = useCallback<BoardCtx["updateTask"]>((id, patch) => {
    setData((d) => svcUpdateTask(d, id, patch));
  }, []);

  const moveTask = useCallback((id: string, toStatus: TaskStatus, toIndex: number) => {
    setData((d) => svcMoveTask(d, id, toStatus, toIndex));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setData((d) => svcDeleteTask(d, id));
  }, []);

  const archiveTask = useCallback((id: string) => {
    setData((d) => svcArchiveTask(d, id));
  }, []);

  const unarchiveTask = useCallback((id: string) => {
    setData((d) => svcUnarchiveTask(d, id));
  }, []);

  return (
    <Ctx.Provider
      value={{
        data, createProject, updateProject, deleteProject,
        addLabel, updateLabel, deleteLabel,
        createTask, updateTask, moveTask, deleteTask, archiveTask, unarchiveTask, replaceBoard,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useBoard(): BoardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoard must be used within BoardProvider");
  return ctx;
}
