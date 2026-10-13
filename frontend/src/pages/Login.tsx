import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Lock, 
  Mail, 
  Upload,
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Moon,
  Sun,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services/authService'
import { ApiError } from '../services/api'

interface LoginProps {
  isDarkTheme: boolean
  onToggleTheme: () => void
}

export const Login: React.FC<LoginProps> = ({ isDarkTheme, onToggleTheme }) => {
  const { login, register } = useAuth()
  const [isRegistering, setIsRegistering] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [businessLogo, setBusinessLogo] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('El logo debe ser una imagen PNG, JPG o WEBP.')
      event.target.value = ''
      return
    }

    if (file.size > 512 * 1024) {
      setErrorMessage('El logo no puede superar los 512 KB.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setErrorMessage('No se pudo leer el archivo del logo.')
        return
      }
      setBusinessLogo(reader.result)
      setErrorMessage(null)
    }
    reader.onerror = () => setErrorMessage('No se pudo leer el archivo del logo.')
    reader.readAsDataURL(file)
  }

  // Modal de recuperación
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null)
  const [forgotError, setForgotError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setLoading(true)

    try {
      if (isRegistering) {
        await register(businessName, fullName, email, password, businessLogo)
      } else {
        await login(email, password)
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Ocurrió un error inesperado al intentar iniciar sesión.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)
    setForgotSuccess(null)
    setForgotLoading(true)

    try {
      const res = await authService.forgotPassword(forgotEmail)
      setForgotSuccess(res.message)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setForgotError(err.message)
      } else {
        setForgotError('No se pudo enviar la solicitud de recuperación.')
      }
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-rose-50/50 via-slate-50 to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={isDarkTheme ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        title={isDarkTheme ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {isDarkTheme ? 'Tema claro' : 'Tema oscuro'}
      </button>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex justify-center"
        >
          <img
            src="/trazos-logo.jpg"
            alt="Trazos Librería"
            className="h-40 w-40 rounded-2xl object-contain"
          />
        </motion.div>
        <motion.h2 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900"
        >
          Trazos Librería
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mt-1 text-center text-sm text-slate-500"
        >
          Sistema de Control de Inventario y Ventas
        </motion.p>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0"
      >
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-800">
              {isRegistering ? 'Crear cuenta de tu comercio' : 'Iniciar Sesión'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isRegistering
                ? 'Tu catálogo, inventario y ventas serán privados para tu comercio.'
                : 'Ingresa tus credenciales para acceder a tu comercio.'}
            </p>
          </div>

          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 text-xs"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <>
                <div>
                  <label htmlFor="business-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nombre del comercio
                  </label>
                  <input
                    id="business-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Mi comercio"
                    className="block w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 placeholder:text-slate-400 bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="business-logo" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Logo del comercio <span className="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    {businessLogo ? (
                      <img src={businessLogo} alt="Vista previa del logo" className="h-12 w-12 rounded-lg border border-slate-200 object-contain p-1" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg border border-dashed border-slate-300 bg-slate-50" />
                    )}
                    <label
                      htmlFor="business-logo"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Upload className="h-4 w-4" />
                      {businessLogo ? 'Cambiar logo' : 'Elegir archivo'}
                    </label>
                    {businessLogo && (
                      <button
                        type="button"
                        onClick={() => setBusinessLogo(null)}
                        className="text-xs font-medium text-slate-500 hover:text-red-600"
                      >
                        Quitar
                      </button>
                    )}
                    <input
                      id="business-logo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      className="sr-only"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">PNG, JPG o WEBP; máximo 512 KB. Se usará en la aplicación y como favicon.</p>
                </div>
                <div>
                  <label htmlFor="full-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tu nombre completo
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nombre y apellido"
                    className="block w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 placeholder:text-slate-400 bg-white transition-all outline-none"
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 placeholder:text-slate-400 bg-white transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={isRegistering ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 placeholder:text-slate-400 bg-white transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-rose-200"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Iniciando sesión...
                  </>
                ) : (
                  isRegistering ? 'Crear cuenta y continuar' : 'Ingresar al Sistema'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="mb-3 text-center text-xs text-slate-600">
              {isRegistering ? '¿Ya tienes una cuenta?' : '¿Primera vez aquí?'}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering)
                setErrorMessage(null)
              }}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-rose-200 rounded-xl text-sm font-semibold text-rose-700 bg-white hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-all"
            >
              {isRegistering ? 'Volver a iniciar sesión' : 'Crear cuenta de mi comercio'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Modal de recuperación de contraseña */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative"
            >
              <button
                onClick={() => {
                  setIsForgotModalOpen(false)
                  setForgotError(null)
                  setForgotSuccess(null)
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Recuperar Contraseña</h3>
                  <p className="text-xs text-slate-500">Recibirá un enlace temporal para crear una nueva clave</p>
                </div>
              </div>

              {forgotSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start space-x-3 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Solicitud procesada</p>
                    <p className="mt-1">{forgotSuccess}</p>
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      className="mt-3 inline-block px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-medium hover:bg-emerald-800"
                    >
                      Volver al inicio de sesión
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {forgotError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Correo Electrónico Registrado
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="propietario@correo.com"
                      className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 outline-none"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 flex items-center"
                    >
                      {forgotLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                      Enviar Instrucciones
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
