import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ShoppingCart,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Receipt,
  Package
} from 'lucide-react'
import type { Product } from '../types/product'
import type { Sale } from '../types/sale'
import { productService } from '../services/productService'
import { saleService } from '../services/saleService'
import {
  formatCurrency,
  formatQuantity,
  centsToDecimalString,
  formatLocalizedQuantity,
  parseCurrencyToCents,
  parseLocalizedQuantity,
} from '../utils/formatters'
import { ApiError } from '../services/api'

interface CartItem {
  product: Product
  quantity: number
  quantityInput: string
  unit_price_cents: number
  unitPriceInput: string
  subtotal_cents: number
}

interface NewSaleProps {
  onSaleCompleted?: (sale: Sale) => void
  onNavigateToHistory?: () => void
}

export const NewSale: React.FC<NewSaleProps> = ({ onSaleCompleted, onNavigateToHistory }) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)

  // Carrito de venta
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [notes, setNotes] = useState<string>('')

  // Estados de confirmación y feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)

  // Referencias para accesibilidad y clics fuera
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cargar catálogo de productos activos
  const loadActiveProducts = async () => {
    setLoadingProducts(true)
    try {
      const pageSize = 100
      const firstPage = await productService.getProducts({
        page: 1,
        page_size: pageSize,
        is_active: true
      })
      const allProducts = [...firstPage.items]

      for (let page = 2; page <= firstPage.total_pages; page += 1) {
        const res = await productService.getProducts({
          page,
          page_size: pageSize,
          is_active: true
        })
        allProducts.push(...res.items)
      }

      setProducts(allProducts)
    } catch {
      setErrorMessage('No se pudo cargar el catálogo de productos.')
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    loadActiveProducts()
  }, [])

  // Filtrar productos mientras el usuario escribe
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      setSearchResults([])
      setIsSearchOpen(false)
      return
    }

    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category_name && p.category_name.toLowerCase().includes(q))
    )
    setSearchResults(filtered.slice(0, 8))
    setIsSearchOpen(true)
  }, [searchQuery, products])

  // Cerrar desplegable si hace clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Agregar producto al carrito
  const addToCart = (product: Product) => {
    setErrorMessage(null)
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id)
      if (existingIndex > -1) {
        // Incrementar cantidad
        const updated = [...prev]
        const currentItem = updated[existingIndex]
        const newQty = roundQty(currentItem.quantity + 1, product.is_fractional)
        
        if (newQty > product.current_stock) {
          setErrorMessage(`Stock disponible insuficiente para '${product.name}'. Disponible: ${product.current_stock}`)
          return prev
        }

        const subtotal = Math.round(newQty * currentItem.unit_price_cents)
        updated[existingIndex] = {
          ...currentItem,
          quantity: newQty,
          quantityInput: formatLocalizedQuantity(newQty),
          subtotal_cents: subtotal
        }
        return updated
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 0,
            quantityInput: '',
            unit_price_cents: product.price_cents,
            unitPriceInput: centsToDecimalString(product.price_cents),
            subtotal_cents: 0
          }
        ]
      }
    })

    setSearchQuery('')
    setIsSearchOpen(false)
    searchInputRef.current?.focus()
  }

  const roundQty = (val: number, fractional: boolean): number => {
    return fractional ? Math.round(val * 1000) / 1000 : Math.round(val)
  }

  // Modificar cantidad
  const handleQuantityChange = (productId: string, rawVal: string) => {
    setErrorMessage(null)
    const parsedQuantity = parseLocalizedQuantity(rawVal)

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item

        const validQty = parsedQuantity !== null && (item.product.is_fractional || parsedQuantity % 1 === 0)
          ? roundQty(parsedQuantity, item.product.is_fractional)
          : 0
        if (validQty > item.product.current_stock) {
          setErrorMessage(`La cantidad solicitada supera el stock disponible (${item.product.current_stock} ${item.product.unit_of_measure}).`)
        }

        const subtotal = Math.round(validQty * item.unit_price_cents)
        return {
          ...item,
          quantityInput: rawVal,
          quantity: validQty,
          subtotal_cents: subtotal
        }
      })
    )
  }

  // Modificar precio unitario de la línea
  const handlePriceChange = (productId: string, rawVal: string) => {
    const cents = parseCurrencyToCents(rawVal) ?? 0
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item
        const subtotal = Math.round(item.quantity * cents)
        return {
          ...item,
          unitPriceInput: rawVal,
          unit_price_cents: cents,
          subtotal_cents: subtotal
        }
      })
    )
  }

  // Quitar del carrito
  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId))
  }

  // Vaciar carrito
  const handleClearCart = () => {
    if (cartItems.length > 0 && !window.confirm('¿Desea vaciar el carrito actual?')) return
    setCartItems([])
    setNotes('')
    setErrorMessage(null)
  }

  // Cálculos totales
  const totalCents = cartItems.reduce((acc, it) => acc + it.subtotal_cents, 0)
  const totalItemsCount = cartItems.reduce((acc, it) => acc + it.quantity, 0)

  // Confirmar y registrar venta
  const handleConfirmSale = async () => {
    if (cartItems.length === 0) {
      setErrorMessage('Agregue al menos un producto al carrito para registrar la venta.')
      return
    }

    // Validar stock antes de enviar
    for (const item of cartItems) {
      if (!item.quantityInput.trim() || item.quantity <= 0) {
        setErrorMessage(`Ingrese una cantidad válida para '${item.product.name}'.`)
        return
      }
      if (item.product.is_fractional ? parseLocalizedQuantity(item.quantityInput) === null : item.quantity % 1 !== 0) {
        setErrorMessage(`La cantidad de '${item.product.name}' debe ser ${item.product.is_fractional ? 'un decimal válido (ej: 1,99)' : 'un número entero'}.`)
        return
      }
      if (!item.unitPriceInput.trim() || parseCurrencyToCents(item.unitPriceInput) === null) {
        setErrorMessage(`Ingrese un precio válido en pesos argentinos para '${item.product.name}' (ej: 1.500,00).`)
        return
      }
      if (item.quantity > item.product.current_stock) {
        setErrorMessage(`Stock insuficiente para '${item.product.name}'. Disponible: ${item.product.current_stock}`)
        return
      }
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    // Generar clave de idempotencia única
    const idempotencyKey = `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    try {
      const payload = {
        items: cartItems.map((it) => ({
          product_id: it.product.id,
          quantity: it.quantity,
          unit_price_cents: it.unit_price_cents
        })),
        notes: notes.trim() || undefined,
        idempotency_key: idempotencyKey
      }

      const created = await saleService.createSale(payload)
      setCompletedSale(created)
      setCartItems([])
      setNotes('')
      // Recargar catálogo de stock actualizado
      loadActiveProducts()
      if (onSaleCompleted) {
        onSaleCompleted(created)
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Ocurrió un error inesperado al registrar la venta.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            Nueva Venta — Punto de Cobro
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Busque productos por nombre o código, ajuste cantidades y registre el cobro de mostrador.
          </p>
        </div>

        {onNavigateToHistory && (
          <button
            onClick={onNavigateToHistory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto"
          >
            <Receipt className="w-4 h-4 text-indigo-600" />
            Ver Historial de Ventas
          </button>
        )}
      </div>

      {/* Modal / Alerta de Venta Exitosa */}
      <AnimatePresence>
        {completedSale && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm text-emerald-900"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-950">
                    ¡Venta #{completedSale.sale_number} Registrada con Éxito!
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Importe total cobrado: <strong>{formatCurrency(completedSale.total_cents)}</strong> (
                    {completedSale.items.length} productos vendidos). El stock fue actualizado automáticamente.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCompletedSale(null)}
                className="text-emerald-700 hover:text-emerald-950 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-100 transition-colors"
              >
                Cerrar Aviso
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensaje de error si hubo fallo */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Layout Principal: 2 Columnas (Búsqueda + Carrito / Resumen) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Búsqueda y Tabla del Carrito */}
        <div className="lg:col-span-8 space-y-4">
          {/* Barra de Búsqueda Rápida */}
          <div ref={searchContainerRef} className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setIsSearchOpen(true)
                }}
                placeholder="Buscar por código SKU, nombre de producto o categoría (ej. 'cinta', 'hilo', '1001')..."
                className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-2xl shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 placeholder:text-slate-400 font-medium"
              />
              {loadingProducts && (
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* Menú Desplegable con Resultados */}
            <AnimatePresence>
              {isSearchOpen && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto"
                >
                  {searchResults.map((product) => {
                    const outOfStock = product.current_stock <= 0
                    return (
                      <div
                        key={product.id}
                        onClick={() => {
                          if (!outOfStock) addToCart(product)
                        }}
                        className={`p-3 flex items-center justify-between transition-colors ${
                          outOfStock
                            ? 'bg-slate-50/70 opacity-60 cursor-not-allowed'
                            : 'hover:bg-indigo-50/60 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {product.sku}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{product.name}</span>
                              {product.category_name && (
                                <span className="text-[10px] text-slate-500">({product.category_name})</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                              <span>
                                Stock disp.:{' '}
                                <strong className={outOfStock ? 'text-red-600' : 'text-slate-700'}>
                                  {formatQuantity(product.current_stock, product.unit_of_measure)}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>P. Unit.: <strong>{formatCurrency(product.price_cents)}</strong></span>
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={outOfStock}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                            outOfStock
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {outOfStock ? 'Sin Stock' : 'Agregar'}
                        </button>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tabla de Artículos en el Carrito */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>Líneas de la Venta</span>
                <span className="text-xs font-normal text-slate-500">
                  ({cartItems.length} {cartItems.length === 1 ? 'artículo' : 'artículos'})
                </span>
              </h3>

              {cartItems.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Vaciar carrito
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-16 px-4">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-700">El carrito está vacío</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Utilice el buscador superior para agregar productos a esta venta.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-600 font-semibold">
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4 w-32">Cantidad</th>
                      <th className="py-3 px-4 w-32">Precio Unit. (ARS $)</th>
                      <th className="py-3 px-4 text-right w-28">Subtotal</th>
                      <th className="py-3 px-4 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cartItems.map((item) => {
                      const exceedsStock = item.quantity > item.product.current_stock
                      return (
                        <tr
                          key={item.product.id}
                          className={`transition-colors ${exceedsStock ? 'bg-red-50/40' : 'hover:bg-slate-50/50'}`}
                        >
                          {/* Producto */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{item.product.name}</div>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono bg-slate-100 px-1 py-0.2 rounded">
                                {item.product.sku}
                              </span>
                              <span>•</span>
                              <span>
                                Disp:{' '}
                                <strong className={exceedsStock ? 'text-red-600' : 'text-slate-700'}>
                                  {formatQuantity(item.product.current_stock, item.product.unit_of_measure)}
                                </strong>
                              </span>
                            </div>
                          </td>

                          {/* Cantidad */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-1">
                              <input
                                type="text"
                                inputMode={item.product.is_fractional ? 'decimal' : 'numeric'}
                                placeholder={item.product.is_fractional ? 'Ej. 1,99' : 'Ej. 1'}
                                value={item.quantityInput}
                                onChange={(e) => handleQuantityChange(item.product.id, e.target.value)}
                                className={`w-20 px-2 py-1 text-xs border rounded-lg outline-none font-mono text-center font-bold ${
                                  exceedsStock
                                    ? 'border-red-400 bg-red-50 text-red-700'
                                    : 'border-slate-200 focus:border-indigo-500 text-slate-800'
                                }`}
                              />
                              <span className="text-[11px] text-slate-500 font-medium">
                                {item.product.unit_of_measure}
                              </span>
                            </div>
                          </td>

                          {/* Precio Unitario */}
                          <td className="py-3 px-4">
                            <div className="relative">
                              <span className="text-slate-400 text-xs absolute left-2 top-1/2 -translate-y-1/2">$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Ej. 1.500,00"
                                value={item.unitPriceInput}
                                onChange={(e) => handlePriceChange(item.product.id, e.target.value)}
                                className="w-24 pl-5 pr-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-right text-slate-800 font-semibold"
                              />
                            </div>
                          </td>

                          {/* Subtotal */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                            {formatCurrency(item.subtotal_cents)}
                          </td>

                          {/* Eliminar */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title="Quitar ítem"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Panel de Cobro y Resumen */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
              Resumen de la Venta
            </h3>

            {/* Tarjeta de Total */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-1">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Total a Cobrar
              </span>
              <div className="text-3xl font-extrabold tracking-tight font-mono text-emerald-400">
                {formatCurrency(totalCents)}
              </div>
              <div className="text-[11px] text-slate-300 pt-1 flex justify-between">
                <span>{cartItems.length} líneas</span>
                <span>{totalItemsCount} unidades / m</span>
              </div>
            </div>

            {/* Observaciones opcionales */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observaciones / Cliente (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Pagó con transferencia, cliente María..."
                rows={2}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Botón Principal de Cobro */}
            <button
              onClick={handleConfirmSale}
              disabled={isSubmitting || cartItems.length === 0}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl text-sm font-bold shadow-xs shadow-emerald-200 transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Registrando Cobro...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  <span>Confirmar y Cobrar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
