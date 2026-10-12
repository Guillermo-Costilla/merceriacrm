import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Edit3, 
  Power, 
  Trash2, 
  RefreshCw,
  Layers,
  PackageX,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import type { 
  Product, 
  Category, 
  ProductCreateData, 
  ProductUpdateData 
} from '../types/product'
import { productService, categoryService } from '../services/productService'
import { formatCurrency, formatQuantity } from '../utils/formatters'
import { ProductModal } from '../components/products/ProductModal'
import { ApiError } from '../services/api'

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filtros y Paginación
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [stockStatus, setStockStatus] = useState<string>('all')
  const [showInactive, setShowInactive] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalItems, setTotalItems] = useState<number>(0)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [productToEdit, setProductToEdit] = useState<Product | null>(null)
  
  // Confirmación de desactivación / eliminación
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Debounce para búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Cargar categorías
  const loadCategories = async () => {
    try {
      const cats = await categoryService.getCategories()
      setCategories(cats)
    } catch {
      // Si falla, las categorías quedan vacías temporalmente
    }
  }

  // Cargar listado de productos
  const loadProducts = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await productService.getProducts({
        search: debouncedSearch || undefined,
        category_id: selectedCategory || undefined,
        stock_status: stockStatus !== 'all' ? stockStatus : undefined,
        is_active: showInactive ? undefined : true,
        page: currentPage,
        page_size: 15,
        order_by: 'name',
        order_dir: 'asc',
      })
      setProducts(res.items)
      setTotalPages(res.total_pages)
      setTotalItems(res.total)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('No se pudieron cargar los productos.')
      }
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedCategory, stockStatus, showInactive, currentPage])

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleOpenCreateModal = () => {
    setProductToEdit(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (product: Product) => {
    setProductToEdit(product)
    setIsModalOpen(true)
  }

  const handleSaveProduct = async (data: ProductCreateData | ProductUpdateData) => {
    if (productToEdit) {
      await productService.updateProduct(productToEdit.id, data as ProductUpdateData)
      setActionNotice(`Producto '${data.name}' actualizado correctamente.`)
    } else {
      await productService.createProduct(data as ProductCreateData)
      setActionNotice(`Producto '${data.name}' creado exitosamente.`)
    }
    loadProducts()
    setTimeout(() => setActionNotice(null), 4000)
  }

  const handleToggleStatus = async (product: Product) => {
    try {
      const updated = await productService.toggleProductStatus(product.id, !product.is_active)
      setActionNotice(
        updated.is_active 
          ? `Producto '${updated.name}' reactivado.` 
          : `Producto '${updated.name}' desactivado.`
      )
      loadProducts()
      setTimeout(() => setActionNotice(null), 4000)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      }
    }
  }

  const handleDeleteOrDeactivate = async () => {
    if (!productToDelete) return
    setDeleteLoading(true)
    try {
      const res = await productService.deleteProduct(productToDelete.id)
      setActionNotice(res.message)
      setProductToDelete(null)
      loadProducts()
      setTimeout(() => setActionNotice(null), 4000)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  // Métricas rápidas calculadas
  const lowStockCount = products.filter((p) => p.current_stock <= p.min_stock && p.current_stock > 0).length
  const outOfStockCount = products.filter((p) => p.current_stock === 0).length

  return (
    <div className="space-y-6">
      {/* Encabezado y botón Nuevo Producto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-rose-600" />
            Catálogo de Productos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administración de artículos, precios, costos históricos y control de stock
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-rose-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {/* Alerta de notificación temporal */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between shadow-2xs"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{actionNotice}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tarjetas de resumen rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Artículos</span>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{totalItems}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Stock Bajo (Reposición)</span>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{lowStockCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Agotados (Sin stock)</span>
            <p className="text-xl font-bold text-red-700 mt-0.5">{outOfStockCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <PackageX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Campo de búsqueda */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o código SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Filtro por Categoría */}
          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none bg-white text-slate-800"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado de Stock */}
          <div className="md:col-span-2">
            <select
              value={stockStatus}
              onChange={(e) => {
                setStockStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none bg-white text-slate-800"
            >
              <option value="all">Todo el stock</option>
              <option value="in_stock">Con stock</option>
              <option value="low">Stock bajo</option>
              <option value="out">Agotados</option>
            </select>
          </div>

          {/* Mostrar Inactivos */}
          <div className="md:col-span-2 flex items-center">
            <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => {
                  setShowInactive(e.target.checked)
                  setCurrentPage(1)
                }}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
              />
              <span>Incluir inactivos</span>
            </label>
          </div>
        </div>
      </div>

      {/* Mensaje de error general si falló la carga */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabla de Productos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-rose-500 mb-2" />
            <p className="text-xs">Cargando productos...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No se encontraron productos</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedCategory || stockStatus !== 'all'
                ? 'Ningún artículo coincide con los filtros aplicados. Intente restablecer la búsqueda.'
                : 'El catálogo está vacío. Comience agregando su primer producto con el botón superior.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Código / SKU</th>
                  <th className="py-3 px-4">Producto y Categoría</th>
                  <th className="py-3 px-4 text-right">Costo</th>
                  <th className="py-3 px-4 text-right">Precio Venta</th>
                  <th className="py-3 px-4 text-center">Stock Actual</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((prod) => {
                  const isLow = prod.current_stock <= prod.min_stock && prod.current_stock > 0
                  const isOut = prod.current_stock === 0

                  return (
                    <tr 
                      key={prod.id} 
                      className={`hover:bg-slate-50/60 transition-colors ${!prod.is_active ? 'opacity-60 bg-slate-50/30' : ''}`}
                    >
                      {/* SKU */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200/60">
                          {prod.sku}
                        </span>
                      </td>

                      {/* Nombre y Categoría */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{prod.name}</p>
                        <div className="flex items-center space-x-2 mt-0.5 text-[11px]">
                          {prod.category_name ? (
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded font-medium">
                              {prod.category_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Sin categoría</span>
                          )}
                          {prod.description && (
                            <span className="text-slate-400 truncate max-w-xs">• {prod.description}</span>
                          )}
                        </div>
                      </td>

                      {/* Costo */}
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {formatCurrency(prod.cost_cents)}
                      </td>

                      {/* Precio */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {formatCurrency(prod.price_cents)}
                      </td>

                      {/* Stock Actual */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center space-x-1.5">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
                              <AlertCircle className="w-3 h-3 text-red-600" />
                              Agotado
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {formatQuantity(prod.current_stock, prod.unit_of_measure)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/50">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {formatQuantity(prod.current_stock, prod.unit_of_measure)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          mín: {formatQuantity(prod.min_stock, prod.unit_of_measure)}
                        </p>
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${prod.is_active ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-500'}`}>
                          {prod.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => handleOpenEditModal(prod)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar producto"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(prod)}
                          className={`p-1.5 rounded-lg transition-colors ${prod.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={prod.is_active ? 'Desactivar producto' : 'Activar producto'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setProductToDelete(prod)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Dar de baja producto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
              Mostrando página <strong className="text-slate-700">{currentPage}</strong> de <strong className="text-slate-700">{totalPages}</strong> ({totalItems} productos)
            </span>
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal para Crear/Editar Producto */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={productToEdit}
        categories={categories}
        onCategoryCreated={(newCat) => setCategories((prev) => [...prev, newCat])}
      />

      {/* Modal de Confirmación de Baja / Eliminación */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Dar de Baja Producto</h3>
                  <p className="text-xs text-slate-500">{productToDelete.name} ({productToDelete.sku})</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Si el producto posee historial de ventas o movimientos de inventario, será <strong>desactivado lógicamente</strong> para proteger la integridad de los reportes. Si nunca tuvo operaciones, será eliminado de forma segura.
              </p>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOrDeactivate}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center"
                >
                  {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Confirmar Baja
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
