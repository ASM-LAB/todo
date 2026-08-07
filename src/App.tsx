import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  supabase,
  isSupabaseConfigured as initialIsConfigured
} from './supabaseClient';
import {
  LogOut,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Folder,
  ChevronDown,
  ChevronUp,
  Search,
  Lock,
  Mail,
  RefreshCw,
  Calendar,
  UserPlus,
  LogIn,
  AlertCircle,
  X,
  Smartphone,
  Monitor
} from 'lucide-react';

// Interfaces
interface Tarea {
  id: string;
  user_id: string;
  concepto: string;
  concepto_superior: string;
  prioridad: 'alta' | 'media' | 'baja';
  estado: 'pendiente' | 'en curso' | 'rechazada' | 'resuelta';
  fecha_alta: string;
  fecha_resolucion: string | null;
}

// Mapeo de prioridad a valor numérico para ordenación (Alta -> 1, Media -> 2, Baja -> 3)
const PRIORIDAD_VALORES = {
  alta: 1,
  media: 2,
  baja: 3,
};

export default function App() {
  // Configuración de Supabase (con posibilidad de configuración en vivo)
  const [isConfigured, setIsConfigured] = useState(initialIsConfigured);
  const [tempUrl, setTempUrl] = useState(import.meta.env.VITE_SUPABASE_URL || '');
  const [tempKey, setTempKey] = useState(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

  // Estados de Auth
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Estados de Tareas
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loadingTareas, setLoadingTareas] = useState(false);
  const [tareasError, setTareasError] = useState('');

  // Estados de Filtros y Búsqueda
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [accordionsAbiertos, setAccordionsAbiertos] = useState<Record<string, boolean>>({});

  // Estados de Formularios (Crear / Editar Tarea)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState<Tarea | null>(null);
  const [formData, setFormData] = useState({
    concepto: '',
    concepto_superior: '',
    prioridad: 'media' as 'alta' | 'media' | 'baja',
    estado: 'pendiente' as 'pendiente' | 'en curso' | 'rechazada' | 'resuelta',
  });

  // Intentar guardar credenciales ingresadas temporalmente si faltan
  const handleSaveTempConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUrl && tempKey) {
      localStorage.setItem('temp_supabase_url', tempUrl);
      localStorage.setItem('temp_supabase_key', tempKey);
      window.location.reload();
    }
  };

  // Cargar credenciales temporales si existen en localStorage
  useEffect(() => {
    if (localStorage.getItem('temp_supabase_url') && localStorage.getItem('temp_supabase_key')) {
      setIsConfigured(true);
    }
  }, []);

  // Limpiar credenciales temporales
  const handleClearTempConfig = () => {
    localStorage.removeItem('temp_supabase_url');
    localStorage.removeItem('temp_supabase_key');
    window.location.reload();
  };

  // Escuchar el estado de autenticación de Supabase
  useEffect(() => {
    if (!isConfigured) {
      setAuthLoading(false);
      return;
    }

    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Escuchar cambios en la autenticación (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  // Cargar tareas del usuario autenticado
  const fetchTareas = useCallback(async () => {
    if (!user) return;
    setLoadingTareas(true);
    setTareasError('');
    try {
      const { data, error } = await supabase
        .from('tareas')
        .select('*');

      if (error) throw error;
      setTareas(data || []);
    } catch (err: any) {
      console.error('Error cargando tareas:', err);
      setTareasError(err.message || 'No se pudieron cargar las tareas. Asegúrate de haber ejecutado el script schema.sql en Supabase.');
    } finally {
      setLoadingTareas(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTareas();
    } else {
      setTareas([]);
    }
  }, [user, fetchTareas]);

  // Suscripción en Tiempo Real (Supabase Realtime)
  useEffect(() => {
    if (!user || !isConfigured) return;

    // Suscribirse a cambios en la tabla 'tareas' para el esquema 'public'
    const channel = supabase
      .channel('realtime:tareas')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tareas',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // payload.eventType puede ser INSERT, UPDATE o DELETE
          if (payload.eventType === 'INSERT') {
            const nueva = payload.new as Tarea;
            setTareas((prev) => {
              // Evitar duplicados si ya se agregó localmente
              if (prev.some((t) => t.id === nueva.id)) return prev;
              return [...prev, nueva];
            });
          } else if (payload.eventType === 'UPDATE') {
            const actualizada = payload.new as Tarea;
            setTareas((prev) =>
              prev.map((t) => (t.id === actualizada.id ? actualizada : t))
            );
          } else if (payload.eventType === 'DELETE') {
            const eliminada = payload.old as { id: string };
            setTareas((prev) => prev.filter((t) => t.id !== eliminada.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isConfigured]);

  // Registrar nuevo usuario
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user && data.session) {
        setAuthSuccess('¡Cuenta creada e inicio de sesión automático exitoso!');
        setUser(data.user);
      } else {
        setAuthSuccess('¡Registro iniciado! Por favor verifica tu correo electrónico para confirmar la cuenta (o inicia sesión si la confirmación de correo está deshabilitada en Supabase).');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Ocurrió un error al registrar el usuario.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Iniciar Sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      setUser(data.user);
      setAuthSuccess('Sesión iniciada con éxito.');
    } catch (err: any) {
      setAuthError(err.message || 'Credenciales incorrectas o error de conexión.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Cerrar Sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Guardar / Actualizar Tarea
  const handleSaveTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.concepto.trim() || !formData.concepto_superior.trim()) {
      alert('Por favor, rellena todos los campos.');
      return;
    }

    try {
      const isResuelta = formData.estado === 'resuelta';
      const fechaResolucion = isResuelta
        ? new Date().toISOString()
        : (editingTarea && editingTarea.estado === 'resuelta' && formData.estado === 'resuelta')
          ? editingTarea.fecha_resolucion
          : null;

      if (editingTarea) {
        // Modo Edición
        const { error } = await supabase
          .from('tareas')
          .update({
            concepto: formData.concepto.trim(),
            concepto_superior: formData.concepto_superior.trim(),
            prioridad: formData.prioridad,
            estado: formData.estado,
            fecha_resolucion: fechaResolucion,
          })
          .eq('id', editingTarea.id);

        if (error) throw error;
      } else {
        // Modo Creación
        const { error } = await supabase
          .from('tareas')
          .insert({
            concepto: formData.concepto.trim(),
            concepto_superior: formData.concepto_superior.trim(),
            prioridad: formData.prioridad,
            estado: formData.estado,
            fecha_resolucion: fechaResolucion,
          });

        if (error) throw error;
      }

      // Cerrar modal y limpiar
      setIsModalOpen(false);
      setEditingTarea(null);
      setFormData({
        concepto: '',
        concepto_superior: '',
        prioridad: 'media',
        estado: 'pendiente',
      });
      fetchTareas(); // Sincronización fallback por si falla realtime
    } catch (err: any) {
      alert('Error al guardar la tarea: ' + err.message);
    }
  };

  // Eliminar Tarea
  const handleDeleteTarea = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return;
    try {
      const { error } = await supabase
        .from('tareas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchTareas(); // Sincronización fallback
    } catch (err: any) {
      alert('Error al eliminar la tarea: ' + err.message);
    }
  };

  // Cambiar estado rápidamente desde la fila/item
  const handleQuickStatusChange = async (tarea: Tarea, nuevoEstado: Tarea['estado']) => {
    try {
      const isResuelta = nuevoEstado === 'resuelta';
      const fechaResolucion = isResuelta ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('tareas')
        .update({
          estado: nuevoEstado,
          fecha_resolucion: fechaResolucion
        })
        .eq('id', tarea.id);

      if (error) throw error;
      fetchTareas(); // Sincronización fallback
    } catch (err: any) {
      alert('Error al actualizar el estado: ' + err.message);
    }
  };

  // Abrir Modal de Creación
  const openCreateModal = () => {
    setEditingTarea(null);
    setFormData({
      concepto: '',
      concepto_superior: '',
      prioridad: 'media',
      estado: 'pendiente',
    });
    setIsModalOpen(true);
  };

  // Abrir Modal de Edición
  const openEditModal = (tarea: Tarea) => {
    setEditingTarea(tarea);
    setFormData({
      concepto: tarea.concepto,
      concepto_superior: tarea.concepto_superior,
      prioridad: tarea.prioridad,
      estado: tarea.estado,
    });
    setIsModalOpen(true);
  };

  // Filtrado, Búsqueda y Ordenación de tareas
  const tareasProcesadas = useMemo(() => {
    let resultado = [...tareas];

    // 1. Filtrado por Estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter((t) => t.estado === filtroEstado);
    }

    // 2. Búsqueda por Concepto o Concepto Superior (Grupo)
    if (busqueda.trim() !== '') {
      const term = busqueda.toLowerCase();
      resultado = resultado.filter(
        (t) =>
          t.concepto.toLowerCase().includes(term) ||
          t.concepto_superior.toLowerCase().includes(term)
      );
    }

    // 3. Ordenación por Prioridad (Alta > Media > Baja) y luego por Fecha de Alta (descendente)
    resultado.sort((a, b) => {
      const prioridadDiff = PRIORIDAD_VALORES[a.prioridad] - PRIORIDAD_VALORES[b.prioridad];
      if (prioridadDiff !== 0) {
        return prioridadDiff; // Menor valor numérico (1=alta) va primero
      }
      // Si la prioridad es igual, ordenar por fecha_alta de forma descendente (más recientes primero)
      return new Date(b.fecha_alta).getTime() - new Date(a.fecha_alta).getTime();
    });

    return resultado;
  }, [tareas, filtroEstado, busqueda]);

  // Agrupación por Concepto Superior (para los acordeones colapsables)
  const tareasAgrupadas = useMemo(() => {
    const grupos: Record<string, Tarea[]> = {};

    tareasProcesadas.forEach((tarea) => {
      const grupo = tarea.concepto_superior || 'Sin Clasificar';
      if (!grupos[grupo]) {
        grupos[grupo] = [];
      }
      grupos[grupo].push(tarea);
    });

    return grupos;
  }, [tareasProcesadas]);

  // Alternar estado de colapsado para un grupo
  const toggleAccordion = (grupo: string) => {
    setAccordionsAbiertos((prev) => ({
      ...prev,
      [grupo]: prev[grupo] === false ? true : false, // Por defecto abierto (undefined = abierto)
    }));
  };

  // Formatear fechas
  const formatFecha = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Contadores para el panel de estadísticas en la parte superior
  const stats = useMemo(() => {
    const totales = tareas.length;
    const pendientes = tareas.filter((t) => t.estado === 'pendiente').length;
    const enCurso = tareas.filter((t) => t.estado === 'en curso').length;
    const rechazadas = tareas.filter((t) => t.estado === 'rechazada').length;
    const resueltas = tareas.filter((t) => t.estado === 'resuelta').length;
    return { totales, pendientes, enCurso, rechazadas, resueltas };
  }, [tareas]);

  // 1. Pantalla de advertencia si no está configurado Supabase
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white shadow-2xl rounded-3xl p-8 border border-purple-100 text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-red-100 rounded-2xl text-red-600">
              <AlertCircle size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 m-0">Falta configurar Supabase</h1>
              <p className="text-sm text-gray-500 mt-1">Conecta tu propia base de datos para comenzar</p>
            </div>
          </div>

          <p className="text-gray-600 mb-6 leading-relaxed">
            Esta aplicación requiere conectarse a tu base de datos de <strong>Supabase</strong> para la persistencia inmediata de datos y la sincronización en tiempo real.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
              Paso 1: Ejecuta el script SQL en Supabase
            </h3>
            <p className="text-xs text-amber-700 leading-relaxed">
              Copia el contenido del archivo <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">schema.sql</code> que se encuentra en la raíz del proyecto y pégalo en el <strong>Editor SQL</strong> de tu panel de control de Supabase para crear las tablas, políticas RLS y habilitar Realtime.
            </p>
          </div>

          <form onSubmit={handleSaveTempConfig} className="space-y-4">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
              Paso 2: Introduce tus claves o crea un archivo .env
            </h3>
            <p className="text-xs text-gray-500">
              Puedes crear un archivo <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">.env</code> basado en <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">.env.example</code> o, si lo prefieres para probar rápidamente, introduce tus claves temporales aquí mismo:
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                VITE_SUPABASE_URL
              </label>
              <input
                type="text"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="https://tu-proyecto.supabase.co"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                VITE_SUPABASE_ANON_KEY
              </label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden text-sm"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
            >
              Conectar Supabase y Cargar App
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Pantalla de carga mientras se verifica el token / sesión de usuario
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <RefreshCw className="animate-spin text-purple-600 mb-4" size={48} />
        <p className="text-gray-600 font-medium">Iniciando y sincronizando con Supabase...</p>
      </div>
    );
  }

  // 3. Pantalla de Iniciar Sesión / Registrarse si no está autenticado
  if (!user) {
    const isTempConfigured = localStorage.getItem('temp_supabase_url') !== null;
    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-100 via-purple-50 to-pink-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-2xl rounded-3xl p-8 border border-purple-50">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-100 text-purple-600 mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight m-0">To-Do Realtime</h2>
            <p className="text-sm text-gray-500 mt-2">Gestiona tus tareas en todos tus dispositivos de forma inmediata</p>
          </div>

          {/* Selector de Pestaña */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
                setAuthSuccess('');
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                authMode === 'login'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
                setAuthSuccess('');
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                authMode === 'register'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Alertas */}
          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}
          {authSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-md mt-6 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : authMode === 'login' ? (
                <>
                  <LogIn size={18} />
                  <span>Entrar a la Aplicación</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Crear mi Cuenta</span>
                </>
              )}
            </button>
          </form>
        </div>

        {isTempConfigured && (
          <button
            onClick={handleClearTempConfig}
            className="mt-6 text-xs text-red-500 hover:text-red-700 underline font-medium cursor-pointer"
          >
            Quitar claves temporales de Supabase
          </button>
        )}
      </div>
    );
  }

  // 4. Panel Principal / Dashboard de la Aplicación de Tareas
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Barra de Navegación / Header */}
      <header className="bg-white border-b border-gray-100 shadow-xs sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 leading-none m-0 p-0 text-left">To-Do PWA</h1>
              <span className="text-[10px] text-green-500 font-bold tracking-wider uppercase flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Tiempo Real Activo
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs text-gray-400">Usuario</span>
              <span className="text-sm font-semibold text-gray-700">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 sm:px-4 sm:py-2 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-xl text-gray-500 transition flex items-center gap-2 text-sm font-medium border border-gray-100 cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 space-y-6">

        {/* Panel de Estadísticas / Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Totales</span>
            <span className="text-2xl font-bold text-gray-800 mt-1">{stats.totales}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Pendientes</span>
            <span className="text-2xl font-bold text-yellow-600 mt-1">{stats.pendientes}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">En Curso</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1">{stats.enCurso}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Rechazadas</span>
            <span className="text-2xl font-bold text-red-600 mt-1">{stats.rechazadas}</span>
          </div>
          <div className="col-span-2 md:col-span-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Resueltas</span>
            <span className="text-2xl font-bold text-green-600 mt-1">{stats.resueltas}</span>
          </div>
        </div>

        {/* Acciones principales y filtros */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">

          {/* Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar tarea o grupo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden text-sm"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Botón Nueva Tarea */}
          <button
            onClick={openCreateModal}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md cursor-pointer shrink-0"
          >
            <Plus size={18} />
            <span>Nueva Tarea</span>
          </button>
        </div>

        {/* Filtros de Estado */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="p-1 bg-gray-200/60 rounded-xl flex items-center w-full sm:w-auto">
            {[
              { id: 'todos', label: 'Todos', count: stats.totales },
              { id: 'pendiente', label: 'Pendientes', count: stats.pendientes },
              { id: 'en curso', label: 'En Curso', count: stats.enCurso },
              { id: 'rechazada', label: 'Rechazadas', count: stats.rechazadas },
              { id: 'resuelta', label: 'Resueltas', count: stats.resueltas },
            ].map((filtro) => (
              <button
                key={filtro.id}
                onClick={() => setFiltroEstado(filtro.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  filtroEstado === filtro.id
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>{filtro.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  filtroEstado === filtro.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {filtro.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mensaje de Error en Tareas */}
        {tareasError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm flex items-start gap-2">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-semibold">Error al conectar con la base de datos:</p>
              <p className="mt-1 text-xs">{tareasError}</p>
            </div>
          </div>
        )}

        {/* Vista de Carga o Mensaje de Vacío */}
        {loadingTareas ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 flex flex-col items-center justify-center">
            <RefreshCw className="animate-spin text-purple-600 mb-3" size={32} />
            <p className="text-gray-500 text-sm">Cargando tus tareas de Supabase...</p>
          </div>
        ) : Object.keys(tareasAgrupadas).length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 text-gray-400 mb-3">
              <Folder size={24} />
            </div>
            <h3 className="font-bold text-gray-800 text-lg m-0">No se encontraron tareas</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
              {busqueda || filtroEstado !== 'todos'
                ? 'Prueba a cambiar los filtros o los criterios de búsqueda.'
                : 'Empieza dando de alta tu primera tarea con el botón "Nueva Tarea".'}
            </p>
          </div>
        ) : (
          /* Lista agrupada en Acordeones Colapsables */
          <div className="space-y-4">
            {Object.entries(tareasAgrupadas).map(([grupoName, listaTareas]) => {
              const estaAbierto = accordionsAbiertos[grupoName] !== false;

              // Contar estados dentro de este grupo
              const pendientesGrupo = listaTareas.filter(t => t.estado === 'pendiente').length;
              const enCursoGrupo = listaTareas.filter(t => t.estado === 'en curso').length;

              return (
                <div
                  key={grupoName}
                  className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden transition-all duration-200"
                >
                  {/* Cabecera del Acordeón */}
                  <button
                    onClick={() => toggleAccordion(grupoName)}
                    className="w-full px-5 py-4 bg-gray-50/70 hover:bg-gray-100/50 flex items-center justify-between text-left transition cursor-pointer border-b border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Folder size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm sm:text-base m-0 leading-tight">
                          {grupoName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">
                            {listaTareas.length} {listaTareas.length === 1 ? 'tarea' : 'tareas'}
                          </span>
                          {(pendientesGrupo > 0 || enCursoGrupo > 0) && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-semibold">
                              {pendientesGrupo} pendientes • {enCursoGrupo} en curso
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-gray-400 hover:text-gray-600">
                      {estaAbierto ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </button>

                  {/* Cuerpo del Acordeón (Tareas) */}
                  {estaAbierto && (
                    <div className="divide-y divide-gray-100">
                      {listaTareas.map((tarea) => {
                        // Badge de prioridad
                        const badgePrioridad = {
                          alta: 'bg-red-50 text-red-700 border border-red-100',
                          media: 'bg-amber-50 text-amber-700 border border-amber-100',
                          baja: 'bg-blue-50 text-blue-700 border border-blue-100',
                        }[tarea.prioridad];

                        // Badge de estado
                        const badgeEstado = {
                          pendiente: 'bg-gray-100 text-gray-700 border border-gray-200',
                          'en curso': 'bg-indigo-50 text-indigo-700 border border-indigo-100',
                          rechazada: 'bg-rose-50 text-rose-700 border border-rose-100',
                          resuelta: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
                        }[tarea.estado];

                        return (
                          <div
                            key={tarea.id}
                            className="p-4 sm:p-5 hover:bg-slate-50/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            {/* Información de la Tarea */}
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgePrioridad}`}>
                                  {tarea.prioridad}
                                </span>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeEstado}`}>
                                  {tarea.estado}
                                </span>
                              </div>

                              <p className={`text-sm sm:text-base text-gray-800 font-medium break-words leading-relaxed text-left ${
                                tarea.estado === 'resuelta' ? 'line-through text-gray-400' : ''
                              }`}>
                                {tarea.concepto}
                              </p>

                              {/* Fechas */}
                              <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} />
                                  Alta: {formatFecha(tarea.fecha_alta)}
                                </span>
                                {tarea.estado === 'resuelta' && tarea.fecha_resolucion && (
                                  <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50/50 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 size={12} />
                                    Resuelta: {formatFecha(tarea.fecha_resolucion)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Acciones y cambio rápido de estado */}
                            <div className="flex items-center justify-end gap-2.5 flex-wrap sm:flex-nowrap border-t border-gray-50 pt-3 sm:pt-0 sm:border-0 shrink-0">

                              {/* Selector rápido de estado */}
                              <div className="relative">
                                <select
                                  value={tarea.estado}
                                  onChange={(e) => handleQuickStatusChange(tarea, e.target.value as Tarea['estado'])}
                                  className="bg-gray-50 border border-gray-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-gray-700 outline-hidden hover:bg-gray-100 transition cursor-pointer"
                                >
                                  <option value="pendiente">Pendiente</option>
                                  <option value="en curso">En Curso</option>
                                  <option value="rechazada">Rechazada</option>
                                  <option value="resuelta">Resuelta</option>
                                </select>
                              </div>

                              {/* Editar */}
                              <button
                                onClick={() => openEditModal(tarea)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Editar tarea"
                              >
                                <Edit2 size={16} />
                              </button>

                              {/* Eliminar */}
                              <button
                                onClick={() => handleDeleteTarea(tarea.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Eliminar tarea"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal / Dialog de Creación y Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-extrabold text-gray-900 text-lg">
                {editingTarea ? 'Modificar Tarea' : 'Crear Nueva Tarea'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-50 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveTarea} className="p-6 space-y-4">
              {/* Concepto Superior (Grupo) */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Concepto Superior / Grupo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Trabajo, Personal, Hogar, Compras"
                  value={formData.concepto_superior}
                  onChange={(e) => setFormData({ ...formData, concepto_superior: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden text-sm"
                  required
                />
              </div>

              {/* Concepto / Tarea */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Descripción de la Tarea (Concepto)
                </label>
                <textarea
                  placeholder="¿Qué tienes que hacer?"
                  value={formData.concepto}
                  onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden text-sm"
                  required
                />
              </div>

              {/* Fila de Prioridad y Estado */}
              <div className="grid grid-cols-2 gap-4">
                {/* Prioridad */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                    Prioridad
                  </label>
                  <select
                    value={formData.prioridad}
                    onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>

                {/* Estado (solo relevante en modo edición, en creación por defecto es pendiente) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en curso">En Curso</option>
                    <option value="rechazada">Rechazada</option>
                    <option value="resuelta">Resuelta</option>
                  </select>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-50 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-50 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-5 py-2 rounded-xl transition duration-200 text-sm shadow-sm cursor-pointer"
                >
                  {editingTarea ? 'Guardar Cambios' : 'Añadir Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-6 mt-12 text-center text-xs text-gray-400">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 To-Do Realtime PWA. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Monitor size={12} /> PC compatible
            </span>
            <span className="flex items-center gap-1">
              <Smartphone size={12} /> Móvil compatible
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
