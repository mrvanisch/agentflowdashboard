"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  FileUp,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  UserPlus,
  Users
} from "lucide-react";
import TaskCasePage from "@/components/task-case-page";

type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarColor: string;
  role: "ADMIN" | "MEMBER";
  approved: boolean;
  mustChangePassword?: boolean;
};

type Project = {
  id: string;
  name: string;
  key: string;
  description?: string | null;
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
  links?: { id: string; title: string; url: string; createdAt: string; author: User }[];
  activities: { id: string; action: string; message: string; createdAt: string; actor: User }[];
  createdAt: string;
  updatedAt: string;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  taskId?: string | null;
  createdAt: string;
};

type AuditLog = {
  id: string;
  userId: string | null;
  user: User | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

const statuses: { id: Status; label: string }[] = [
  { id: "BACKLOG", label: "Backlog" },
  { id: "TODO", label: "Do zrobienia" },
  { id: "IN_PROGRESS", label: "W toku" },
  { id: "REVIEW", label: "Review" },
  { id: "DONE", label: "Gotowe" },
  { id: "BLOCKED", label: "Blokada" }
];

const priorities: { id: Priority; label: string }[] = [
  { id: "LOW", label: "Niski" },
  { id: "MEDIUM", label: "Sredni" },
  { id: "HIGH", label: "Wysoki" },
  { id: "URGENT", label: "Pilny" }
];

const priorityLabel: Record<Priority, string> = {
  LOW: "Niski",
  MEDIUM: "Sredni",
  HIGH: "Wysoki",
  URGENT: "Pilny"
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ user }: { user: User }) {
  return (
    <span className="avatar" style={{ background: user.avatarColor }} title={`${user.name} (@${user.username})`}>
      {initials(user.name)}
    </span>
  );
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Operacja nie powiodla sie.");
  return data;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openCaseKey, setOpenCaseKey] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);
  const [view, setView] = useState<"board" | "people" | "notifications" | "history" | "admin" | "audit">("board");
  const [mode, setMode] = useState<"login" | "register">("register");
  const [auth, setAuth] = useState({ name: "", username: "", email: "", password: "", token: "" });
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Priority,
    status: "TODO" as Status,
    dueDate: "",
    assigneeIds: [] as string[]
  });
  const [comment, setComment] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [newPassword, setNewPassword] = useState("");
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = tasks.find((task) => task.id === selectedId) || tasks[0] || null;
  const unread = notifications.filter((item) => !item.read).length;
  const approvedUsers = users.filter((person) => person.approved);
  const pendingUsers = users.filter((person) => !person.approved);
  const allActivities = tasks
    .flatMap((task) => task.activities.map((activity) => ({ ...activity, taskKey: task.key, taskTitle: task.title })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredTasks = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tasks;
    return tasks.filter((task) =>
      `${task.key} ${task.title} ${task.description} ${task.assignees.map((item) => item.user.name).join(" ")}`
        .toLowerCase()
        .includes(term)
    );
  }, [query, tasks]);

  async function load() {
    const data = await jsonFetch<{
      user: User;
      users: User[];
      projects: Project[];
      tasks: Task[];
      notifications: Notification[];
    }>("/api/bootstrap");
    setUser(data.user);
    setUsers(data.users);
    setProjects(data.projects);
    setTasks(data.tasks);
    setNotifications(data.notifications);
    setSelectedId((current) => current || data.tasks[0]?.id || null);
  }

  async function fetchRegistrationToken() {
    if (user?.role !== "ADMIN") return;
    try {
      const data = await jsonFetch<{ token: string | null }>("/api/admin/registration-token");
      setRegistrationToken(data.token);
    } catch (err) {
      console.error("Failed to load registration token:", err);
    }
  }

  async function regenerateToken() {
    if (!confirm("Czy na pewno chcesz wygenerowac nowy token rejestracji? Stary przestanie dzialac.")) return;
    try {
      const data = await jsonFetch<{ token: string }>("/api/admin/registration-token", { method: "POST" });
      setRegistrationToken(data.token);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Blad podczas generowania tokenu.");
    }
  }

  async function deleteToken() {
    if (!confirm("Czy na pewno chcesz calkowicie usunac token? Spowoduje to ZABLOKOWANIE mozliwosci rejestracji nowych kont.")) return;
    try {
      await jsonFetch("/api/admin/registration-token", { method: "DELETE" });
      setRegistrationToken(null);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Blad podczas usuwania tokenu.");
    }
  }

  async function loadAuditLogs() {
    if (user?.role !== "ADMIN") return;
    try {
      const logsData = await jsonFetch<{ logs: AuditLog[] }>("/api/admin/audit-logs");
      setAuditLogs(logsData.logs);
      const blocksData = await jsonFetch<{ blocks: { ipAddress: string }[] }>("/api/admin/ip-blocks");
      setBlockedIps(blocksData.blocks.map((b) => b.ipAddress));
    } catch (err) {
      console.error("Failed to load audit logs or ip blocks:", err);
    }
  }

  async function toggleIpBlock(ip: string) {
    if (!ip) return;
    const isBlocked = blockedIps.includes(ip);
    try {
      if (isBlocked) {
        await jsonFetch(`/api/admin/ip-blocks/${encodeURIComponent(ip)}`, { method: "DELETE" });
        setBlockedIps((prev) => prev.filter((b) => b !== ip));
      } else {
        await jsonFetch("/api/admin/ip-blocks", { method: "POST", body: JSON.stringify({ ipAddress: ip, reason: "Zablokowane przez administratora" }) });
        setBlockedIps((prev) => [...prev, ip]);
      }
    } catch (err) {
      console.error("Failed to toggle IP block", err);
    }
  }

  useEffect(() => {
    jsonFetch<{ user: User | null }>("/api/auth/me")
      .then((data) => {
        if (data.user) {
          load().finally(() => setAuthChecked(true));
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => setAuthChecked(true));
  }, []);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = mode === "login" ? { email: auth.email, password: auth.password } : auth;
      const result = await jsonFetch<{ pendingApproval?: boolean }>(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(payload) });
      if (result.pendingApproval) {
        setMode("login");
        setError("Konto utworzone. Poczekaj, az admin je zaakceptuje.");
        setSaving(false);
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blad logowania.");
    } finally {
      setSaving(false);
    }
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await jsonFetch<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(draft) });
      setTasks((items) => [data.task, ...items]);
      setSelectedId(data.task.id);
      setDraft({ title: "", description: "", priority: "MEDIUM", status: "TODO", dueDate: "", assigneeIds: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udalo sie utworzyc taska.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: string, changes: Partial<typeof draft>) {
    const current = tasks.find((task) => task.id === id);
    if (!current) return;
    setTasks((items) =>
      items.map((task) => {
        if (task.id !== id) return task;
        const assigneeIds = changes.assigneeIds;
        return {
          ...task,
          ...("title" in changes ? { title: changes.title || "" } : {}),
          ...("description" in changes ? { description: changes.description || "" } : {}),
          ...("priority" in changes && changes.priority ? { priority: changes.priority } : {}),
          ...("status" in changes && changes.status ? { status: changes.status } : {}),
          ...("dueDate" in changes ? { dueDate: changes.dueDate || null } : {}),
          ...(assigneeIds
            ? { assignees: users.filter((person) => assigneeIds.includes(person.id)).map((person) => ({ user: person })) }
            : {})
        };
      })
    );
    const payload = {
      title: current.title,
      description: current.description,
      priority: current.priority,
      status: current.status,
      dueDate: current.dueDate ? current.dueDate.slice(0, 10) : "",
      assigneeIds: current.assignees.map((item) => item.user.id),
      ...changes
    };
    const data = await jsonFetch<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setTasks((items) => items.map((task) => (task.id === id ? data.task : task)));
  }

  async function moveTaskToStatus(taskId: string, status: Status) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    setSelectedId(taskId);
    setDragOverStatus(null);
    await updateTask(taskId, { status });
  }

  function mergeUpdatedTask(updatedTask: Task) {
    setTasks((items) => items.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
    setSelectedId(updatedTask.id);
  }

  async function deleteTask(id: string) {
    if (!confirm("Czy na pewno chcesz bezpowrotnie usunac to zadanie?")) return;
    try {
      await jsonFetch(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((items) => items.filter((task) => task.id !== id));
      if (selectedId === id) {
        setSelectedId(tasks.filter(t => t.id !== id)[0]?.id || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udalo sie usunac taska.");
    }
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !comment.trim()) return;
    const data = await jsonFetch<{ task: Task }>(`/api/tasks/${selected.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: comment })
    });
    setTasks((items) => items.map((task) => (task.id === selected.id ? data.task : task)));
    setComment("");
  }

  async function uploadFile(file: File) {
    if (!selected) return;
    const form = new FormData();
    form.append("file", file);
    const data = await jsonFetch<{ task: Task }>(`/api/tasks/${selected.id}/attachments`, {
      method: "POST",
      body: form
    });
    setTasks((items) => items.map((task) => (task.id === selected.id ? data.task : task)));
  }

  async function logout() {
    await jsonFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAuthChecked(true);
    setTasks([]);
    setNotifications([]);
  }

  async function approveUser(userId: string) {
    const data = await jsonFetch<{ user: User }>(`/api/admin/users/${userId}/approve`, { method: "PATCH" });
    setUsers((items) => items.map((item) => (item.id === userId ? data.user : item)));
  }

  async function updateAdminUser(userId: string, changes: Partial<Pick<User, "name" | "role" | "approved" | "mustChangePassword">>) {
    setAdminError("");
    try {
      const data = await jsonFetch<{ user: User }>(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(changes)
      });
      setUsers((items) => items.map((item) => (item.id === userId ? data.user : item)));
      if (user?.id === userId) setUser({ ...user, ...data.user });
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Nie udalo sie zaktualizowac uzytkownika.");
    }
  }

  async function resetUserPassword(userId: string) {
    const password = resetPasswords[userId]?.trim();
    if (!password) {
      setAdminError("Podaj nowe haslo przed resetem.");
      return;
    }
    setAdminError("");
    try {
      const data = await jsonFetch<{ user: User }>(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password })
      });
      setUsers((items) => items.map((item) => (item.id === userId ? data.user : item)));
      setResetPasswords((items) => ({ ...items, [userId]: "" }));
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Nie udalo sie zresetowac hasla.");
    }
  }

  async function deleteUser(userId: string) {
    const target = users.find((item) => item.id === userId);
    if (!target) return;
    const confirmed = window.confirm(`Usunac konto ${target.name} (@${target.username})? Tej operacji nie da sie cofnac.`);
    if (!confirmed) return;
    setAdminError("");
    try {
      await jsonFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      setUsers((items) => items.filter((item) => item.id !== userId));
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Nie udalo sie usunac uzytkownika.");
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await jsonFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ newPassword }) });
      if (user) setUser({ ...user, mustChangePassword: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blad podczas zmiany hasla.");
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand-row">
            <span className="brand-mark"><LayoutDashboard size={24} /></span>
            <div>
              <h1>AgentFlowDashboard</h1>
              <p>Ladowanie sesji...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand-row">
            <span className="brand-mark"><LayoutDashboard size={24} /></span>
            <div>
              <h1>AgentFlowDashboard</h1>
              <p>Zespolowe taski, statusy, pliki, komentarze i historia zmian.</p>
            </div>
          </div>
          <div className="auth-tabs">
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Rejestracja</button>
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Logowanie</button>
          </div>
          <form onSubmit={submitAuth} className="auth-form">
            {mode === "register" && (
              <>
                <input required placeholder="Imie i nazwisko" value={auth.name} onChange={(e) => setAuth({ ...auth, name: e.target.value })} />
                <input required placeholder="Nazwa uzytkownika" value={auth.username} onChange={(e) => setAuth({ ...auth, username: e.target.value })} />
                <input required placeholder="Token rejestracji z logow serwera" value={auth.token} onChange={(e) => setAuth({ ...auth, token: e.target.value })} />
              </>
            )}
            <input required type="email" placeholder="Email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} />
            <input required type="password" minLength={6} placeholder="Haslo" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} />
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={saving}>{saving ? "Zapisywanie..." : mode === "register" ? "Utworz konto" : "Zaloguj"}</button>
          </form>
        </section>
      </main>
    );
  }

  if (user.mustChangePassword) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand-row">
            <span className="brand-mark"><ShieldAlert size={24} /></span>
            <div>
              <h1>Wymagana zmiana hasla</h1>
              <p>Zmien domyslne haslo administratora, aby kontynuowac.</p>
            </div>
          </div>
          <form onSubmit={changePassword} className="auth-form" style={{ marginTop: '2rem' }}>
            <input required type="password" minLength={6} placeholder="Nowe haslo" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={saving}>{saving ? "Zapisywanie..." : "Zmien haslo"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row compact">
          <span className="brand-mark"><LayoutDashboard size={22} /></span>
          <strong>AgentFlowDashboard</strong>
        </div>
        <nav>
          <button className={view === "board" ? "nav-active" : ""} onClick={() => setView("board")}><LayoutDashboard size={18} /> Board</button>
          <button className={view === "people" ? "nav-active" : ""} onClick={() => setView("people")}><Users size={18} /> Ludzie <span>{users.length}</span></button>
          <button className={view === "notifications" ? "nav-active" : ""} onClick={() => setView("notifications")}><Bell size={18} /> Powiadomienia <span>{unread}</span></button>
          <button className={view === "history" ? "nav-active" : ""} onClick={() => setView("history")}><Clock3 size={18} /> Historia</button>
          {user.role === "ADMIN" && (
            <>
              <button className={view === "admin" ? "nav-active" : ""} onClick={() => { setView("admin"); fetchRegistrationToken(); }}><UserCog size={18} /> Admin</button>
              <button className={view === "audit" ? "nav-active" : ""} onClick={() => { setView("audit"); loadAuditLogs(); }}><ShieldAlert size={18} /> Audyty</button>
            </>
          )}
        </nav>
        <div className="user-card">
          <Avatar user={user} />
          <div>
            <strong>{user.name}</strong>
            <span>@{user.username} · {user.role}</span>
          </div>
          <button className="icon-btn" onClick={logout} title="Wyloguj"><LogOut size={18} /></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>{projects[0]?.key || "AFD"} workspace</p>
            <h2>{projects[0]?.name || "AgentFlowDashboard"}</h2>
          </div>
          <label className="search">
            <Search size={18} />
            <input placeholder="Szukaj taskow, osob, opisow..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </header>

        <section className="metrics">
          <div><CheckCircle2 size={20} /><strong>{tasks.filter((t) => t.status === "DONE").length}</strong><span>gotowe</span></div>
          <div><ShieldAlert size={20} /><strong>{tasks.filter((t) => t.status === "BLOCKED").length}</strong><span>blokady</span></div>
          <div><UserPlus size={20} /><strong>{tasks.filter((t) => t.assignees.some((a) => a.user.id === user.id)).length}</strong><span>moje taski</span></div>
          <div><Bell size={20} /><strong>{unread}</strong><span>nowe alerty</span></div>
        </section>

        {view === "board" && <section className="main-grid">
          <section className="board">
            {statuses.map((status) => {
              const columnTasks = filteredTasks.filter((task) => task.status === status.id);
              return (
                <div
                  className={`column ${dragOverStatus === status.id ? "drop-target" : ""}`}
                  key={status.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dragOverStatus !== status.id) setDragOverStatus(status.id);
                  }}
                  onDragLeave={() => setDragOverStatus((current) => (current === status.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    const taskId = event.dataTransfer.getData("text/task-id") || draggedTaskId;
                    if (taskId) moveTaskToStatus(taskId, status.id);
                    setDraggedTaskId(null);
                    setDragOverStatus(null);
                  }}
                >
                  <div className="column-head"><span>{status.label}</span><strong>{columnTasks.length}</strong></div>
                  {columnTasks.map((task) => (
                    <article
                      className={`task-card ${selected?.id === task.id ? "selected" : ""} ${draggedTaskId === task.id ? "dragging" : ""}`}
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggedTaskId(task.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/task-id", task.id);
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverStatus(null);
                      }}
                      onClick={() => {
                        setSelectedId(task.id);
                        setOpenCaseKey(task.key);
                      }}
                    >
                      <div className="task-card-head">
                        <a
                          className="case-link"
                          href={`/tasks/${task.key}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedId(task.id);
                            setOpenCaseKey(task.key);
                          }}
                        >
                          Sprawa {task.key}
                        </a>
                        <em className={`priority ${task.priority.toLowerCase()}`}>{priorityLabel[task.priority]}</em>
                      </div>
                      <strong>{task.title}</strong>
                      <p>{task.description || "Brak opisu"}</p>
                      <div className="task-card-foot">
                        <span><MessageSquare size={14} /> {task.comments.length}</span>
                        <span><Paperclip size={14} /> {task.attachments.length}</span>
                        <div className="avatar-stack">
                          {task.assignees.slice(0, 3).map((item) => <Avatar key={item.user.id} user={item.user} />)}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })}
          </section>

          <aside className="details">
            <form className="create-form" onSubmit={createTask}>
              <div className="panel-title"><Plus size={18} /> Nowy task</div>
              <input required placeholder="Tytul taska" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <textarea placeholder="Opis, akceptacja, @wzmianki..." value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <div className="two-col">
                <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}>
                  {priorities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </div>
              <div className="people-picker">
                {approvedUsers.map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      checked={draft.assigneeIds.includes(person.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...draft.assigneeIds, person.id]
                          : draft.assigneeIds.filter((id) => id !== person.id);
                        setDraft({ ...draft, assigneeIds: next });
                      }}
                    />
                    <Avatar user={person} />
                    <span>{person.name}</span>
                  </label>
                ))}
              </div>
              {error && <p className="error">{error}</p>}
              <button className="primary" disabled={saving}>Dodaj task</button>
            </form>

            {selected && (
              <section className="task-detail">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div className="panel-title" style={{ margin: 0 }}><Sparkles size={18} /> {selected.key}</div>
                  <button 
                    type="button" 
                    onClick={() => deleteTask(selected.id)} 
                    style={{ background: "none", border: "1px solid var(--error)", color: "var(--error)", borderRadius: "4px", padding: "4px 8px", fontSize: "12px", cursor: "pointer" }}
                  >
                    Usun zadanie
                  </button>
                </div>
                <input className="title-input" value={selected.title} onChange={(e) => updateTask(selected.id, { title: e.target.value })} />
                <textarea value={selected.description} onChange={(e) => updateTask(selected.id, { description: e.target.value })} />
                <div className="two-col">
                  <select value={selected.status} onChange={(e) => updateTask(selected.id, { status: e.target.value as Status })}>
                    {statuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <select value={selected.priority} onChange={(e) => updateTask(selected.id, { priority: e.target.value as Priority })}>
                    {priorities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
                <div className="people-picker compact-list">
                  {approvedUsers.map((person) => {
                    const assigned = selected.assignees.some((item) => item.user.id === person.id);
                    return (
                      <label key={person.id}>
                        <input
                          type="checkbox"
                          checked={assigned}
                          onChange={(e) => {
                            const currentIds = selected.assignees.map((item) => item.user.id);
                            const next = e.target.checked ? [...currentIds, person.id] : currentIds.filter((id) => id !== person.id);
                            updateTask(selected.id, { assigneeIds: next });
                          }}
                        />
                        <Avatar user={person} />
                        <span>{person.name}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="attachment-actions">
                  <input ref={fileInput} type="file" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
                  <button type="button" onClick={() => fileInput.current?.click()}><FileUp size={16} /> Dodaj plik</button>
                </div>
                <form onSubmit={addComment} className="comment-form">
                  <input placeholder="Komentarz, np. @jan sprawdz prosze..." value={comment} onChange={(e) => setComment(e.target.value)} />
                  <button>Wyslij</button>
                </form>
                <Feed title="Komentarze" items={selected.comments.map((item) => `${item.author.name}: ${item.body}`)} />
                <div className="feed">
                  <strong>Pliki</strong>
                  {selected.attachments.length === 0 ? (
                    <span className="muted">Brak wpisow</span>
                  ) : (
                    selected.attachments.map((item) => (
                      <p key={item.id}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Paperclip size={14} />
                          {item.fileName} ({Math.ceil(item.fileSize / 1024)} KB)
                        </a>
                      </p>
                    ))
                  )}
                </div>
                <Feed title="Aktywnosc" items={selected.activities.map((item) => `${item.actor.name}: ${item.message}`)} />
              </section>
            )}

            <section className="notifications">
              <div className="panel-title"><Bell size={18} /> Powiadomienia</div>
              {notifications.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  className={item.read ? "" : "unread"}
                  onClick={() => {
                    jsonFetch(`/api/notifications/${item.id}`, { method: "PATCH" }).then(() =>
                      setNotifications((rows) => rows.map((row) => (row.id === item.id ? { ...row, read: true } : row)))
                    );
                    if (item.taskId) setSelectedId(item.taskId);
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </button>
              ))}
            </section>
          </aside>
        </section>}

        {openCaseKey && (
          <div className="case-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={() => setOpenCaseKey(null)}>
            <div className="case-modal" onMouseDown={(event) => event.stopPropagation()}>
              <TaskCasePage
                caseKey={openCaseKey}
                embedded
                onClose={() => setOpenCaseKey(null)}
                onTaskUpdated={mergeUpdatedTask}
              />
            </div>
          </div>
        )}

        {view === "people" && (
          <section className="page-panel">
            <div className="panel-title"><Users size={18} /> Ludzie</div>
            <div className="people-table">
              {users.map((person) => (
                <div className="person-row" key={person.id}>
                  <Avatar user={person} />
                  <div>
                    <strong>{person.name}</strong>
                    <span>@{person.username} · {person.email}</span>
                  </div>
                  <em className={person.approved ? "status-ok" : "status-wait"}>{person.approved ? "Aktywny" : "Czeka"}</em>
                  <span>{person.role}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "admin" && user.role === "ADMIN" && (
          <section className="page-panel">
            <div className="panel-title"><UserCog size={18} /> Administracja uzytkownikami</div>
            
            <section className="case-card" style={{ marginBottom: "24px" }}>
              <div className="panel-title"><ShieldAlert size={18} /> Token rejestracji</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-subtle)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ display: "block", marginBottom: "4px" }}>Aktualny token:</strong>
                  {registrationToken ? (
                    <code style={{ padding: "6px 10px", background: "var(--bg)", borderRadius: "4px", border: "1px solid var(--border)", fontSize: "14px", userSelect: "all" }}>
                      {registrationToken}
                    </code>
                  ) : (
                    <span className="muted" style={{ color: "var(--error)" }}>Rejestracja jest zamknieta (brak tokenu)</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={regenerateToken} style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer" }}>
                    Wylosuj nowy
                  </button>
                  <button onClick={deleteToken} disabled={!registrationToken} style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "var(--bg)", border: "1px solid var(--error)", color: "var(--error)", cursor: registrationToken ? "pointer" : "not-allowed", opacity: registrationToken ? 1 : 0.5 }}>
                    Zamknij rejestracje
                  </button>
                </div>
              </div>
            </section>

            <section className="admin-summary">
              <div><strong>{users.length}</strong><span>wszyscy</span></div>
              <div><strong>{users.filter((person) => person.approved).length}</strong><span>aktywni</span></div>
              <div><strong>{pendingUsers.length}</strong><span>do akceptacji</span></div>
              <div><strong>{users.filter((person) => person.role === "ADMIN").length}</strong><span>admini</span></div>
            </section>
            {adminError && <p className="error">{adminError}</p>}
            {pendingUsers.length > 0 && (
              <div className="approval-list">
                <h3>Oczekuja na akceptacje</h3>
                {pendingUsers.map((person) => (
                  <div className="person-row admin-user-row" key={person.id}>
                    <Avatar user={person} />
                    <div>
                      <strong>{person.name}</strong>
                      <span>@{person.username} · {person.email}</span>
                    </div>
                    <em className="status-wait">Czeka</em>
                    <button className="primary" onClick={() => approveUser(person.id)}><ShieldCheck size={16} /> Akceptuj</button>
                  </div>
                ))}
              </div>
            )}
            <div className="admin-users">
              {users.map((person) => (
                <article className="admin-user-card" key={person.id}>
                  <div className="admin-user-head">
                    <Avatar user={person} />
                    <div>
                      <strong>{person.name}</strong>
                      <span>@{person.username} · {person.email}</span>
                    </div>
                    <em className={person.approved ? "status-ok" : "status-wait"}>{person.approved ? "Aktywny" : "Zablokowany"}</em>
                  </div>

                  <div className="admin-controls">
                    <label>
                      Rola
                      <select value={person.role} onChange={(event) => updateAdminUser(person.id, { role: event.target.value as User["role"] })}>
                        <option value="MEMBER">MEMBER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </label>
                    <label>
                      Nazwa
                      <input value={person.name} onChange={(event) => setUsers((items) => items.map((item) => item.id === person.id ? { ...item, name: event.target.value } : item))} onBlur={(event) => updateAdminUser(person.id, { name: event.target.value })} />
                    </label>
                    <label>
                      Nowe haslo
                      <input type="password" placeholder="min. 6 znakow" value={resetPasswords[person.id] || ""} onChange={(event) => setResetPasswords((items) => ({ ...items, [person.id]: event.target.value }))} />
                    </label>
                  </div>

                  <div className="admin-actions">
                    <button onClick={() => updateAdminUser(person.id, { approved: !person.approved })}>
                      <ShieldCheck size={16} /> {person.approved ? "Cofnij dostep" : "Aktywuj"}
                    </button>
                    <button onClick={() => updateAdminUser(person.id, { mustChangePassword: true })}>
                      <KeyRound size={16} /> Wymus zmiane hasla
                    </button>
                    <button onClick={() => resetUserPassword(person.id)}>
                      <KeyRound size={16} /> Resetuj haslo
                    </button>
                    <button className="danger" onClick={() => deleteUser(person.id)}>
                      <Trash2 size={16} /> Usun
                    </button>
                  </div>

                  {person.mustChangePassword && <p className="muted">Uzytkownik musi zmienic haslo przy kolejnym logowaniu.</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "notifications" && (
          <section className="page-panel">
            <div className="panel-title"><Bell size={18} /> Powiadomienia</div>
            <div className="wide-list">
              {notifications.length === 0 ? <span className="muted">Brak powiadomien</span> : notifications.map((item) => (
                <button
                  key={item.id}
                  className={item.read ? "" : "unread"}
                  onClick={() => {
                    jsonFetch(`/api/notifications/${item.id}`, { method: "PATCH" }).then(() =>
                      setNotifications((rows) => rows.map((row) => (row.id === item.id ? { ...row, read: true } : row)))
                    );
                    if (item.taskId) {
                      setSelectedId(item.taskId);
                      setView("board");
                    }
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="page-panel">
            <div className="panel-title"><Clock3 size={18} /> Historia zmian</div>
            <div className="wide-list">
              {allActivities.length === 0 ? <span className="muted">Brak aktywnosci</span> : allActivities.map((item) => (
                <button key={item.id} onClick={() => {
                  const task = tasks.find((row) => row.key === item.taskKey);
                  if (task) {
                    setSelectedId(task.id);
                    setView("board");
                  }
                }}>
                  <strong>{item.taskKey}: {item.message}</strong>
                  <span>{item.actor.name} · {item.taskTitle}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "audit" && user.role === "ADMIN" && (
          <section className="page-panel">
            <div className="panel-title"><ShieldAlert size={18} /> Logi Bezpieczenstwa (Audit)</div>
            <div className="wide-list">
              {auditLogs.length === 0 ? <span className="muted">Brak logow audytowych</span> : auditLogs.map((log) => (
                <div key={log.id} style={{ display: "flex", flexDirection: "column", padding: "12px", borderBottom: "1px solid var(--border)", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "14px", color: "var(--fg)" }}>{log.action}</strong>
                    <span className="muted" style={{ fontSize: "12px" }}>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                    {log.user ? (
                      <>
                        <Avatar user={log.user} />
                        <span style={{ fontWeight: 500, color: "var(--fg)" }}>{log.user.name}</span>
                        <span className="muted">(@{log.user.username})</span>
                      </>
                    ) : (
                      <span className="muted">System / Gosc</span>
                    )}
                    {log.entity && (
                      <>
                        <span className="muted">·</span>
                        <span>
                          {log.entity} {log.entityId && <span className="muted">({log.entityId})</span>}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: "12px", marginTop: "4px", display: "flex", gap: "8px", alignItems: "center" }}>
                    {log.ipAddress && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>IP: {log.ipAddress}</span>
                        {log.ipAddress !== "unknown" && (
                          <button 
                            type="button" 
                            style={{ 
                              background: "none", 
                              border: "1px solid var(--border)", 
                              borderRadius: "4px", 
                              padding: "2px 6px", 
                              fontSize: "10px", 
                              cursor: "pointer",
                              color: blockedIps.includes(log.ipAddress) ? "var(--error)" : "var(--fg)"
                            }}
                            onClick={() => toggleIpBlock(log.ipAddress!)}
                          >
                            {blockedIps.includes(log.ipAddress) ? "Odblokuj" : "Zablokuj"}
                          </button>
                        )}
                      </div>
                    )}
                    {log.userAgent && <span>Agent: {log.userAgent.slice(0, 50)}{log.userAgent.length > 50 ? "..." : ""}</span>}
                  </div>
                  {log.details && (
                    <pre style={{ margin: "8px 0 0", padding: "8px", background: "var(--bg-subtle)", borderRadius: "6px", fontSize: "12px", overflowX: "auto" }}>
                      {log.details}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function Feed({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="feed">
      <strong>{title}</strong>
      {items.length === 0 ? <span className="muted">Brak wpisow</span> : items.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
    </div>
  );
}
