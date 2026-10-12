import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Boxes, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  History,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  TrendingDown
} from 'lucide-react'
import type { 
  InventoryMovement, 
  InventoryMovementCreateData, 
  InventoryReconciliationReport 
} from '../types/inventory'
import type { Product } from '../types/product'
import { inventoryService } from '../services/inventoryService'
import { productService } from '../services/productService'
import { formatQuantity, formatDateTime } from '../utils/formatters'
import { MovementModal } from '../components/inventory/MovementModal'
import { ApiError } from '../services/api'

export const Inventory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'movements' | 'reconciliation'>('movements')
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filtros de movimientos
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [movementType, setMovementType] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalMovements, setTotalMovements] = useState<number>(0)

  // Modal de registro
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Reporte de Reconciliación
  const [reconciliationReport, setReconciliationReport] = useState<InventoryReconciliationReport | null>(null)
  const [reconLoading, setReconLoading] = useState<boolean>(false)

  // Debounce para búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Cargar productos para el modal selector
  const loadProducts = async () => {
    try {
      const res = await productService.getProducts({ page_size: 100, is_active: true })
      setProducts(res.items)
    } catch {
      // Manejo silencioso de carga
    }
  }

  // Cargar movimientos
  const loadMovements = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await inventoryService.getMovements({
        search: debouncedSearch || undefined,
        movement_type: movementType !== 'all' ? movementType : undefined,
        page: currentPage,
        page_size: 20,
      })
      setMovements(res.items)
      setTotalPages(res.total_pages)
      setTotalMovements(res.total)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('No se pudieron cargar los movimientos de inventario.')
      }
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, movementType, currentPage])

  // Cargar reporte de reconciliación
  const loadReconciliation = async () => {
    setReconLoading(true)
    try {
      const rep = await inventoryService.getReconciliation()
      setReconciliationReport(rep)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      }
    } finally {
      setReconLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (activeTab === 'movements') {
      loadMovements()
    } else {
      loadReconciliation()
    }
  }, [activeTab, loadMovements])

  const handleSaveMovement = async (data: InventoryMovementCreateData) => {
    const created = await inventoryService.createMovement(data)
    setActionNotice(`Movimiento de ${data.quantity} para '${created.product_name}' registrado exitosamente.`)
    loadMovements()
    loadProducts()
    setTimeout(() => setActionNotice(null), 4000)
  }

  const renderMovementBadge = (type: string) => {
    switch (type) {
      case 'PURCHASE_ENTRY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <ArrowUpRight className="w-3 h-3 text-emerald-600" />
            Entrada de Compra
          </span>
        )
      case 'SALE_EXIT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
            <ArrowDownRight className="w-3 h-3 text-blue-600" />
            Salida por Venta
          </span>
        )
      case 'SALE_REVERSION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
            <RefreshCw className="w-3 h-3 text-purple-600" />
            Anulación Venta
          </span>
        )
      case 'ADJUSTMENT_POSITIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800">
            <SlidersHorizontal className="w-3 h-3 text-indigo-600" />
            Ajuste (+)
          </span>
        )
      case 'ADJUSTMENT_NEGATIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            <TrendingDown className="w-3 h-3 text-amber-600" />
            Ajuste (-) Merma
          </span>
        )
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">{type}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-600" />
            Inventario y Movimientos de Stock
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro de entradas de mercadería, ajustes de stock y reconciliación de saldos
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-indigo-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar Movimiento
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

      {/* Barra de pestañas secundarias */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'movements'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Historial de Movimientos ({totalMovements})
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'reconciliation'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Auditoría de Reconciliación
        </button>
      </div>

      {/* VISTA 1: MOVIMIENTOS HISTÓRICOS */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por producto, código SKU o motivo del movimiento..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 placeholder:text-slate-400"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={movementType}
                onChange={(e) => {
                  setMovementType(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-800"
              >
                <option value="all">Todos los tipos de movimiento</option>
                <option value="PURCHASE_ENTRY">Entradas de compra</option>
                <option value="SALE_EXIT">Salidas por venta</option>
                <option value="SALE_REVERSION">Anulaciones de venta</option>
                <option value="ADJUSTMENT_POSITIVE">Ajustes positivos (+)</option>
                <option value="ADJUSTMENT_NEGATIVE">Ajustes negativos (-)</option>
              </select>
            </div>
          </div>

          {/* Mensaje de error si hubo fallo */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tabla de Movimientos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs">Cargando movimientos de stock...</p>
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-700">No se encontraron movimientos</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchTerm || movementType !== 'all'
                    ? 'No hay registros que coincidan con los filtros seleccionados.'
                    : 'Aún no se han registrado movimientos manuales o ventas en el sistema.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-600 font-semibold">
                      <th className="py-3 px-4">Fecha y Hora</th>
                      <th className="py-3 px-4">Código / Producto</th>
                      <th className="py-3 px-4">Operación</th>
                      <th className="py-3 px-4 text-right">Cantidad</th>
                      <th className="py-3 px-4 text-right">Saldo Previo</th>
                      <th className="py-3 px-4 text-right">Saldo Resultante</th>
                      <th className="py-3 px-4">Motivo / Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {formatDateTime(mov.created_at)}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded mr-1">
                            {mov.product_sku}
                          </span>
                          <span className="font-semibold text-slate-800">{mov.product_name}</span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderMovementBadge(mov.movement_type)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatQuantity(mov.quantity, mov.unit_of_measure)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-slate-400 whitespace-nowrap">
                          {formatQuantity(mov.previous_stock, mov.unit_of_measure)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {formatQuantity(mov.resulting_stock, mov.unit_of_measure)}
                        </td>

                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={mov.reason}>
                          {mov.reason}
                          {mov.created_by_user_name && (
                            <span className="block text-[10px] text-slate-400">por {mov.created_by_user_name}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="py-3 px-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <span>
                  Página <strong className="text-slate-700">{currentPage}</strong> de <strong className="text-slate-700">{totalPages}</strong> ({totalMovements} registros)
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
        </div>
      )}

      {/* VISTA 2: AUDITORÍA DE RECONCILIACIÓN */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                {reconciliationReport?.is_fully_consistent ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Inventario 100% Consistente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    Se detectaron discrepancias
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-800 mt-2">
                Conciliación Matemática de Inventario
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verifica que el stock actual en catálogo coincida exactamente con la suma histórica de entradas, salidas y ajustes.
              </p>
            </div>

            <button
              onClick={loadReconciliation}
              disabled={reconLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconLoading ? 'animate-spin' : ''}`} />
              Recalcular Auditoría
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {reconLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs">Auditando base de datos...</p>
              </div>
            ) : reconciliationReport?.items.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No hay productos registrados para auditar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-600 font-semibold">
                      <th className="py-3 px-4">Código / SKU</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4 text-right">Stock en Catálogo</th>
                      <th className="py-3 px-4 text-right">Stock por Movimientos</th>
                      <th className="py-3 px-4 text-right">Diferencia</th>
                      <th className="py-3 px-4 text-center">Estado Auditoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reconciliationReport?.items.map((item) => (
                      <tr key={item.product_id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-medium text-slate-600">
                          {item.sku}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.product_name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          {formatQuantity(item.current_stock, item.unit_of_measure)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                          {formatQuantity(item.calculated_stock, item.unit_of_measure)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {item.difference === 0 ? (
                            <span className="text-slate-400">0.00</span>
                          ) : (
                            <span className="font-bold text-red-600">{item.difference}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.is_consistent ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Exacto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/50">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              Descuadre
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Registro de Movimiento */}
      <MovementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMovement}
        products={products}
      />
    </div>
  )
}
