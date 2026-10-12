import React, { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { 
  X, 
  ArrowUpRight, 
  ArrowDownRight, 
  SlidersHorizontal, 
  AlertCircle, 
  RefreshCw,
  Box
} from 'lucide-react'
import type { Product } from '../../types/product'
import type { InventoryMovementCreateData } from '../../types/inventory'
import { formatQuantity } from '../../utils/formatters'
import { ApiError } from '../../services/api'

interface MovementModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: InventoryMovementCreateData) => Promise<void>
  products: Product[]
  initialProductId?: string
}

export const MovementModal: React.FC<MovementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  products,
  initialProductId,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [movementType, setMovementType] = useState<'PURCHASE_ENTRY' | 'ADJUSTMENT_POSITIVE' | 'ADJUSTMENT_NEGATIVE'>('PURCHASE_ENTRY')
  const [quantity, setQuantity] = useState<number>(1)
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(initialProductId || (products.length > 0 ? products[0].id : ''))
      setMovementType('PURCHASE_ENTRY')
      setQuantity(1)
      setReason('')
      setErrorMessage(null)
    }
  }, [isOpen, initialProductId, products])

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  // Calcular saldo resultante proyectado
  const currentStock = selectedProduct ? selectedProduct.current_stock : 0
  const isFractional = selectedProduct ? selectedProduct.is_fractional : false
  const unit = selectedProduct ? selectedProduct.unit_of_measure : 'unidad'

  let resultingStock = currentStock
  if (movementType === 'PURCHASE_ENTRY' || movementType === 'ADJUSTMENT_POSITIVE') {
    resultingStock = currentStock + (quantity || 0)
  } else if (movementType === 'ADJUSTMENT_NEGATIVE') {
    resultingStock = currentStock - (quantity || 0)
  }
  resultingStock = Math.round(resultingStock * 1000) / 1000

  const isExcessiveReduction = movementType === 'ADJUSTMENT_NEGATIVE' && resultingStock < 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedProductId) {
      setErrorMessage('Debe seleccionar un producto.')
      return
    }

    if (!quantity || quantity <= 0) {
      setErrorMessage('La cantidad debe ser mayor a 0.')
      return
    }

    if (!isFractional && quantity % 1 !== 0) {
      setErrorMessage(`El producto seleccionado (${unit}) solo admite cantidades enteras.`)
      return
    }

    if (isExcessiveReduction) {
      setErrorMessage('El ajuste negativo supera el stock actual disponible.')
      return
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMessage('El motivo es obligatorio (mínimo 3 caracteres).')
      return
    }

    setLoading(true)
    try {
      await onSave({
        product_id: selectedProductId,
        movement_type: movementType,
        quantity: quantity,
        reason: reason.trim(),
      })
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Ocurrió un error al registrar el movimiento.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Registrar Movimiento de Stock</h3>
            <p className="text-xs text-slate-500">Ingreso de compras o ajustes auditados de inventario</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector de Producto */}
          <div>
            <label htmlFor="mov-product" className="block text-xs font-semibold text-slate-700 mb-1">
              Producto <span className="text-rose-500">*</span>
            </label>
            <select
              id="mov-product"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-900"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name} (Stock actual: {formatQuantity(p.current_stock, p.unit_of_measure)})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Movimiento */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipo de Movimiento <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMovementType('PURCHASE_ENTRY')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  movementType === 'PURCHASE_ENTRY'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Entrada</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Compra mercadería</p>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('ADJUSTMENT_POSITIVE')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  movementType === 'ADJUSTMENT_POSITIVE'
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-700">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Ajuste (+)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Sobrante / Conteo</p>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('ADJUSTMENT_NEGATIVE')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  movementType === 'ADJUSTMENT_NEGATIVE'
                    ? 'border-red-500 bg-red-50/50 text-red-900 ring-2 ring-red-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 text-xs font-bold text-red-700">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Ajuste (-)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Merma / Pérdida</p>
              </button>
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="mov-qty" className="block text-xs font-semibold text-slate-700">
                Cantidad a Operar ({unit}) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Stock actual: <strong>{formatQuantity(currentStock, unit)}</strong>
              </span>
            </div>
            <input
              id="mov-qty"
              type="number"
              step={isFractional ? '0.01' : '1'}
              min="0.001"
              required
              value={quantity || ''}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900"
            />
          </div>

          {/* Simulación en tiempo real de saldo resultante */}
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            isExcessiveReduction
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-slate-50 border-slate-200/80 text-slate-700'
          }`}>
            <span>Saldo resultante proyectado:</span>
            <span className={`font-mono font-bold text-sm ${isExcessiveReduction ? 'text-red-700' : 'text-slate-900'}`}>
              {formatQuantity(resultingStock, unit)}
            </span>
          </div>

          {/* Motivo Obligatorio */}
          <div>
            <label htmlFor="mov-reason" className="block text-xs font-semibold text-slate-700 mb-1">
              Motivo de la Operación <span className="text-rose-500">*</span>
            </label>
            <input
              id="mov-reason"
              type="text"
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ej: Factura Compra A #4592, Merma por cinta dañada, Conteo físico..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || isExcessiveReduction}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs shadow-indigo-200 disabled:opacity-50 flex items-center"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Confirmar Movimiento
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
