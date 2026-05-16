"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, Clock3, ExternalLink, FileUp, Info, Link2, MessageSquare, Paperclip, Trash2, Users, X } from "lucide-react";
import MentionInput from "@/components/mention-input";
import { resolveAvatarUrl, resolveFileUrl } from "@/components/avatar-url";

type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string | null;
  role: "ADMIN" | "MEMBER";
  approved: boolean;
};

type Status = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Task = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate?: string | null;
  reporter: User;
  assignees: { user: User }[];
  comments: { id: string; body: string; createdAt: string; author: User }[];
  attachments: { id: string; fileName: string; fileSize: number; url: string; uploadedBy: User; createdAt: string }[];
  links: { id: string; title: string; url: string; createdAt: string; author: User }[];
  activities: { id: string; action: string; message: string; createdAt: string; actor: User }[];
  createdAt: string;
  updatedAt: string;
};

const statuses: { id: Status; label: string }[] = [
  { id: "BACKLOG", label: "Backlog" },
  { id: "TODO", label: "Do zrobienia" },
  { id: "IN_PROGRESS", label: "W toku" },
  { id: "REVIEW", label: "Review" },
  { id: "DONE", label: "Gotowe" }
];

const priorities: { id: Priority; label: string }[] = [
  { id: "LOW", label: "Niski" },
  { id: "MEDIUM", label: "Sredni" },
  { id: "HIGH", label: "Wysoki" },
  { id: "URGENT", label: "Pilny" }
];

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Operacja nie powiodla sie.");
  return data;
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ user }: { user: User }) {
  const avatarUrl = resolveAvatarUrl(user.avatarUrl);
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={user.name} className="avatar" title={`${user.name} (@${user.username})`} style={{ objectFit: "cover" }} />
    );
  }
  return (
    <span className="avatar" style={{ background: user.avatarColor }} title={`${user.name} (@${user.username})`}>
      {initials(user.name)}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Brak";
  return new Date(value).toLocaleDateString("pl-PL");
}

type TaskCasePageProps = {
  caseKey: string;
  embedded?: boolean;
  onClose?: () => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
};

export default function TaskCasePage({ caseKey, embedded = false, onClose, onTaskUpdated, onTaskDeleted }: TaskCasePageProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState({ title: "", description: "", status: "TODO" as Status, priority: "MEDIUM" as Priority, dueDate: "", assigneeIds: [] as string[] });
  const [comment, setComment] = useState("");
  const [linkDraft, setLinkDraft] = useState({ title: "", url: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const taskRef = useRef<Task | null>(null);
  const draftRef = useRef(draft);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function load() {
    const [taskData, bootstrap] = await Promise.all([
      jsonFetch<{ task: Task }>(`/api/tasks/${encodeURIComponent(caseKey)}`),
      jsonFetch<{ users: User[] }>("/api/bootstrap")
    ]);
    setTask(taskData.task);
    onTaskUpdated?.(taskData.task);
    setUsers(bootstrap.users.filter((user) => user.approved));
    setDraft({
      title: taskData.task.title,
      description: taskData.task.description,
      status: taskData.task.status,
      priority: taskData.task.priority,
      dueDate: taskData.task.dueDate ? taskData.task.dueDate.slice(0, 10) : "",
      assigneeIds: taskData.task.assignees.map((item) => item.user.id)
    });
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Nie udalo sie wczytac taska."));
  }, [caseKey]);

  async function persistDraft(nextDraft = draftRef.current) {
    const currentTask = taskRef.current;
    if (!currentTask) return;
    const saveSeq = ++saveSeqRef.current;
    setSaving(true);
    setError("");
    try {
      const data = await jsonFetch<{ task: Task }>(`/api/tasks/${currentTask.id}`, {
        method: "PATCH",
        body: JSON.stringify(nextDraft)
      });
      if (saveSeq === saveSeqRef.current) {
        setTask(data.task);
        onTaskUpdated?.(data.task);
        setSavedAt(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (err) {
      if (saveSeq === saveSeqRef.current) {
        setError(err instanceof Error ? err.message : "Nie udalo sie zapisac taska.");
      }
    } finally {
      if (saveSeq === saveSeqRef.current) setSaving(false);
    }
  }

  function updateAndSave(changes: Partial<typeof draft>) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const nextDraft = { ...draftRef.current, ...changes };
    setDraft(nextDraft);
    draftRef.current = nextDraft;
    persistDraft(nextDraft);
  }

  function updateDraftWithDebouncedSave(changes: Partial<typeof draft>) {
    const nextDraft = { ...draftRef.current, ...changes };
    setDraft(nextDraft);
    draftRef.current = nextDraft;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      persistDraft(draftRef.current);
    }, 700);
  }

  function flushPendingSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      persistDraft(draftRef.current);
    }
  }

  function closeCase() {
    flushPendingSave();
    onClose?.();
  }

  async function deleteCurrentTask() {
    const currentTask = taskRef.current;
    if (!currentTask) return;
    const confirmed = window.confirm(`Bezpowrotnie usunac sprawe ${currentTask.key}? Usuniete zostana komentarze, linki, historia i zalaczniki.`);
    if (!confirmed) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    setSaving(true);
    setError("");
    try {
      await jsonFetch(`/api/tasks/${currentTask.id}`, { method: "DELETE" });
      onTaskDeleted?.(currentTask.id);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udalo sie usunac taska.");
    } finally {
      setSaving(false);
    }
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!task || !comment.trim()) return;
    const data = await jsonFetch<{ task: Task }>(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: comment })
    });
    setTask(data.task);
    onTaskUpdated?.(data.task);
    setComment("");
  }

  async function uploadFile(file: File) {
    if (!task) return;
    const form = new FormData();
    form.append("file", file);
    const data = await jsonFetch<{ task: Task }>(`/api/tasks/${task.id}/attachments`, {
      method: "POST",
      body: form
    });
    setTask(data.task);
    onTaskUpdated?.(data.task);
  }

  async function addLink(event: React.FormEvent) {
    event.preventDefault();
    if (!task || !linkDraft.title.trim() || !linkDraft.url.trim()) return;
    const data = await jsonFetch<{ task: Task }>(`/api/tasks/${task.id}/links`, {
      method: "POST",
      body: JSON.stringify(linkDraft)
    });
    setTask(data.task);
    onTaskUpdated?.(data.task);
    setLinkDraft({ title: "", url: "" });
  }

  if (error && !task) {
    return (
      <main className={embedded ? "case-shell embedded" : "case-shell"}>
        <section className="case-card">
          {embedded ? <button className="case-link button-link" onClick={closeCase}><X size={16} /> Zamknij</button> : <a className="case-link" href="/"><ArrowLeft size={16} /> Board</a>}
          <p className="error">{error}</p>
        </section>
      </main>
    );
  }

  if (!task) {
    return (
      <main className={embedded ? "case-shell embedded" : "case-shell"}>
        <section className="case-card">Ladowanie sprawy...</section>
      </main>
    );
  }

  return (
    <main className={embedded ? "case-shell embedded" : "case-shell"}>
      <header className="case-header">
        {embedded ? (
          <button className="case-link button-link" onClick={closeCase}><X size={16} /> Zamknij</button>
        ) : (
          <a className="case-link" href="/"><ArrowLeft size={16} /> Board</a>
        )}
        <div>
          <span className="case-number">Numer sprawy {task.key}</span>
          <h1>{task.title}</h1>
        </div>
        <div className="save-state">
          <CheckCircle2 size={16} />
          <span>{saving ? "Zapisywanie..." : savedAt ? `Zapisano ${savedAt}` : "Autozapis aktywny"}</span>
        </div>
        <button className="danger case-delete" onClick={deleteCurrentTask}><Trash2 size={16} /> Usun</button>
      </header>

      <section className="case-layout">
        <section className="case-main">
          <section className="case-card">
            <div className="panel-title"><Info size={18} /> Informacje i opis sprawy</div>
            <div className="case-info-grid">
              <div><span>Numer sprawy</span><strong>{task.key}</strong></div>
              <div><span>Status</span><strong>{statuses.find((item) => item.id === draft.status)?.label}</strong></div>
              <div><span>Priorytet</span><strong>{priorities.find((item) => item.id === draft.priority)?.label}</strong></div>
              <div><span>Reporter</span><strong>{task.reporter.name}</strong></div>
            </div>
            <input
              className="title-input"
              value={draft.title}
              onChange={(e) => updateDraftWithDebouncedSave({ title: e.target.value })}
              onBlur={flushPendingSave}
            />
            <textarea
              className="case-description"
              value={draft.description}
              onChange={(e) => updateDraftWithDebouncedSave({ description: e.target.value })}
              onBlur={flushPendingSave}
            />
            {error && <p className="error">{error}</p>}
          </section>

          <section className="case-card">
            <div className="panel-title"><MessageSquare size={18} /> Komentarze</div>
            <p className="muted">Wpisz `@username`, zeby pingnac osobe w komentarzu i wyslac jej powiadomienie.</p>
            <div className="case-feed">
              {task.comments.length === 0 ? <span className="muted">Brak komentarzy</span> : task.comments.map((item) => (
                <article key={item.id}>
                  <Avatar user={item.author} />
                  <div>
                    <strong>{item.author.name}</strong>
                    <span>{new Date(item.createdAt).toLocaleString("pl-PL")}</span>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
            <form className="comment-form" onSubmit={addComment}>
              <MentionInput
                placeholder="Dodaj komentarz albo ping @username..."
                value={comment}
                onChange={setComment}
                users={users}
              />
              <button>Wyslij</button>
            </form>
          </section>

          <section className="case-card">
            <div className="panel-title"><Link2 size={18} /> Linki</div>
            <form className="link-form" onSubmit={addLink}>
              <input placeholder="Nazwa linku, np. Specyfikacja" value={linkDraft.title} onChange={(e) => setLinkDraft({ ...linkDraft, title: e.target.value })} />
              <input type="url" placeholder="https://..." value={linkDraft.url} onChange={(e) => setLinkDraft({ ...linkDraft, url: e.target.value })} />
              <button><Link2 size={16} /> Dodaj link</button>
            </form>
            <div className="case-files">
              {task.links.length === 0 ? <span className="muted">Brak linkow</span> : task.links.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  <span>{link.title}</span>
                  <em>{link.author.name}</em>
                </a>
              ))}
            </div>
          </section>

          <section 
            className={`case-card ${isFileDragging ? "file-drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsFileDragging(true); }}
            onDragLeave={() => setIsFileDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsFileDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) uploadFile(file);
            }}
            style={{ position: "relative" }}
          >
            {isFileDragging && (
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(37, 99, 235, 0.1)", border: "2px dashed var(--primary)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                <strong style={{ color: "var(--primary)", fontSize: "16px", pointerEvents: "none" }}><FileUp size={24} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Upusc plik, aby dodac</strong>
              </div>
            )}
            <div className="panel-title"><Paperclip size={18} /> Pliki</div>
            <input ref={fileInput} type="file" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            <button type="button" onClick={() => fileInput.current?.click()}><FileUp size={16} /> Dodaj zalacznik</button>
            <div className="case-files">
              {task.attachments.length === 0 ? <span className="muted">Brak zalacznikow</span> : task.attachments.map((file) => (
                <a key={file.id} href={resolveFileUrl(file.url)} target="_blank" rel="noreferrer">
                  <Paperclip size={16} />
                  <span>{file.fileName}</span>
                  <em>{Math.ceil(file.fileSize / 1024)} KB</em>
                </a>
              ))}
            </div>
          </section>
        </section>

        <aside className="case-side">
          <section className="case-card">
            <div className="panel-title">Status i klasyfikacja</div>
            <label>Status<select value={draft.status} onChange={(e) => updateAndSave({ status: e.target.value as Status })}>{statuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Priorytet<select value={draft.priority} onChange={(e) => updateAndSave({ priority: e.target.value as Priority })}>{priorities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Termin<input type="date" value={draft.dueDate} onChange={(e) => updateAndSave({ dueDate: e.target.value })} /></label>
          </section>

          <section className="case-card">
            <div className="panel-title"><Users size={18} /> Osoby</div>
            <div className="case-meta-row"><span>Reporter</span><strong>{task.reporter.name}</strong></div>
            <div className="people-picker compact-list">
              {users.map((person) => (
                <label key={person.id}>
                  <input
                    type="checkbox"
                    checked={draft.assigneeIds.includes(person.id)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...draft.assigneeIds, person.id] : draft.assigneeIds.filter((id) => id !== person.id);
                      updateAndSave({ assigneeIds: next });
                    }}
                  />
                  <Avatar user={person} />
                  <span>{person.name}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="case-card">
            <div className="panel-title"><CalendarDays size={18} /> Szczegoly</div>
            <div className="case-meta-row"><span>Numer</span><strong>{task.key}</strong></div>
            <div className="case-meta-row"><span>Utworzono</span><strong>{formatDate(task.createdAt)}</strong></div>
            <div className="case-meta-row"><span>Aktualizacja</span><strong>{formatDate(task.updatedAt)}</strong></div>
            <div className="case-meta-row"><span>Termin</span><strong>{formatDate(task.dueDate)}</strong></div>
          </section>

          <section className="case-card">
            <div className="panel-title"><Clock3 size={18} /> Historia taska</div>
            <div className="timeline">
              {task.activities.length === 0 ? <span className="muted">Brak historii</span> : task.activities.map((item) => (
                <article key={item.id}>
                  <span />
                  <div>
                    <strong>{item.message}</strong>
                    <p>{item.actor.name} · {new Date(item.createdAt).toLocaleString("pl-PL")}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="case-card">
            <div className="panel-title"><Bell size={18} /> Obserwacja</div>
            <p className="muted">Wzmianki przez @username oraz zmiany przypisan sa zapisywane w historii i wysylaja powiadomienia.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
