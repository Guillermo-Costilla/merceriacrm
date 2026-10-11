import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Database, 
  Clock, 
  Server, 
  ShoppingBag,
  RefreshCw,
  LogOut,
  UserCheck,
  ShieldCheck
} from 'lucide-react'

import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'

interface HealthData {
  status: string
  service: string
  version: string
  environment: string
  timestamp_utc: string
  timestamp_local: string
  timezone: string
  turso_configured: boolean
  database?: {
    connected: boolean
    latency_ms: number | null
    error: string | null
  }
}

function MainApp() {
  const { user, loading: authLoading, logout } = useAuth()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const checkBackendHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/health')
      if (!res.ok) {
        throw new Error(`El servidor respondió con código ${res.status}`)
      }
      const data: HealthData = await res.json()
      setHealth(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo conectar con el backend'
      setError(message)
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkBackendHealth()
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-rose-600 mb-3" />
        <p className="text-sm text-slate-500 font-medium">Verificando sesión segura...</p>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 md:p-8 font-sans">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-200">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Mercería CRM</h1>
            <p className="text-xs text-slate-500">Gestión de Inventario y Ventas</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-white border border-slate-200 rounded-xl shadow-xs">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-800 leading-none">{user.full_name}</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">{user.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:bg-rose-100 transition-colors shadow-2xs"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full my-8 flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Fase 4: Autenticación Verificada
                </span>
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mt-2">
                Sesión Activa: Bienvenido/a, {user.full_name}
              </h2>
              <p className="text-sm text-slate-500">
                La sesión está autenticada mediante cookies seguras HttpOnly con hash Argon2id y protección contra fuerza bruta.
              </p>
            </div>

            <button
              onClick={checkBackendHealth}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 self-start sm:self-auto"
              title="Volver a comprobar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Reintentar
            </button>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-rose-500" />
              <p className="text-sm">Consultando estado del backend...</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-red-800">Error de conexión</h3>
                  <p className="text-xs text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {health && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex items-center space-x-3 mb-2">
                  <Server className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Servidor Backend</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-800">{health.service}</span>
                  <span className="text-xs text-slate-400">(v{health.version})</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Modo: <span className="font-mono text-slate-700 font-medium">{health.environment}</span>
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex items-center space-x-3 mb-2">
                  <Database className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Base de Datos Turso</span>
                </div>
                <div className="flex items-center space-x-2">
                  {health.database?.connected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">Conectada y Sincronizada</span>
                      {health.database.latency_ms && (
                        <span className="text-xs text-slate-400 font-mono">({health.database.latency_ms} ms)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold text-red-800">Error de Conexión</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Esquema 001 aplicado • SQLite compatible en la nube
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex items-center space-x-3 mb-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Zona Horaria Oficial</span>
                </div>
                <span className="text-sm font-semibold text-slate-800">{health.timezone}</span>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {new Date(health.timestamp_local).toLocaleString('es-AR', {
                    dateStyle: 'medium',
                    timeStyle: 'medium'
                  })}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex items-center space-x-3 mb-2">
                  <Activity className="w-5 h-5 text-rose-600" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Canal Seguro</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-800">Cookies HttpOnly + SameSite</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Protección contra XSS y secuestro de tokens
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Comando de desarrollo: <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">pnpm run dev</code></span>
            <span className="text-emerald-700 font-medium">✓ Autenticación operativa</span>
          </div>
        </motion.div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-400 pt-6">
        Mercería CRM — Software de Control de Stock y Ventas • Argentina
      </footer>
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}

export default App
