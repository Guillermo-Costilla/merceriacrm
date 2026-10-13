import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  X, 
  ShoppingBag, 
  Plus, 
  Sparkles, 
  AlertCircle, 
  RefreshCw
} from 'lucide-react'
import type { 
  Product, 
  Category, 
  ProductCreateData, 
  ProductUpdateData, 
  UnitOfMeasure 
} from '../../types/product'
import { categoryService } from '../../services/productService'
import {
  centsToDecimalString,
  formatLocalizedQuantity,
  parseCurrencyToCents,
  parseLocalizedQuantity,
} from '../../utils/formatters'
import { ApiError } from '../../services/api'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: ProductCreateData | ProductUpdateData) => Promise<void>
  productToEdit?: Product | null
  categories: Category[]
  onCategoryCreated: (category: Category) => void
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  categories,
  onCategoryCreated,
}) => {
  const isEditing = Boolean(productToEdit)

  // Campos de formulario
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [costInput, setCostInput] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [currentStock, setCurrentStock] = useState('')
  const [minStock, setMinStock] = useState('')
  const [unitOfMeasure, setUnitOfMeasure] = useState<UnitOfMeasure>('unidad')
  const [isFractional, setIsFractional] = useState<boolean>(false)

  // Estado UI
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Modal secundaria para crear nueva categoría inline
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catLoading, setCatLoading] = useState(false)

  useEffect(() => {
    if (productToEdit) {
      setSku(productToEdit.sku)
      setName(productToEdit.name)
      setCategoryId(productToEdit.category_id || '')
      setDescription(productToEdit.description || '')
      setCostInput(centsToDecimalString(productToEdit.cost_cents))
      setPriceInput(centsToDecimalString(productToEdit.price_cents))
      setCurrentStock(formatLocalizedQuantity(productToEdit.current_stock))
      setMinStock(formatLocalizedQuantity(productToEdit.min_stock))
      setUnitOfMeasure(productToEdit.unit_of_measure)
      setIsFractional(productToEdit.is_fractional)
    } else {
      setSku('')
      setName('')
      setCategoryId('')
      setDescription('')
      setCostInput('')
      setPriceInput('')
      setCurrentStock('')
      setMinStock('')
      setUnitOfMeasure('unidad')
      setIsFractional(false)
    }
    setErrorMessage(null)
  }, [productToEdit, isOpen])

  // Ajustar fraccionabilidad automáticamente al cambiar unidad
  const handleUnitChange = (unit: UnitOfMeasure) => {
    setUnitOfMeasure(unit)
    if (['metro', 'centimetro', 'gramo'].includes(unit)) {
      setIsFractional(true)
    } else if (unit === 'unidad') {
      setIsFractional(false)
      setCurrentStock((prev) => {
        const quantity = parseLocalizedQuantity(prev)
        return quantity === null ? prev : String(Math.floor(quantity))
      })
      setMinStock((prev) => {
        const quantity = parseLocalizedQuantity(prev)
        return quantity === null ? prev : String(Math.floor(quantity))
      })
    }
  }

  const generateRandomSku = () => {
    const prefix = name ? name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD') : 'ART'
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    setSku(`${prefix}-${randomNum}`)
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setCatLoading(true)
    try {
      const created = await categoryService.createCategory(newCatName.trim())
      onCategoryCreated(created)
      setCategoryId(created.id)
      setNewCatName('')
      setIsNewCategoryOpen(false)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      }
    } finally {
      setCatLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!sku.trim()) {
      setErrorMessage('El código o SKU es obligatorio.')
      return
    }
    if (!name.trim()) {
      setErrorMessage('El nombre del producto es obligatorio.')
      return
    }

    const costCents = parseCurrencyToCents(costInput)
    const priceCents = parseCurrencyToCents(priceInput)
    const parsedCurrentStock = parseLocalizedQuantity(currentStock)
    const parsedMinStock = parseLocalizedQuantity(minStock)

    if (costCents === null || priceCents === null) {
      setErrorMessage('Ingrese costos y precios válidos en pesos argentinos (ej: 1.250,50).')
      return
    }

    if (parsedCurrentStock === null || parsedMinStock === null) {
      setErrorMessage('Ingrese el stock actual y mínimo. Use enteros o decimales con coma para cantidades fraccionables.')
      return
    }

    if (costCents < 0 || priceCents < 0 || parsedCurrentStock < 0 || parsedMinStock < 0) {
      setErrorMessage('Los costos, precios y cantidades no pueden ser negativos.')
      return
    }

    if (!isFractional && (parsedCurrentStock % 1 !== 0 || parsedMinStock % 1 !== 0)) {
      setErrorMessage(`Para la unidad '${unitOfMeasure}', las cantidades deben ser números enteros.`)
      return
    }

    setLoading(true)
    try {
      const payload: ProductCreateData = {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category_id: categoryId ? categoryId : null,
        description: description.trim() ? description.trim() : null,
        cost_cents: costCents,
        price_cents: priceCents,
        current_stock: parsedCurrentStock,
        min_stock: parsedMinStock,
        unit_of_measure: unitOfMeasure,
        is_fractional: isFractional,
      }

      await onSave(payload)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Ocurrió un error al guardar el producto.')
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
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative my-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing ? 'Modifique los datos y guarde los cambios' : 'Complete la ficha técnica para ingresarlo al catálogo'}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* SKU */}
            <div className="sm:col-span-1">
              <label htmlFor="modal-sku" className="block text-xs font-semibold text-slate-700 mb-1">
                Código / SKU <span className="text-rose-500">*</span>
              </label>
              <div className="flex space-x-1">
                <input
                  id="modal-sku"
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="BOT-001"
                  className="block w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                />
                {!isEditing && (
                  <button
                    type="button"
                    onClick={generateRandomSku}
                    className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Generar código sugerido"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Nombre */}
            <div className="sm:col-span-2">
              <label htmlFor="modal-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Producto <span className="text-rose-500">*</span>
              </label>
              <input
                id="modal-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej: Cinta Raso 25mm Blanca"
                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Categoría */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="modal-cat" className="block text-xs font-semibold text-slate-700">
                  Categoría
                </label>
                <button
                  type="button"
                  onClick={() => setIsNewCategoryOpen(true)}
                  className="text-[11px] font-medium text-rose-600 hover:text-rose-700 flex items-center"
                >
                  <Plus className="w-3 h-3 mr-0.5" /> Nueva
                </button>
              </div>
              <select
                id="modal-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-white"
              >
                <option value="">Sin categoría asignada</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unidad de Medida */}
            <div>
              <label htmlFor="modal-unit" className="block text-xs font-semibold text-slate-700 mb-1">
                Unidad de Medida
              </label>
              <select
                id="modal-unit"
                value={unitOfMeasure}
                onChange={(e) => handleUnitChange(e.target.value as UnitOfMeasure)}
                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-white"
              >
                <option value="unidad">Unidad (Botones, agujas, hilos)</option>
                <option value="metro">Metro (Cintas, elásticos, puntillas)</option>
                <option value="paquete">Paquete (Cajas, kits)</option>
                <option value="rollo">Rollo completo</option>
                <option value="centimetro">Centímetro</option>
                <option value="gramo">Gramo</option>
              </select>
            </div>
          </div>

          {/* Fraccionabilidad indicator */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs">
            <div>
              <span className="font-semibold text-slate-700">Permite cantidades fraccionadas:</span>
              <p className="text-[11px] text-slate-500">
                {isFractional ? 'Habilitado: admite decimales (ej: 1,25 metros)' : 'Deshabilitado: solo cantidades enteras (ej: 1, 2 unidades)'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isFractional}
                onChange={(e) => setIsFractional(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {/* Precios y Costos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label htmlFor="modal-cost" className="block text-xs font-semibold text-slate-700 mb-1">
                Costo de Compra (ARS $)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">$</span>
                <input
                  id="modal-cost"
                  type="text"
                  inputMode="decimal"
                  required
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="Ej. 1.250,50"
                  className="block w-full pl-7 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="modal-price" className="block text-xs font-semibold text-slate-700 mb-1">
                Precio de Venta Habitual (ARS $) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">$</span>
                <input
                  id="modal-price"
                  type="text"
                  inputMode="decimal"
                  required
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Ej. 1.800,00"
                  className="block w-full pl-7 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none font-semibold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Stock y Stock Mínimo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-stock" className="block text-xs font-semibold text-slate-700 mb-1">
                Stock Actual ({unitOfMeasure})
              </label>
              <input
                id="modal-stock"
                type="text"
                inputMode={isFractional ? 'decimal' : 'numeric'}
                required
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                placeholder={isFractional ? 'Ej. 1,99' : 'Ej. 10'}
                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              />
            </div>

            <div>
              <label htmlFor="modal-minstock" className="block text-xs font-semibold text-slate-700 mb-1">
                Stock Mínimo (Alerta de reposición)
              </label>
              <input
                id="modal-minstock"
                type="text"
                inputMode={isFractional ? 'decimal' : 'numeric'}
                required
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder={isFractional ? 'Ej. 1,99' : 'Ej. 5'}
                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              />
            </div>
          </div>

          {/* Descripción opcional */}
          <div>
            <label htmlFor="modal-desc" className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción o Detalle (Opcional)
            </label>
            <textarea
              id="modal-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles de color, fabricante, material..."
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none resize-none"
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
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs shadow-rose-200 disabled:opacity-50 flex items-center"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </div>
        </form>

        {/* Submodal para Crear Categoría */}
        <AnimatePresence>
          {isNewCategoryOpen && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xs rounded-2xl flex items-center justify-center p-6 z-10">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-800">Nueva Categoría</h4>
                  <button
                    onClick={() => setIsNewCategoryOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleCreateCategory}>
                  <label htmlFor="new-cat-name" className="block text-xs text-slate-600 mb-1">Nombre de la categoría</label>
                  <input
                    id="new-cat-name"
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="ej: Hilos de Bordar"
                    className="block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-rose-500 mb-4"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsNewCategoryOpen(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={catLoading || !newCatName.trim()}
                      className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 flex items-center"
                    >
                      {catLoading && <RefreshCw className="w-3 h-3 animate-spin mr-1" />}
                      Crear
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
