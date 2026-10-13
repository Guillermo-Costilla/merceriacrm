import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Receipt,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  Download
} from 'lucide-react'
import type { Sale } from '../types/sale'
import { saleService } from '../services/saleService'
import { formatCurrency, formatQuantity, formatDateTime } from '../utils/formatters'
import { ApiError } from '../services/api'

export const SalesHistory: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Filtros
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')

  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalSales, setTotalSales] = useState<number>(0)
  const [isExporting, setIsExporting] = useState<boolean>(false)

  // Modales
  const [viewSale, setViewSale] = useState<Sale | null>(null)
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null)
  const [cancellationReason, setCancellationReason] = useState<string>('')
  const [isCancelling, setIsCancelling] = useState<boolean>(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // Debounce de búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Cargar ventas
  const loadSales = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await saleService.getSales({
        year: selectedYear,
        month: selectedMonth,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        search: debouncedSearch || undefined,
        page: currentPage,
        page_size: 20
      })
      setSales(res.items)
      setTotalPages(res.total_pages)
      setTotalSales(res.total)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('No se pudo cargar el historial de ventas.')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedMonth, selectedStatus, debouncedSearch, currentPage])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  // Abrir detalle
  const handleOpenDetail = async (sale: Sale) => {
    try {
      const full = await saleService.getSale(sale.id)
      setViewSale(full)
    } catch {
      setViewSale(sale)
    }
  }

  // Anular venta
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!saleToCancel) return

    const reason = cancellationReason.trim()
    if (reason.length < 5) {
      setCancelError('El motivo debe contener al menos 5 caracteres explicativos.')
      return
    }

    setIsCancelling(true)
    setCancelError(null)

    try {
      await saleService.cancelSale(saleToCancel.id, { cancellation_reason: reason })
      setActionNotice(`La Venta #${saleToCancel.sale_number} ha sido anulada y el stock fue restablecido.`)
      setSaleToCancel(null)
      setCancellationReason('')
      loadSales()
      setTimeout(() => setActionNotice(null), 5000)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCancelError(err.message)
      } else {
        setCancelError('Error al intentar anular la venta.')
      }
    } finally {
      setIsCancelling(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    setErrorMessage(null)
    try {
      const file = await saleService.exportSalesXlsx(selectedYear, selectedMonth)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `ventas_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'No se pudo exportar el informe de ventas. Intente nuevamente.'
      )
    } finally {
      setIsExporting(false)
    }
  }

  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ]

  const years = [2024, 2025, 2026, 2027]

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            Historial de Ventas y Comprobantes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro cronológico de operaciones, desglose de artículos y anulación de comprobantes
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? 'Preparando Excel...' : 'Exportar Excel'}
        </button>
      </div>

      {/* Alerta de notificación temporal */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2 shadow-2xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtros de Búsqueda y Período */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Buscador */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número de comprobante (#) o notas..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 placeholder:text-slate-400"
          />
        </div>

        {/* Mes */}
        <div className="md:col-span-3">
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white text-slate-800"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Año */}
        <div className="md:col-span-2">
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white text-slate-800"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div className="md:col-span-2">
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white text-slate-800"
          >
            <option value="all">Todos los estados</option>
            <option value="COMPLETED">Completadas</option>
            <option value="CANCELLED">Anuladas</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabla de Ventas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-indigo-500 mb-2" />
            <p className="text-xs">Cargando ventas del período...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No se encontraron ventas</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No hay operaciones registradas para el período o filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Comprobante</th>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4 text-right">Total Cobrado</th>
                  <th className="py-3 px-4 text-right">Ganancia Est.</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4">Observaciones</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => {
                  const isCompleted = sale.status === 'COMPLETED'
                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        !isCompleted ? 'bg-slate-50/40 opacity-75' : ''
                      }`}
                    >
                      {/* Número de Venta */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          #{String(sale.sale_number).padStart(5, '0')}
                        </span>
                      </td>

                      {/* Fecha */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateTime(sale.sale_date)}
                      </td>

                      {/* Total Cobrado */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-sm">
                        {formatCurrency(sale.total_cents)}
                      </td>

                      {/* Ganancia Estimada */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(sale.estimated_gross_profit_cents)}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Completada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 text-red-600" />
                            Anulada
                          </span>
                        )}
                      </td>

                      {/* Notas */}
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={sale.notes || ''}>
                        {sale.notes || <span className="text-slate-300">-</span>}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenDetail(sale)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Ver desglose de la venta"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isCompleted && (
                            <button
                              onClick={() => {
                                setSaleToCancel(sale)
                                setCancellationReason('')
                                setCancelError(null)
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Anular venta y reingresar stock"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="py-3 px-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>
              Página <strong className="text-slate-700">{currentPage}</strong> de <strong className="text-slate-700">{totalPages}</strong> ({totalSales} ventas)
            </span>
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: DETALLE DE LA VENTA */}
      <AnimatePresence>
        {viewSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-800">
                    Detalle de Venta #{String(viewSale.sale_number).padStart(5, '0')}
                  </h3>
                </div>
                <button
                  onClick={() => setViewSale(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                {/* Meta info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Fecha</span>
                    <span className="font-semibold text-slate-800">{formatDateTime(viewSale.sale_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Estado</span>
                    <span className="font-semibold text-slate-800">{viewSale.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Cobrado</span>
                    <span className="font-bold font-mono text-slate-900">{formatCurrency(viewSale.total_cents)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Ganancia Bruta</span>
                    <span className="font-bold font-mono text-emerald-700">
                      {formatCurrency(viewSale.estimated_gross_profit_cents)}
                    </span>
                  </div>
                </div>

                {/* Si fue anulada */}
                {viewSale.status === 'CANCELLED' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Comprobante Anulado
                    </div>
                    <p className="mt-1">
                      <strong>Motivo:</strong> {viewSale.cancellation_reason || 'Sin motivo registrado'}
                    </p>
                    {viewSale.cancelled_at && (
                      <p className="text-[10px] text-red-600 mt-0.5">
                        Fecha de anulación: {formatDateTime(viewSale.cancelled_at)}
                      </p>
                    )}
                  </div>
                )}

                {/* Desglose de Artículos */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">Líneas de Producto</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 text-[11px]">
                          <th className="py-2 px-3">Producto</th>
                          <th className="py-2 px-3 text-right">Cantidad</th>
                          <th className="py-2 px-3 text-right">Precio Unit.</th>
                          <th className="py-2 px-3 text-right">Costo Unit.</th>
                          <th className="py-2 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewSale.items?.map((it) => (
                          <tr key={it.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-900">{it.product_name}</span>
                              <span className="font-mono text-[10px] text-slate-400 block">{it.product_sku}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-medium">
                              {formatQuantity(it.quantity, it.unit_of_measure)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatCurrency(it.unit_price_cents)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-400">
                              {formatCurrency(it.unit_cost_cents)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(it.subtotal_cents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {viewSale.notes && (
                  <div className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                    <strong className="block text-slate-700 mb-0.5">Observaciones:</strong>
                    {viewSale.notes}
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setViewSale(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CONFIRMACIÓN DE ANULACIÓN */}
      <AnimatePresence>
        {saleToCancel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden"
            >
              <form onSubmit={handleConfirmCancel}>
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="text-base font-bold text-slate-800">
                      Anular Venta #{saleToCancel.sale_number}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSaleToCancel(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-3 text-xs">
                  <p className="text-slate-600 leading-relaxed">
                    Al anular esta venta, <strong>el stock de los artículos vendidos se reintegrará automáticamente</strong> al catálogo
                    y quedará un registro inmutable de auditoría.
                  </p>

                  {cancelError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700">
                      {cancelError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Motivo de la anulación <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      minLength={5}
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      placeholder="Indique la causa (ej. Cliente devolvió el artículo, error de facturación...)"
                      rows={3}
                      className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setSaleToCancel(null)}
                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCancelling}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    {isCancelling ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Anulando...</span>
                      </>
                    ) : (
                      <span>Confirmar Anulación</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
