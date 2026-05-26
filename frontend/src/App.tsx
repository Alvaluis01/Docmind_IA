import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

// ── Tipos ─────────────────────────────────────────────────────────────
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

interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

type Tab = "analisis" | "ranking" | "status" | "admin" | "faq";
type BadgeType = "info" | "success" | "warning" | "danger";
type ToastType = "success" | "error" | "warning" | "info";

// ── Configuración ─────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";   // <- Cambia solo si usas otro puerto o dominio
const INITIAL_MESSAGE: ChatMessage = {
  id: "init",
  role: "assistant",
  text: "Hola 👋 Cuéntame qué perfil buscas y te ayudo a preparar los documentos antes de subirlos. También puedo responder preguntas sobre los documentos que subas.",
  ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

// ── Componentes pequeños ──────────────────────────────────────────────
function Badge({ children, type = "info" }: { children: React.ReactNode; type?: BadgeType }) {
  const styles: Record<BadgeType, React.CSSProperties> = {
    info: { background: "var(--color-background-info)", color: "var(--color-text-info)" },
    success: { background: "var(--color-background-success)", color: "var(--color-text-success)" },
    warning: { background: "var(--color-background-warning)", color: "var(--color-text-warning)" },
    danger: { background: "var(--color-background-danger)", color: "var(--color-text-danger)" },
  };
  return <span style={{ ...styles[type], fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: "var(--border-radius-md)", whiteSpace: "nowrap" }}>{children}</span>;
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
      position: "fixed", bottom: 20, right: 20, background: bgColor, color: textColor,
      padding: "12px 20px", borderRadius: "var(--border-radius-lg)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      zIndex: 1000, fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 10,
      animation: "fadeIn 0.2s ease",
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16 }}>✕</button>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem",
        maxWidth: 400, width: "90%", boxShadow: "0 20px 35px rgba(0,0,0,0.2)",
      }}>
        <h3 style={{ marginBottom: "0.5rem", fontSize: "1.2rem" }}>{title}</h3>
        <p style={{ marginBottom: "1.5rem", color: "var(--color-text-secondary)" }}>{message}</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            padding: "6px 16px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)",
            border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", cursor: "pointer",
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            padding: "6px 16px", background: "var(--color-background-danger)", color: "var(--color-text-danger)",
            border: "none", borderRadius: "var(--border-radius-md)", cursor: "pointer",
          }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────
function AdminDashboard({ token }: { token: string | null }) {
  const [rules, setRules] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [newRule, setNewRule] = useState({
    nombre: "", descripcion: "", atributo: "experiencia_anos", operador: ">", valor: "", puntaje: 5, activa: true
  });

  const fetchRules = async () => {
    try {
      const t = token || localStorage.getItem("token");
      if (!t) return;
      const res = await fetch(`${API_BASE}/rules`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setRules(await res.json());
    } catch (e) { /* ignore */ }
  };
  const fetchStats = async () => {
    try {
      const t = token || localStorage.getItem("token");
      if (!t) return;
      const res = await fetch(`${API_BASE}/stats`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setStats(await res.json());
    } catch (e) { /* ignore */ }
  };
  useEffect(() => { fetchRules(); fetchStats(); }, [token]);

  const createRule = async () => {
    const condiciones = [{ atributo: newRule.atributo.trim(), operador: newRule.operador.trim(), valor: isNaN(Number(newRule.valor)) ? newRule.valor : Number(newRule.valor) }];
    const condiciones_json = { condiciones, puntaje: Number(newRule.puntaje) };
    try {
      const t = token || localStorage.getItem("token");
      if (!t) throw new Error("no token");
      await fetch(`${API_BASE}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ nombre: newRule.nombre, descripcion: newRule.descripcion, condiciones_json, activa: newRule.activa })
      });
      fetchRules();
      setNewRule({ nombre: "", descripcion: "", atributo: "experiencia_anos", operador: ">", valor: "", puntaje: 5, activa: true });
    } catch (e) { alert("Error al crear regla"); }
  };

  const deleteRule = async (id: number) => {
    if (confirm("¿Eliminar esta regla?")) {
      const t = token || localStorage.getItem("token");
      if (!t) return;
      await fetch(`${API_BASE}/rules/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } });
      fetchRules();
    }
  };

  const startEdit = (rule: any) => {
    const cond = rule.condiciones_json.condiciones?.[0] || {};
    setEditingId(rule.id);
    setEditForm({
      id: rule.id, nombre: rule.nombre, descripcion: rule.descripcion || "",
      atributo: cond.atributo || "", operador: cond.operador || ">", valor: cond.valor?.toString() || "",
      puntaje: rule.condiciones_json.puntaje || 0, activa: rule.activa
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); };
  const updateRule = async () => {
    const newCondiciones = [{ atributo: editForm.atributo, operador: editForm.operador, valor: isNaN(Number(editForm.valor)) ? editForm.valor : Number(editForm.valor) }];
    const newCondiciones_json = { condiciones: newCondiciones, puntaje: Number(editForm.puntaje) };
    try {
      const t = token || localStorage.getItem("token");
      if (!t) throw new Error("no token");
      await fetch(`${API_BASE}/rules/${editForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ nombre: editForm.nombre, descripcion: editForm.descripcion, condiciones_json: newCondiciones_json, activa: editForm.activa })
      });
      fetchRules();
      cancelEdit();
    } catch (e) { alert("Error al actualizar la regla"); }
  };

  const cardStyle = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={cardStyle}><h3>📊 Estadísticas</h3><div>📄 Documentos subidos: {stats.total_documents || 0}</div><div>⚙️ Reglas activas: {stats.total_rules || 0}</div><div>👥 Usuarios registrados: {stats.total_users || 0}</div></div>
      <div style={cardStyle}>
        <h3>📜 Reglas actuales</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {rules.map(rule => {
            const cond = rule.condiciones_json.condiciones?.[0] || {};
            const isEditing = editingId === rule.id;
            if (isEditing && editForm) {
              return (
                <div key={rule.id} style={{ border: "1px solid var(--color-border-info)", padding: "0.75rem", borderRadius: "var(--border-radius-md)", background: "var(--color-background-info)" }}>
                  <input value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} placeholder="Nombre" style={{ width: "100%", marginBottom: 8, padding: 6 }} />
                  <textarea value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} placeholder="Descripción" rows={2} style={{ width: "100%", marginBottom: 8, padding: 6 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.8fr", gap: 8, marginBottom: 8 }}>
                    <input value={editForm.atributo} onChange={e => setEditForm({ ...editForm, atributo: e.target.value })} placeholder="Atributo" />
                    <input value={editForm.operador} onChange={e => setEditForm({ ...editForm, operador: e.target.value })} placeholder="Operador" />
                    <input value={editForm.valor} onChange={e => setEditForm({ ...editForm, valor: e.target.value })} placeholder="Valor" />
                    <input type="number" value={editForm.puntaje} onChange={e => setEditForm({ ...editForm, puntaje: parseInt(e.target.value) || 0 })} placeholder="Puntaje" />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><input type="checkbox" checked={editForm.activa} onChange={e => setEditForm({ ...editForm, activa: e.target.checked })} /> Activa</label>
                  <div style={{ display: "flex", gap: 8 }}><button onClick={updateRule} style={{ background: "var(--color-background-info)", color: "var(--color-text-info)", border: "none", padding: "6px 12px", borderRadius: "var(--border-radius-md)", cursor: "pointer" }}>Guardar</button><button onClick={cancelEdit} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", padding: "6px 12px", borderRadius: "var(--border-radius-md)", cursor: "pointer" }}>Cancelar</button></div>
                </div>
              );
            }
            return (
              <div key={rule.id} style={{ border: "1px solid var(--color-border-tertiary)", padding: "0.5rem", borderRadius: "var(--border-radius-md)" }}>
                <div><strong>{rule.nombre}</strong> {rule.activa ? "✅ Activa" : "❌ Inactiva"}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{rule.descripcion || "Sin descripción"}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Condición: {cond.atributo} {cond.operador} {cond.valor} → +{rule.condiciones_json.puntaje} pts</div>
                <div style={{ display: "flex", gap: "8px", marginTop: 8 }}><button onClick={() => startEdit(rule)} style={{ padding: "4px 8px", fontSize: 11, background: "var(--color-background-info)", color: "var(--color-text-info)", border: "none", borderRadius: "var(--border-radius-md)", cursor: "pointer" }}>✏️ Editar</button><button onClick={() => deleteRule(rule.id)} style={{ padding: "4px 8px", fontSize: 11, background: "var(--color-background-danger)", color: "var(--color-text-danger)", border: "none", borderRadius: "var(--border-radius-md)", cursor: "pointer" }}>🗑️ Eliminar</button></div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={cardStyle}>
        <h3>➕ Crear nueva regla</h3>
        <input placeholder="Nombre" value={newRule.nombre} onChange={e => setNewRule({ ...newRule, nombre: e.target.value })} style={{ width: "100%", marginBottom: 8, padding: 6 }} />
        <textarea placeholder="Descripción" value={newRule.descripcion} onChange={e => setNewRule({ ...newRule, descripcion: e.target.value })} rows={2} style={{ width: "100%", marginBottom: 8, padding: 6 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.8fr", gap: 8, marginBottom: 8 }}>
          <input placeholder="Atributo" value={newRule.atributo} onChange={e => setNewRule({ ...newRule, atributo: e.target.value })} />
          <input placeholder="Operador" value={newRule.operador} onChange={e => setNewRule({ ...newRule, operador: e.target.value })} />
          <input placeholder="Valor" value={newRule.valor} onChange={e => setNewRule({ ...newRule, valor: e.target.value })} />
          <input type="number" placeholder="Puntaje" value={newRule.puntaje} onChange={e => setNewRule({ ...newRule, puntaje: parseInt(e.target.value) || 0 })} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><input type="checkbox" checked={newRule.activa} onChange={e => setNewRule({ ...newRule, activa: e.target.checked })} /> Activa</label>
        <button onClick={createRule} style={{ background: "var(--color-background-info)", color: "var(--color-text-info)", border: "none", padding: "6px 12px", borderRadius: "var(--border-radius-md)", cursor: "pointer" }}>Crear regla</button>
      </div>
    </div>
  );
}

// ── Componente principal AppContent ────────────────────────────────────
function AppContent() {
  const [tab, setTab] = useState<Tab>("analisis");
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<{ nombre: string; email: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerData, setRegisterData] = useState({ email: "", password: "", nombre_completo: "", empresa_nombre: "", empresa_nit: "" });
  const [isRegister, setIsRegister] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [uploadedDocIds, setUploadedDocIds] = useState<number[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isCreatingConv, setIsCreatingConv] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  // Cargar sesión guardada
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedToken !== "undefined" && savedUser && savedUser !== "undefined") {
      setToken(savedToken);
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && typeof parsedUser === 'object') {
          setUser(parsedUser);
          setShowLogin(false);
        } else {
          localStorage.removeItem("user");
          localStorage.removeItem("token");
        }
      } catch (e) {
        console.error("Error parsing saved user:", e);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
  }, []);

  const showToast = (message: string, type: ToastType = "info") => setToast({ message, type });
  const closeToast = () => setToast(null);
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setConfirmDialog({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmDialog(null);

  // Helper to reliably get the current auth token (state or localStorage)
  const getSavedToken = () => {
    const t = token || localStorage.getItem("token");
    if (t && t !== "undefined" && t !== "null") return t;
    return null;
  };

  const authHeaders = (extra: Record<string, string> = {}) => {
    const t = getSavedToken();
    return { ...extra, ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  };

  // Conversaciones
  const loadConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/conversations`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0 && !currentConvId) {
          setCurrentConvId(data[0].id);
          await loadMessages(data[0].id);
        }
      } else if (res.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        setShowLogin(true);
      }
    } catch (err) { console.error(err); }
  };

  const loadMessages = async (convId: number) => {
    try {
      const res = await fetch(`${API_BASE}/chat/conversations/${convId}/messages`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          const loadedMessages = data.messages.map((msg: any, idx: number) => ({
            id: `${convId}-${idx}-${msg.timestamp}`,
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

  const createNewConversation = async () => {
    if (!getSavedToken() || isCreatingConv) return;
    setIsCreatingConv(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ message: "", title: "Nueva conversación", document_ids: uploadedDocIds }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentConvId(data.conversation_id);
        setMessages([INITIAL_MESSAGE]);
        await loadConversations();
        showToast("Nueva conversación creada", "success");
      } else {
        showToast("Error al crear conversación", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error de conexión", "error");
    } finally {
      setIsCreatingConv(false);
    }
  };

  const deleteConversation = async (convId: number) => {
    showConfirm("Eliminar conversación", "¿Deseas eliminar esta conversación permanentemente?", async () => {
      try {
        const res = await fetch(`${API_BASE}/chat/conversations/${convId}`, { method: "DELETE", headers: authHeaders() });
        if (res.ok) {
          if (currentConvId === convId) {
            setCurrentConvId(null);
            setMessages([INITIAL_MESSAGE]);
          }
          await loadConversations();
          showToast("Conversación eliminada", "success");
        }
      } catch (err) { console.error(err); }
      closeConfirm();
    });
  };

  // Documentos
  const loadDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`, { headers: authHeaders() });
      if (res.ok) {
        const docs = await res.json();
        // Debug: mostrar los documentos crudos recibidos
        console.debug("loadDocuments - raw docs:", docs);
        const loadedResults = docs.map((doc: any) => {
          // Aceptar que activeRules pueda venir como string JSON desde el backend
          let activeRules = doc.activeRules ?? doc.active_rules ?? [];
          if (typeof activeRules === "string") {
            try { activeRules = JSON.parse(activeRules); } catch (e) { activeRules = []; }
          }
          const confidence = doc.confidence ?? 0;
          return {
            id: `${doc.id}-${doc.nombre_original}`,
            docId: doc.id,
            fileName: doc.nombre_original,
            fileSize: ((doc.tamano_bytes || doc.size || 0) / 1024).toFixed(1),
            extractedChars: doc.extractedChars ?? 0,
            score: doc.score || 0,
            maxScore: doc.maxScore ?? 15,
            activeRules: activeRules,
            totalRules: doc.totalRules ?? doc.total_rules ?? 0,
            confidence: typeof confidence === "string" ? Number(confidence) || 0 : confidence,
            status: "done" as const,
          };
        });
        setResults(loadedResults);
        setUploadedDocIds(docs.map((d: any) => d.id));
      } else if (res.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        setShowLogin(true);
      }
    } catch (err) { showToast("Error al cargar documentos", "error"); }
  };

  useEffect(() => {
    if (token) {
      loadDocuments();
      loadConversations();
    }
  }, [token]);

  useEffect(() => {
    if (currentConvId && token) loadMessages(currentConvId);
  }, [currentConvId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add("dark-theme");
    else document.documentElement.classList.remove("dark-theme");
  }, [isDark]);

  // Autenticación
  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        let userData = data.user || { nombre: loginEmail.split('@')[0], email: loginEmail };
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(userData));
        setToken(data.access_token);
        setUser(userData);
        setShowLogin(false);
        showToast("Sesión iniciada correctamente", "success");
      } else {
        showToast(data.detail || "Credenciales incorrectas", "error");
      }
    } catch (err) {
      showToast("Error de conexión con el servidor", "error");
    }
  };

  const handleRegister = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      });
      const data = await res.json();
      if (res.ok) {
        let userData = data.user || { nombre: registerData.nombre_completo, email: registerData.email };
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(userData));
        setToken(data.access_token);
        setUser(userData);
        setShowLogin(false);
        showToast("Registro exitoso", "success");
      } else {
        showToast(`Error: ${data.detail}`, "error");
      }
    } catch (err) {
      showToast("Error de conexión", "error");
    }
  };

  // Eliminar documentos
  const deleteDocument = async (docId: number, fileName: string) => {
    showConfirm("Eliminar documento", `¿Deseas eliminar "${fileName}" permanentemente?`, async () => {
      try {
        if (!getSavedToken()) {
          showToast("Debes iniciar sesión para eliminar documentos", "warning");
          closeConfirm();
          return;
        }
        console.debug('deleteDocument - docId:', docId);
        const res = await fetch(`${API_BASE}/document/${docId}`, { method: "DELETE", headers: authHeaders() });
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
        if (!getSavedToken()) {
          showToast("Debes iniciar sesión para eliminar documentos", "warning");
          closeConfirm();
          return;
        }
        console.debug('deleteAllDocuments');
        const res = await fetch(`${API_BASE}/documents/clear`, { method: "DELETE", headers: authHeaders() });
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

  // Subir archivo
  const analyzeFile = async (file: File) => {
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
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      if (response.status === 409) {
        const errorData = await response.json();
        showToast(errorData.detail || "El archivo ya existe", "warning");
        setResults(prev => prev.filter(r => r.id !== tempId));
        return;
      }
      if (response.status === 401) {
        showToast("Sesión expirada. Por favor inicia sesión nuevamente.", "error");
        localStorage.removeItem("token");
        setToken(null);
        setShowLogin(true);
        return;
      }
      if (!response.ok) throw new Error();
      const data = await response.json();
      setResults(prev => prev.map(r => r.id === tempId ? {
        ...r,
        extractedChars: data.extractedChars ?? 0,
        score: data.score ?? 0,
        maxScore: data.maxScore ?? 15,
        activeRules: data.activeRules ?? [],
        totalRules: data.totalRules ?? 0,
        confidence: data.confidence ?? 0,
        status: "done",
      } : r));
      if (data.documento_id) setUploadedDocIds(prev => [...prev, data.documento_id]);
      await loadDocuments();
    } catch {
      setResults(prev => prev.map(r => r.id === tempId ? { ...r, status: "error" } : r));
      showToast(`Error al subir "${file.name}"`, "error");
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(f => analyzeFile(f));
  };

  // Chat
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatLoading || isCreatingConv) return;

    if (!currentConvId) {
      if (!getSavedToken()) { showToast("Debes iniciar sesión para iniciar un chat", "warning"); return; }
      setIsCreatingConv(true);
      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ message: text, title: text.slice(0, 30), document_ids: uploadedDocIds }),
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentConvId(data.conversation_id);
          const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", text, ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
          const assistantMsg: ChatMessage = { id: `assistant-${Date.now()}`, role: "assistant", text: data.response || "Mensaje recibido. ¿En qué más puedo ayudarte?", ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
          setMessages([userMsg, assistantMsg]);
          await loadConversations();
        } else {
          const errorData = await res.json();
          showToast(errorData.detail || "Error al crear conversación", "error");
        }
      } catch (error) {
        console.error("Error creating conversation:", error);
        showToast("Error de conexión", "error");
      } finally {
        setIsCreatingConv(false);
        setInput("");
        setChatLoading(false);
      }
      return;
    }

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      text,
      ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setChatLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ message: text, conversation_id: currentConvId, document_ids: uploadedDocIds }),
      });
      if (response.status === 401) {
        showToast("Sesión expirada. Por favor inicia sesión nuevamente.", "error");
        localStorage.removeItem("token");
        setToken(null);
        setShowLogin(true);
        setChatLoading(false);
        return;
      }
      if (!response.ok) throw new Error();
      const data = await response.json();
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempUserMsg.id);
        const realUserMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", text, ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
        const assistantMsg: ChatMessage = { id: `assistant-${Date.now()}`, role: "assistant", text: data.response || "Lo siento, no pude procesar tu mensaje.", ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
        return [...withoutTemp, realUserMsg, assistantMsg];
      });
      if (data.title) setConversations(prev => prev.map(c => c.id === currentConvId ? { ...c, title: data.title } : c));
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      showToast("Error de conexión con el asistente", "error");
    } finally {
      setChatLoading(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const card: React.CSSProperties = {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "var(--border-radius-lg)",
    padding: "1rem 1.25rem",
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "analisis", label: "Análisis", icon: "📄" },
    { id: "ranking", label: "Ranking", icon: "🏆" },
    { id: "status", label: "Estado del MVP", icon: "📊" },
    { id: "admin", label: "Admin", icon: "⚙️" },
    { id: "faq", label: "FAQ", icon: "❓" },
  ];

  const suggestions = [
    "¿Qué palabras clave mejoran el puntaje?",
    "¿Cómo se calculan los puntos?",
    "¿Qué debe incluir un CV ideal?",
    "Resume todos los documentos subidos",
    "¿Qué tecnologías aparecen en los documentos?",
  ];

  // Render Análisis (UI completa)
  const renderAnalisis = () => {
    const dzStyle: React.CSSProperties = dragging
      ? { border: "1.5px dashed var(--color-text-info)", background: "var(--color-background-info)" }
      : { border: "1.5px dashed var(--color-border-tertiary)", background: "var(--color-background-secondary)" };
    return (
      <div style={{ display: "flex", gap: "1rem", alignItems: "start" }}>
        {/* Sidebar conversaciones */}
        <div style={{
          width: showSidebar ? "260px" : "0px",
          overflow: "hidden",
          transition: "width 0.2s",
          background: "var(--color-background-secondary)",
          borderRadius: "var(--border-radius-lg)",
          padding: showSidebar ? "0.75rem" : "0",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Conversaciones</span>
            <button onClick={() => setShowSidebar(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <button onClick={createNewConversation} disabled={isCreatingConv || !token} style={{
            width: "100%", padding: "6px 12px",
            background: "var(--color-background-info)", color: "var(--color-text-info)",
            border: "none", borderRadius: "var(--border-radius-md)", cursor: (isCreatingConv || !token) ? "not-allowed" : "pointer",
            marginBottom: "1rem", opacity: (isCreatingConv || !token) ? 0.5 : 1,
          }}>{isCreatingConv ? "Creando..." : "+ Nueva conversación"}</button>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {conversations.map(conv => (
              <div key={conv.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: currentConvId === conv.id ? "var(--color-background-info)" : "transparent",
                borderRadius: "var(--border-radius-md)", padding: "6px 10px", cursor: "pointer",
              }} onClick={() => setCurrentConvId(conv.id)}>
                <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{conv.title}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-danger)", fontSize: 14 }}>🗑️</button>
              </div>
            ))}
            {conversations.length === 0 && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Sin conversaciones</div>}
          </div>
        </div>

        {!showSidebar && <button onClick={() => setShowSidebar(true)} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>☰ Chats</button>}

        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.5rem", alignItems: "start" }}>
            {/* Columna izquierda: subida y resultados */}
            <div>
              <div style={{ ...dzStyle, borderRadius: "var(--border-radius-lg)", cursor: "pointer", padding: "1.25rem", marginBottom: "1rem", transition: "all 0.2s ease" }}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}>
                <input ref={fileRef} type="file" accept=".pdf,.docx" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <i className="ti ti-cloud-upload" style={{ fontSize: 28, color: dragging ? "var(--color-text-info)" : "var(--color-text-secondary)", flexShrink: 0 }} />
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{dragging ? "Suelta los archivos aquí" : "Arrastra uno o varios documentos"}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>PDF o DOCX · Múltiples archivos · Máx. 10 MB c/u</div></div>
                  <div style={{ marginLeft: "auto" }}><Badge type="info">Multi-archivo</Badge></div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                {results.length > 0 && <button onClick={deleteAllDocuments} style={{ background: "none", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "5px 12px", fontSize: 12, color: "var(--color-text-danger)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><i className="ti ti-trash" style={{ fontSize: 13 }} /> Eliminar todos</button>}
              </div>
              {results.length === 0 && <div style={{ background: "var(--color-background-secondary)", border: "0.5px dashed var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", textAlign: "center" }}><i className="ti ti-files" style={{ fontSize: 24, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }} /><div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Los resultados de cada documento aparecerán aquí</div></div>}
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
                          <button onClick={() => deleteDocument(result.docId, result.fileName)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "var(--color-text-danger)", padding: "0 4px" }}>🗑️</button>
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
                            {result.activeRules.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Ninguna regla coincidió</div> : result.activeRules.map((r, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                                <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, background: r.active ? "var(--color-background-success)" : "var(--color-background-secondary)", border: `0.5px solid ${r.active ? "var(--color-text-success)" : "var(--color-border-tertiary)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{r.active && <span style={{ color: "var(--color-text-success)", fontSize: 10 }}>✓</span>}</div>
                                <span style={{ flex: 1, fontSize: 12 }}>{r.rule}</span>
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

            {/* Columna derecha: chat */}
            <div style={{ ...card, display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 480, position: "sticky", top: "1rem", padding: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-message-chatbot" style={{ fontSize: 13, color: "var(--color-text-info)" }} /></div>
                <div><div style={{ fontSize: 12, fontWeight: 500 }}>Asistente IA</div><div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>Ollama 3B local</div></div>
                <div style={{ marginLeft: "auto" }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75" }} /></div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
                {messages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.2s ease" }}>
                    <div style={{ maxWidth: "88%", background: msg.role === "user" ? "var(--color-background-info)" : "var(--color-background-secondary)", border: `0.5px solid ${msg.role === "user" ? "var(--color-border-info)" : "var(--color-border-tertiary)"}`, borderRadius: msg.role === "user" ? "var(--border-radius-lg) var(--border-radius-lg) 4px var(--border-radius-lg)" : "var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg) 4px", padding: "0.5rem 0.7rem" }}>
                      <div style={{ fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.text}</div>
                      <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 3, textAlign: "right" }}>{msg.ts}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", animation: "fadeIn 0.2s ease" }}>
                    <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg) 4px", padding: "0.55rem 0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-text-secondary)", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              {messages.length === 1 && messages[0].id === "init" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, margin: "0.6rem 0" }}>
                  {suggestions.map(s => <button key={s} onClick={() => setInput(s)} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "5px 9px", fontSize: 11, color: "var(--color-text-secondary)", cursor: "pointer", textAlign: "left" }}>{s}</button>)}
                </div>
              )}
              <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "0.6rem" }}>
                <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "0.45rem 0.6rem", display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Escribe aquí…" rows={1} style={{ flex: 1, resize: "none", border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", lineHeight: 1.5, maxHeight: "150px", overflowY: "auto" }} />
                  <button onClick={sendMessage} disabled={!input.trim() || chatLoading || isCreatingConv} style={{ width: 28, height: 28, borderRadius: "var(--border-radius-md)", background: input.trim() && !chatLoading && !isCreatingConv ? "var(--color-background-info)" : "transparent", border: "none", cursor: (input.trim() && !chatLoading && !isCreatingConv) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-send" style={{ fontSize: 14, color: input.trim() && !chatLoading && !isCreatingConv ? "var(--color-text-info)" : "var(--color-text-secondary)" }} /></button>
                </div>
                <div style={{ fontSize: 10, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 4 }}>Enter para enviar · Shift+Enter nueva línea</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRanking = () => {
    const done = results.filter(r => r.status === "done").sort((a, b) => b.score - a.score);
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
        {done.map((c, i) => {
          const pct = Math.round((c.score / c.maxScore) * 100);
          const color = pct >= 70 ? "#1D9E75" : pct >= 40 ? "#BA7517" : "#E24B4A";
          return (
            <div key={c.id} style={{ background: "var(--color-background-primary)", border: i === 0 ? "2px solid var(--color-border-success)" : "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: i === 0 ? "var(--color-background-success)" : "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: i === 0 ? "var(--color-text-success)" : "var(--color-text-secondary)" }}>#{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{c.fileName}</div><div style={{ height: 4, background: "var(--color-background-secondary)", borderRadius: 99 }}><div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.8s ease" }} /></div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{i === 0 && <Badge type="success">Mejor candidato</Badge>}<div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 500, color }}>{c.score}</div><div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>/ {c.maxScore} pts</div></div></div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderStatus = () => {
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div><Badge type={s.completed ? "success" : "warning"}>{s.completed ? "✅" : "⏳"}</Badge></div>
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
  };

  const renderFaq = () => {
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
  };

  const renderAdmin = () => <AdminDashboard token={token} />;

  // Pantalla de login
  if (showLogin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
        <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", padding: "2rem", width: "100%", maxWidth: 420, boxShadow: "0 20px 35px rgba(0,0,0,0.2)" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}><div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text-primary)" }}>DocMind AI</div><div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 4 }}>Inicia sesión para continuar</div></div>
          {!isRegister ? (
            <>
              <div style={{ marginBottom: "1rem" }}><div style={{ display: "flex", alignItems: "center", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "0.5rem 1rem", border: "0.5px solid var(--color-border-tertiary)" }}><i className="ti ti-user" style={{ fontSize: 18, marginRight: 10, color: "var(--color-text-secondary)" }} /><input type="email" placeholder="Correo electrónico" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--color-text-primary)", fontSize: 14 }} /></div></div>
              <div style={{ marginBottom: "1rem" }}><div style={{ display: "flex", alignItems: "center", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "0.5rem 1rem", border: "0.5px solid var(--color-border-tertiary)" }}><i className="ti ti-lock" style={{ fontSize: 18, marginRight: 10, color: "var(--color-text-secondary)" }} /><input type="password" placeholder="Contraseña" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--color-text-primary)", fontSize: 14 }} /></div></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-secondary)" }}><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Recordarme</label><a href="#" style={{ fontSize: 12, color: "var(--color-text-info)", textDecoration: "none" }}>¿Olvidaste tu contraseña?</a></div>
              <button onClick={handleLogin} style={{ width: "100%", padding: "10px", background: "linear-gradient(90deg, #667eea, #764ba2)", color: "white", border: "none", borderRadius: "var(--border-radius-md)", fontSize: 16, fontWeight: 500, cursor: "pointer", marginBottom: "1rem" }}>Iniciar sesión</button>
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>o</div>
              <GoogleLogin onSuccess={async (credentialResponse) => {
                try {
                  const res = await fetch(`${API_BASE}/auth/google`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: credentialResponse.credential }) });
                  if (res.ok) {
                    const data = await res.json();
                    let userData = data.user || { nombre: "Usuario", email: data.email || "google@user.com" };
                    localStorage.setItem("token", data.access_token);
                    localStorage.setItem("user", JSON.stringify(userData));
                    setToken(data.access_token);
                    setUser(userData);
                    setShowLogin(false);
                    showToast("Bienvenido", "success");
                  } else alert("Error al autenticar con Google");
                } catch (err) { console.error(err); showToast("Error de conexión", "error"); }
              }} onError={() => showToast("Error con Google Login", "error")} useOneTap={false} />
              <div style={{ textAlign: "center", marginTop: "1rem" }}><span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>¿No tienes cuenta? </span><button onClick={() => setIsRegister(true)} style={{ background: "none", border: "none", color: "var(--color-text-info)", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Regístrate</button></div>
            </>
          ) : (
            <>
              <input type="text" placeholder="Nombre completo" value={registerData.nombre_completo} onChange={e => setRegisterData({ ...registerData, nombre_completo: e.target.value })} style={{ width: "100%", marginBottom: "0.75rem", padding: "10px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-primary)" }} />
              <input type="email" placeholder="Email" value={registerData.email} onChange={e => setRegisterData({ ...registerData, email: e.target.value })} style={{ width: "100%", marginBottom: "0.75rem", padding: "10px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-primary)" }} />
              <input type="password" placeholder="Contraseña" value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} style={{ width: "100%", marginBottom: "0.75rem", padding: "10px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-primary)" }} />
              <input type="text" placeholder="Empresa nombre" value={registerData.empresa_nombre} onChange={e => setRegisterData({ ...registerData, empresa_nombre: e.target.value })} style={{ width: "100%", marginBottom: "0.75rem", padding: "10px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-primary)" }} />
              <input type="text" placeholder="Empresa NIT" value={registerData.empresa_nit} onChange={e => setRegisterData({ ...registerData, empresa_nit: e.target.value })} style={{ width: "100%", marginBottom: "1rem", padding: "10px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-primary)" }} />
              <button onClick={handleRegister} style={{ width: "100%", padding: "10px", background: "linear-gradient(90deg, #667eea, #764ba2)", color: "white", border: "none", borderRadius: "var(--border-radius-md)", fontSize: 16, fontWeight: 500, cursor: "pointer", marginBottom: "0.75rem" }}>Registrarse</button>
              <div style={{ textAlign: "center" }}><span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>¿Ya tienes cuenta? </span><button onClick={() => setIsRegister(false)} style={{ background: "none", border: "none", color: "var(--color-text-info)", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Inicia sesión</button></div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Aplicación principal
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1rem" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      {confirmDialog && <ConfirmDialog open={confirmDialog.open} title={confirmDialog.title} message={confirmDialog.message} onConfirm={() => { confirmDialog.onConfirm(); closeConfirm(); }} onCancel={closeConfirm} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
        <div style={{ width: 34, height: 34, borderRadius: "var(--border-radius-md)", background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-brain" style={{ fontSize: 18, color: "var(--color-text-info)" }} /></div>
        <div><div style={{ fontSize: 16, fontWeight: 500 }}>DocMind AI</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Plataforma de análisis documental inteligente · MVP v1.0</div></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setIsDark(!isDark)} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "4px 10px", fontSize: 11, color: "var(--color-text-secondary)", cursor: "pointer" }}>{isDark ? "☀️ Claro" : "🌙 Oscuro"}</button>
          <Badge type="success">{user?.nombre || "Invitado"}</Badge>
          <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); setToken(null); setUser(null); setShowLogin(true); }} style={{ background: "none", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "4px 10px", fontSize: 11, color: "var(--color-text-secondary)", cursor: "pointer" }}><i className="ti ti-logout" style={{ marginRight: 4 }} /> Salir</button>
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
            display: "flex", alignItems: "center", gap: 5,
          }}><span>{t.icon}</span> {t.label}{t.id === "ranking" && results.filter(r => r.status === "done").length > 0 && <span style={{ background: "var(--color-background-success)", color: "var(--color-text-success)", fontSize: 10, padding: "1px 5px", borderRadius: 99 }}>{results.filter(r => r.status === "done").length}</span>}</button>
        ))}
      </div>
      {tab === "analisis" && renderAnalisis()}
      {tab === "ranking" && renderRanking()}
      {tab === "status" && renderStatus()}
      {tab === "admin" && renderAdmin()}
      {tab === "faq" && renderFaq()}
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