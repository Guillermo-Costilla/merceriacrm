import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Database, 
  Clock, 
  Server, 
  RefreshCw,
  LogOut,
  UserCheck,
  ShieldCheck,
  Package,
  Boxes,
  ShoppingCart,
  Receipt,
  BarChart3
} from 'lucide-react'

import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Products } from './pages/Products'
import { Inventory } from './pages/Inventory'
import { NewSale } from './pages/NewSale'
import { SalesHistory } from './pages/SalesHistory'

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sales_new' | 'sales_history' | 'products' | 'inventory' | 'system'>('dashboard')
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/trazos-logo.jpg"
              alt="Trazos Librería"
              className="h-12 w-12 rounded-xl object-contain"
            />
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">Trazos Librería</h1>
              <p className="text-[11px] text-slate-500 leading-none mt-1">Control de Stock y Ventas</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-xl">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
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
        </div>

        {/* Barra de Navegación de Pestañas */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex space-x-1 border-t border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2.5 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'dashboard'
                ? 'border-rose-600 text-rose-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-rose-600" />
            Dashboard & Rentabilidad
          </button>
          <button
            onClick={() => setActiveTab('sales_new')}
            className={`py-2.5 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'sales_new'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            Nueva Venta (Cobro)
          </button>
          <button
            onClick={() => setActiveTab('sales_history')}
            className={`py-2.5 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'sales_history'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4 text-indigo-600" />
            Historial de Ventas
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-2.5 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'products'
                ? 'border-rose-600 text-rose-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Package className="w-4 h-4 text-rose-600" />
            Catálogo de Productos
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-2.5 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'inventory'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Boxes className="w-4 h-4 text-indigo-600" />
            Inventario & Movimientos
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`py-2.5 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'system'
                ? 'border-slate-700 text-slate-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-slate-600" />
            Estado del Sistema & BD
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        {activeTab === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Dashboard
              onNavigateToPOS={() => setActiveTab('sales_new')}
              onNavigateToStockAlerts={() => setActiveTab('products')}
            />
          </motion.div>
        )}

        {activeTab === 'sales_new' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <NewSale
              onNavigateToHistory={() => setActiveTab('sales_history')}
            />
          </motion.div>
        )}

        {activeTab === 'sales_history' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SalesHistory />
          </motion.div>
        )}

        {activeTab === 'products' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Products />
          </motion.div>
        )}

        {activeTab === 'inventory' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Inventory />
          </motion.div>
        )}

        {activeTab === 'system' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Fase 5: Módulo de Productos Operativo
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-slate-800 mt-2">
                  Diagnóstico y Salud de Servicios
                </h2>
                <p className="text-sm text-slate-500">
                  Verificación de conectividad en tiempo real: Frontend (Vite) ⇄ Backend (FastAPI) ⇄ Base de Datos (Turso).
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
                    Esquema 001 aplicado • SQLite distribuido en AWS US-East-1
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
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Seguridad de Sesión</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-800">HttpOnly + SameSite=Lax</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Protección contra XSS y secuestro de sesión
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-400 py-4 border-t border-slate-200">
        Trazos Librería — Software de Control de Stock y Ventas • Argentina
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
