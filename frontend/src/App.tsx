import { useState, useRef, useEffect } from "react";
import type { DragEvent, ChangeEvent, KeyboardEvent } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Rule {
  rule: string;
  points: number;
  active: boolean;
}

interface AnalysisResult {
  id: string;
  docId: number;
  fileName: string;
  fileSize: string;
  extractedChars: number;
  score: number;
  maxScore: number;
  activeRules: Rule[];
  totalRules: number;
  confidence: number;
  status: "pending" | "loading" | "done" | "error";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: string;
}

type Tab = "analisis" | "ranking" | "status" | "admin" | "faq";
type BadgeType = "info" | "success" | "warning" | "danger";
type ToastType = "success" | "error" | "warning" | "info";

// ── Constants ─────────────────────────────────────────────────────────────────
const INITIAL_MESSAGE: ChatMessage = {
  id: "init",
  role: "assistant",
  text: "Hola 👋 Cuéntame qué perfil buscas y te ayudo a preparar los documentos antes de subirlos. También puedo responder preguntas sobre los documentos que subas.",
  ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

// ── Small components ──────────────────────────────────────────────────────────
function Badge({ children, type = "info" }: { children: React.ReactNode; type?: BadgeType }) {
  const styles: Record<BadgeType, React.CSSProperties> = {
    info:    { background: "var(--color-background-info)",    color: "var(--color-text-info)"    },
    success: { background: "var(--color-background-success)", color: "var(--color-text-success)" },
    warning: { background: "var(--color-background-warning)", color: "var(--color-text-warning)" },
    danger:  { background: "var(--color-background-danger)",  color: "var(--color-text-danger)"  },
  };
  return (
    <span style={{ ...styles[type], fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: "var(--border-radius-md)", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = Math.min(score / max, 1);
  const r = 32, circ = 2 * Math.PI * r, dash = pct * circ;
  const color = pct >= 0.7 ? "#1D9E75" : pct >= 0.4 ? "#BA7517" : "#E24B4A";
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-border-tertiary)" strokeWidth="6" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`} strokeLinecap="round"
        transform="rotate(-90 40 40)" />
      <text x="40" y="41" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="500" fill="var(--color-text-primary)">{score}</text>
      <text x="40" y="56" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="var(--color-text-secondary)">/ {max}</text>
    </svg>
  );
}

// ── Toast Notification Component ─────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: "var(--color-background-success)",
    error: "var(--color-background-danger)",
    warning: "var(--color-background-warning)",
    info: "var(--color-background-info)",
  }[type];

  const textColor = {
    success: "var(--color-text-success)",
    error: "var(--color-text-danger)",
    warning: "var(--color-text-warning)",
    info: "var(--color-text-info)",
  }[type];

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      background: bgColor,
      color: textColor,
      padding: "12px 20px",
      borderRadius: "var(--border-radius-lg)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      zIndex: 1000,
      fontSize: 14,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "fadeIn 0.2s ease",
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16 }}>✕</button>
    </div>
  );
}

// ── Confirm Dialog Component ─────────────────────────────────────────────────
function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1100,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "var(--color-background-primary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1.5rem",
        maxWidth: 400,
        width: "90%",
        boxShadow: "0 20px 35px rgba(0,0,0,0.2)",
      }}>
        <h3 style={{ marginBottom: "0.5rem", fontSize: "1.2rem" }}>{title}</h3>
        <p style={{ marginBottom: "1.5rem", color: "var(--color-text-secondary)" }}>{message}</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            padding: "6px 16px",
            background: "var(--color-background-secondary)",
            color: "var(--color-text-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-md)",
            cursor: "pointer",
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            padding: "6px 16px",
            background: "var(--color-background-danger)",
            color: "var(--color-text-danger)",
            border: "none",
            borderRadius: "var(--border-radius-md)",
            cursor: "pointer",
          }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Dashboard Component (simplificado, igual que antes) ────────────────
function AdminDashboard({ token }: { token: string | null }) {
  // ... (mantén tu AdminDashboard completo, sin cambios)
  // Por brevedad, se omite aquí; usa el que ya tenías funcionando.
  return <div>AdminDashboard (copia tu código existente aquí)</div>;
}

// ── Main App component with UX improvements ──────────────────────────────────
function AppContent() {
  const [tab, setTab] = useState<Tab>("analisis");
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [showLogin, setShowLogin] = useState(!localStorage.getItem("token"));
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<{nombre: string, email: string} | null>(JSON.parse(localStorage.getItem("user") || "null"));
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerData, setRegisterData] = useState({ email: "", password: "", nombre_completo: "", empresa_nombre: "", empresa_nit: "" });
  const [isRegister, setIsRegister] = useState(false);
  const [uploadedDocIds, setUploadedDocIds] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // UI states for toast and confirm dialog
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
  };

  const closeToast = () => setToast(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, message, onConfirm });
  };

  const closeConfirm = () => setConfirmDialog(null);

  // ── Load documents and chat history ────────────────────────────────────────
  const loadDocuments = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/documents", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const docs = await res.json();
        const loadedResults = docs.map((doc: any) => ({
          id: `${doc.id}-${doc.nombre_original}`,
          docId: doc.id,
          fileName: doc.nombre_original,
          fileSize: (doc.tamano_bytes / 1024).toFixed(1),
          extractedChars: 0,
          score: doc.score || 0,
          maxScore: 15,
          activeRules: [],
          totalRules: 0,
          confidence: 0,
          status: "done" as const,
        }));
        setResults(loadedResults);
        setUploadedDocIds(docs.map((d: any) => d.id));
      }
    } catch (err) { console.error(err); showToast("Error al cargar documentos", "error"); }
  };

  const loadChatHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/chat/history", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 404) {
        setMessages([INITIAL_MESSAGE]);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          const loadedMessages = data.messages.map((msg: any, idx: number) => ({
            id: idx.toString(),
            role: msg.role,
            text: msg.content,
            ts: new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }));
          setMessages(loadedMessages);
        } else {
          setMessages([INITIAL_MESSAGE]);
        }
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (token) {
      loadDocuments();
      loadChatHistory();
    } else {
      setResults([]);
      setMessages([INITIAL_MESSAGE]);
      setUploadedDocIds([]);
    }
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add("dark-theme");
    else document.documentElement.classList.remove("dark-theme");
  }, [isDark]);

  // ── Authentication ──────────────────────────────────────────────────────────
  async function handleLogin() {
    try {
      const res = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        localStorage.setItem("token", data.access_token);
        setShowLogin(false);
        showToast("Sesión iniciada correctamente", "success");
      } else {
        showToast("Credenciales incorrectas", "error");
      }
    } catch (err) { showToast("Error de conexión", "error"); }
  }

  async function handleRegister() {
    try {
      const res = await fetch("http://localhost:8000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        localStorage.setItem("token", data.access_token);
        setShowLogin(false);
        showToast("Registro exitoso", "success");
      } else {
        const err = await res.json();
        showToast(`Error: ${err.detail}`, "error");
      }
    } catch (err) { showToast("Error de conexión", "error"); }
  }

  // ── Delete functions with confirmation and toast ───────────────────────────
  const deleteDocument = async (docId: number, fileName: string) => {
    showConfirm("Eliminar documento", `¿Deseas eliminar "${fileName}" permanentemente?`, async () => {
      try {
        const res = await fetch(`http://localhost:8000/document/${docId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          showToast(`"${fileName}" eliminado`, "success");
          await loadDocuments();
        } else {
          showToast("Error al eliminar el documento", "error");
        }
      } catch (err) { showToast("Error de conexión", "error"); }
      closeConfirm();
    });
  };

  const deleteAllDocuments = async () => {
    showConfirm("Eliminar todos los documentos", "Esta acción eliminará TODOS los documentos subidos. ¿Continuar?", async () => {
      try {
        const res = await fetch("http://localhost:8000/documents/clear", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          showToast("Todos los documentos fueron eliminados", "success");
          await loadDocuments();
        } else {
          showToast("Error al eliminar los documentos", "error");
        }
      } catch (err) { showToast("Error de conexión", "error"); }
      closeConfirm();
    });
  };

  // ── Upload file with duplicate check and toast ─────────────────────────────
  async function analyzeFile(file: File) {
    const alreadyUploaded = results.some(r => r.fileName === file.name && r.status === "done");
    if (alreadyUploaded) {
      showToast(`El archivo "${file.name}" ya ha sido subido`, "warning");
      return;
    }
    const tempId = `${file.name}-${Date.now()}-${Math.random()}`;
    setResults(prev => [...prev, {
      id: tempId, docId: 0, fileName: file.name, fileSize: (file.size / 1024).toFixed(1),
      extractedChars: 0, score: 0, maxScore: 15,
      activeRules: [], totalRules: 0, confidence: 0, status: "loading",
    }]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (response.status === 409) {
        const errorData = await response.json();
        showToast(errorData.detail || "El archivo ya existe", "warning");
        setResults(prev => prev.filter(r => r.id !== tempId));
        return;
      }
      if (!response.ok) throw new Error();
      showToast(`"${file.name}" subido correctamente`, "success");
      await loadDocuments();
    } catch {
      setResults(prev => prev.map(r => r.id === tempId ? { ...r, status: "error" } : r));
      showToast(`Error al subir "${file.name}"`, "error");
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(f => analyzeFile(f));
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || chatLoading) return;
    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(), role: "user", text,
      ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setChatLoading(true);
    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.text })),
          document_ids: uploadedDocIds,
        }),
      });
      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: "assistant", text: data.response,
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: "assistant",
        text: "Error de conexión con el asistente.",
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally { setChatLoading(false); }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const card: React.CSSProperties = {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "var(--border-radius-lg)",
    padding: "1rem 1.25rem",
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "analisis", label: "Análisis", icon: "📄" },
    { id: "ranking",  label: "Ranking",   icon: "🏆" },
    { id: "status",   label: "Estado del MVP", icon: "📊" },
    { id: "admin",    label: "Admin",     icon: "⚙️" },
    { id: "faq",      label: "FAQ",       icon: "❓" },
  ];

  const suggestions = [
    "¿Qué palabras clave mejoran el puntaje?",
    "¿Cómo se calculan los puntos?",
    "¿Qué debe incluir un CV ideal?",
    "Resume todos los documentos subidos",
    "¿Qué tecnologías aparecen en los documentos?",
  ];

  // ── Render Análisis (con botones mejorados) ────────────────────────────────
  function renderAnalisis() {
    const dzStyle: React.CSSProperties = dragging
      ? { border: "1.5px dashed var(--color-text-info)", background: "var(--color-background-info)" }
      : { border: "1.5px dashed var(--color-border-tertiary)", background: "var(--color-background-secondary)" };

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.5rem", alignItems: "start" }}>
        <div>
          <div
            style={{ ...dzStyle, borderRadius: "var(--border-radius-lg)", cursor: "pointer", padding: "1.25rem", marginBottom: "1rem", transition: "all 0.2s ease" }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.docx" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i className="ti ti-cloud-upload" style={{ fontSize: 28, color: dragging ? "var(--color-text-info)" : "var(--color-text-secondary)", flexShrink: 0 }} />
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>{dragging ? "Suelta los archivos aquí" : "Arrastra uno o varios documentos"}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>PDF o DOCX · Múltiples archivos · Máx. 10 MB c/u</div></div>
              <div style={{ marginLeft: "auto" }}><Badge type="info">Multi-archivo</Badge></div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            {results.length > 0 && (
              <button
                onClick={deleteAllDocuments}
                style={{
                  background: "none",
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: "var(--border-radius-md)",
                  padding: "5px 12px",
                  fontSize: 12,
                  color: "var(--color-text-danger)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <i className="ti ti-trash" style={{ fontSize: 13 }} /> Eliminar todos
              </button>
            )}
          </div>

          {results.length === 0 && (
            <div style={{ background: "var(--color-background-secondary)", border: "0.5px dashed var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", textAlign: "center" }}>
              <i className="ti ti-files" style={{ fontSize: 24, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }} />
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Los resultados de cada documento aparecerán aquí</div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {results.map((result) => (
              <div key={result.id} style={{ animation: "fadeIn 0.3s ease" }}>
                {result.status === "loading" && (
                  <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
                    <i className="ti ti-file" style={{ fontSize: 20, color: "var(--color-text-secondary)" }} />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{result.fileName}</div>
                    <div style={{ height: 4, background: "var(--color-border-tertiary)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "50%", background: "var(--color-text-info)", borderRadius: 99, animation: "slide 1.2s ease-in-out infinite" }} />
                    </div></div>
                    <Badge type="info">Procesando…</Badge>
                  </div>
                )}
                {result.status === "error" && (
                  <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
                    <i className="ti ti-alert-circle" style={{ fontSize: 20, color: "var(--color-text-danger)" }} />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500 }}>{result.fileName}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-danger)" }}>Error al conectar con el servidor</div></div>
                    <Badge type="danger">Error</Badge>
                  </div>
                )}
                {result.status === "done" && (
                  <div style={card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
                      <i className="ti ti-file-check" style={{ fontSize: 16, color: "var(--color-text-success)" }} />
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{result.fileName}</span>
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{result.fileSize} KB</span>
                      <button
                        onClick={() => deleteDocument(result.docId, result.fileName)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 16,
                          cursor: "pointer",
                          color: "var(--color-text-danger)",
                          padding: "0 4px",
                        }}
                        title="Eliminar documento"
                      >
                        🗑️
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: "0.75rem" }}>
                      <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "0.5rem 0.75rem" }}>
                        <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginBottom: 2 }}>Puntaje</div>
                        <div style={{ fontSize: 18, fontWeight: 500 }}>{result.score}<span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginLeft: 3 }}>/ {result.maxScore}</span></div>
                      </div>
                      <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "0.5rem 0.75rem" }}>
                        <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginBottom: 2 }}>Reglas activas</div>
                        <div style={{ fontSize: 18, fontWeight: 500 }}>{result.activeRules.length}<span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginLeft: 3 }}>/ {result.totalRules}</span></div>
                      </div>
                      <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "0.5rem 0.75rem" }}>
                        <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginBottom: 2 }}>Confianza</div>
                        <div style={{ fontSize: 18, fontWeight: 500 }}>{result.confidence}%</div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "0.75rem" }}>
                      <ScoreRing score={result.score} max={result.maxScore} />
                      <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "0.6rem 0.75rem" }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Reglas evaluadas</div>
                        {result.activeRules.length === 0
                          ? <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Ninguna regla coincidió</div>
                          : result.activeRules.map((r, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                                background: r.active ? "var(--color-background-success)" : "var(--color-background-secondary)",
                                border: `0.5px solid ${r.active ? "var(--color-text-success)" : "var(--color-border-tertiary)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                {r.active && <span style={{ color: "var(--color-text-success)", fontSize: 10 }}>✓</span>}
                              </div>
                              <span style={{ flex: 1, fontSize: 12, color: r.active ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>{r.rule}</span>
                              <span style={{ fontSize: 11, fontWeight: 500, color: r.active ? "var(--color-text-success)" : "var(--color-text-secondary)" }}>+{r.points} pts</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat lateral (sin cambios) */}
        <div style={{ ...card, display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 480, position: "sticky", top: "1rem", padding: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="ti ti-message-chatbot" style={{ fontSize: 13, color: "var(--color-text-info)" }} />
            </div>
            <div><div style={{ fontSize: 12, fontWeight: 500 }}>Asistente IA</div><div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>Ollama 3B local</div></div>
            <div style={{ marginLeft: "auto" }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75" }} /></div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.2s ease" }}>
                <div style={{
                  maxWidth: "88%",
                  background: msg.role === "user" ? "var(--color-background-info)" : "var(--color-background-secondary)",
                  border: `0.5px solid ${msg.role === "user" ? "var(--color-border-info)" : "var(--color-border-tertiary)"}`,
                  borderRadius: msg.role === "user" ? "var(--border-radius-lg) var(--border-radius-lg) 4px var(--border-radius-lg)" : "var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg) 4px",
                  padding: "0.5rem 0.7rem",
                }}>
                  <div style={{ fontSize: 12, lineHeight: 1.55 }}>{msg.text}</div>
                  <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 3, textAlign: "right" }}>{msg.ts}</div>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", animation: "fadeIn 0.2s ease" }}>
                <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg) 4px", padding: "0.55rem 0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-text-secondary)", animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {messages.length === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, margin: "0.6rem 0" }}>
              {suggestions.map(s => <button key={s} onClick={() => setInput(s)} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "5px 9px", fontSize: 11, color: "var(--color-text-secondary)", cursor: "pointer", textAlign: "left" }}>{s}</button>)}
            </div>
          )}
          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "0.6rem" }}>
            <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "0.45rem 0.6rem", display: "flex", alignItems: "flex-end", gap: 6 }}>
              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Escribe aquí…" rows={1} style={{ flex: 1, resize: "none", border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", lineHeight: 1.5, maxHeight: 80, overflowY: "auto" }} />
              <button onClick={sendMessage} disabled={!input.trim() || chatLoading} style={{ width: 28, height: 28, borderRadius: "var(--border-radius-md)", background: input.trim() && !chatLoading ? "var(--color-background-info)" : "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ti ti-send" style={{ fontSize: 14, color: input.trim() && !chatLoading ? "var(--color-text-info)" : "var(--color-text-secondary)" }} />
              </button>
            </div>
            <div style={{ fontSize: 10, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 4 }}>Enter para enviar · Shift+Enter nueva línea</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Ranking (sin cambios) ──────────────────────────────────────────
  function renderRanking() {
    const done = results.filter(r => r.status === "done").sort((a,b) => b.score - a.score);
    if (done.length === 0) {
      return (
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px dashed var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "2rem", textAlign: "center" }}>
          <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>🏆</span>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Ranking vacío</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Sube documentos en la pestaña Análisis para ver el ranking aquí</div>
        </div>
      );
    }
    return (
      <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", padding: "1rem" }}>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>{done.length} documento(s) analizados · ordenados por puntaje real</div>
        {done.map((c,i) => {
          const pct = Math.round((c.score / c.maxScore) * 100);
          const color = pct >= 70 ? "#1D9E75" : pct >= 40 ? "#BA7517" : "#E24B4A";
          return (
            <div key={c.id} style={{ background: "var(--color-background-primary)", border: i === 0 ? "2px solid var(--color-border-success)" : "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: i === 0 ? "var(--color-background-success)" : "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: i === 0 ? "var(--color-text-success)" : "var(--color-text-secondary)" }}>#{i+1}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{c.fileName}</div><div style={{ height: 4, background: "var(--color-background-secondary)", borderRadius: 99 }}><div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.8s ease" }} /></div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{i === 0 && <Badge type="success">Mejor candidato</Badge>}<div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 500, color }}>{c.score}</div><div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>/ {c.maxScore} pts</div></div></div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render Status (sin cambios) ───────────────────────────────────────────
  function renderStatus() {
    const services = [
      { label: "Frontend", desc: "React + TypeScript + Vite", completed: true },
      { label: "Backend", desc: "FastAPI · puerto 8000", completed: true },
      { label: "Extracción", desc: "PDF/DOCX (nombre, experiencia, tecnologías)", completed: true },
      { label: "Motor de reglas", desc: "Carga desde BD · Evaluación determinista", completed: true },
      { label: "Base de datos", desc: "SQLite · Modelos Empresa, Usuario, Reglas, Hechos", completed: true },
      { label: "Score / Confianza", desc: "0% si score=0 · Hasta 98%", completed: true },
      { label: "CORS", desc: "Comunicación con frontend", completed: true },
      { label: "Dashboard administrativo", desc: "CRUD reglas, estadísticas, login admin", completed: true },
      { label: "Autenticación JWT", desc: "Protección de endpoints admin", completed: true },
      { label: "Chat IA local (Ollama 3B)", desc: "Asistente conversacional", completed: true },
    ];
    const roadmap = [
      { icon: "📦", label: "Base de datos PostgreSQL", completed: false },
      { icon: "🎛️", label: "Motor dinámico de reglas (UI avanzada)", completed: false },
      { icon: "📸", label: "OCR para PDFs escaneados", completed: false },
    ];
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: "1rem" }}>
          {services.map(s => (
            <div key={s.label} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                <Badge type={s.completed ? "success" : "warning"}>{s.completed ? "✅" : "⏳"}</Badge>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 12 }}>🧠 Próximas mejoras</div>
          {roadmap.map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: "var(--color-text-secondary)" }}>{item.label}</span>
              <Badge type={item.completed ? "success" : "warning"}>{item.completed ? "✅" : "Pendiente"}</Badge>
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderFaq() {
    const faqs = [
      { q: "¿A quién reporto si el sistema falla?", a: "Escríbenos a 📧 alvaradoluis2002@gmail.com indicando el archivo, error y captura. Respuesta en <24h." },
      { q: "Subí el documento pero nunca cambia a 'Completado'", a: "Espera 30 segundos y recarga. Si persiste, el archivo puede estar corrupto o protegido." },
      { q: "Mi puntaje superó el máximo (ej. 18/15), ¿error?", a: "No, significa que cumplió más reglas de las mínimas, es positivo." },
      { q: "¿Dónde se guardan mis archivos?", a: "Se procesan temporalmente y se eliminan al limpiar la sesión." },
      { q: "Reglas activas 2/5, ¿análisis incompleto?", a: "No, solo 2 reglas aplican a ese documento. Es normal." }
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {faqs.map((faq, idx) => (
          <div key={idx} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-primary)" }}>{faq.q}</h3>
            <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{faq.a}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderAdmin() { return <AdminDashboard token={token} />; }

  // Pantalla de login
  if (showLogin) {
    return (
      <div style={{ maxWidth: 500, margin: "auto", marginTop: "10vh", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <h2 style={{ marginBottom: "1rem", textAlign: "center" }}>{isRegister ? "Registro" : "Iniciar sesión"}</h2>
        {!isRegister ? (
          <>
            <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={{ width: "100%", marginBottom: "0.75rem", padding: "8px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-primary)" }} />
            <input type="password" placeholder="Contraseña" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} style={{ width: "100%", marginBottom: "1rem", padding: "8px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-primary)" }} />
            <button onClick={handleLogin} style={{ width: "100%", padding: "8px", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "none", borderRadius: "var(--border-radius-md)", cursor: "pointer", marginBottom: "0.75rem" }}>Ingresar</button>
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>o</div>
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                try {
                  const res = await fetch("http://localhost:8000/auth/google", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ credential: credentialResponse.credential }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem("token", data.access_token);
                    localStorage.setItem("user", JSON.stringify(data.user));
                    setToken(data.access_token);
                    setUser(data.user);
                    setShowLogin(false);
                    showToast("Bienvenido", "success");
                  } else alert("Error al autenticar con Google");
                } catch (err) { console.error(err); showToast("Error de conexión", "error"); }
              }}
              onError={() => showToast("Error con Google Login", "error")}
              useOneTap={false}
            />
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-secondary)", marginTop: "0.75rem" }}>¿No tienes cuenta? <button onClick={() => setIsRegister(true)} style={{ background: "none", border: "none", color: "var(--color-text-info)", cursor: "pointer", textDecoration: "underline" }}>Regístrate</button></div>
          </>
        ) : (
          <>
            <input type="text" placeholder="Nombre completo" value={registerData.nombre_completo} onChange={e => setRegisterData({ ...registerData, nombre_completo: e.target.value })} style={{ width: "100%", marginBottom: "0.75rem", padding: "8px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)" }} />
            <input type="email" placeholder="Email" value={registerData.email} onChange={e => setRegisterData({ ...registerData, email: e.target.value })} style={{ width: "100%", marginBottom: "0.75rem", padding: "8px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)" }} />
            <input type="password" placeholder="Contraseña" value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} style={{ width: "100%", marginBottom: "0.75rem", padding: "8px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)" }} />
            <input type="text" placeholder="Empresa nombre" value={registerData.empresa_nombre} onChange={e => setRegisterData({ ...registerData, empresa_nombre: e.target.value })} style={{ width: "100%", marginBottom: "0.75rem", padding: "8px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)" }} />
            <input type="text" placeholder="Empresa NIT" value={registerData.empresa_nit} onChange={e => setRegisterData({ ...registerData, empresa_nit: e.target.value })} style={{ width: "100%", marginBottom: "1rem", padding: "8px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)" }} />
            <button onClick={handleRegister} style={{ width: "100%", padding: "8px", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "none", borderRadius: "var(--border-radius-md)", cursor: "pointer", marginBottom: "0.75rem" }}>Registrarse</button>
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-secondary)" }}>¿Ya tienes cuenta? <button onClick={() => setIsRegister(false)} style={{ background: "none", border: "none", color: "var(--color-text-info)", cursor: "pointer", textDecoration: "underline" }}>Inicia sesión</button></div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1rem" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={() => { confirmDialog.onConfirm(); closeConfirm(); }}
          onCancel={closeConfirm}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
        <div style={{ width: 34, height: 34, borderRadius: "var(--border-radius-md)", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-brain" style={{ fontSize: 18, color: "var(--color-text-info)" }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>DocMind AI</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Plataforma de análisis documental inteligente · MVP v1.0</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setIsDark(!isDark)} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "4px 10px", fontSize: 11, color: "var(--color-text-secondary)", cursor: "pointer" }}>
            {isDark ? "☀️ Claro" : "🌙 Oscuro"}
          </button>
          <Badge type="success">{user?.nombre || "Invitado"}</Badge>
          <button onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setToken(null);
            setShowLogin(true);
          }} style={{ background: "none", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "4px 10px", fontSize: 11, color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <i className="ti ti-logout" style={{ marginRight: 4 }} /> Salir
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, marginBottom: "1.25rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 13,
            fontWeight: tab === t.id ? 500 : 400,
            color: tab === t.id ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            padding: "6px 12px 8px",
            borderBottom: tab === t.id ? "2px solid var(--color-text-primary)" : "2px solid transparent",
            display: "flex", alignItems: "center", gap: 5
          }}>
            <span>{t.icon}</span> {t.label}
            {t.id === "ranking" && results.filter(r => r.status === "done").length > 0 && (
              <span style={{ background: "var(--color-background-success)", color: "var(--color-text-success)", fontSize: 10, padding: "1px 5px", borderRadius: 99 }}>
                {results.filter(r => r.status === "done").length}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === "analisis" && renderAnalisis()}
      {tab === "ranking"  && renderRanking()}
      {tab === "status"   && renderStatus()}
      {tab === "admin"    && renderAdmin()}
      {tab === "faq"      && renderFaq()}
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId="866709837983-s0fmq490k4kfsqh3f49v7uo047gec23g.apps.googleusercontent.com">
      <AppContent />
    </GoogleOAuthProvider>
  );
}