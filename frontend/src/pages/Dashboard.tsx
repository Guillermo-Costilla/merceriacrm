import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Package,
  ArrowUpRight,
  Medal
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts'
import type { DashboardSummary } from '../types/dashboard'
import { dashboardService } from '../services/dashboardService'
import { formatCurrency, formatQuantity, getBusinessYearMonth } from '../utils/formatters'
import { ApiError } from '../services/api'

interface DashboardProps {
  onNavigateToPOS?: () => void
  onNavigateToStockAlerts?: () => void
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToPOS, onNavigateToStockAlerts }) => {
  const currentPeriod = getBusinessYearMonth()
  const [selectedYear, setSelectedYear] = useState<number>(currentPeriod.year)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentPeriod.month)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await dashboardService.getDashboard(selectedYear, selectedMonth)
      setSummary(data)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('No se pudieron cargar las estadísticas del negocio.')
      }
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedMonth])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

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

  // Formatear datos para el gráfico de Recharts (convertir centavos a pesos para etiquetas legibles)
  const chartData = summary?.daily_sales.map((pt) => ({
    dia: `Día ${pt.day}`,
    ventas: Math.round(pt.sales_cents / 100),
    ganancia: Math.round(pt.profit_cents / 100),
    operaciones: pt.operations_count
  })) || []

  const kpis = summary?.kpis

  // Margen de rentabilidad sobre ventas
  const profitMargin =
    kpis && kpis.current_month_sales_cents > 0
      ? Math.round((kpis.current_month_gross_profit_cents / kpis.current_month_sales_cents) * 100)
      : 0

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Encabezado y Selector de Período */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rose-600" />
            Panel de Estadísticas y Rentabilidad
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Evolución de ventas, estimación de ganancia bruta acumulada y alertas de inventario
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* Selector de Mes */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-rose-500 sm:flex-none"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Selector de Año */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-rose-500 sm:flex-none"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            title="Actualizar métricas"
            aria-label="Actualizar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tarjetas Principales de Indicadores (KPIs) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {/* 1. Ventas de Hoy */}
        <div className="flex min-h-36 min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3 text-slate-500">
            <span className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-wider sm:text-xs">Ventas de Hoy</span>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0 break-words font-mono text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-2xl">
            {formatCurrency(kpis?.today_sales_cents || 0)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-slate-500">
            <span className="min-w-0">{kpis?.today_sales_count || 0} operaciones registradas</span>
            {onNavigateToPOS && (
              <button
                onClick={onNavigateToPOS}
                className="flex flex-shrink-0 items-center gap-0.5 font-semibold text-emerald-700 hover:underline"
              >
                Cobrar <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Ventas del Mes */}
        <div className="flex min-h-36 min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3 text-slate-500">
            <span className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-wider sm:text-xs">
              {summary?.period_label || 'Mes Actual'}
            </span>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0 break-words font-mono text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-2xl">
            {formatCurrency(kpis?.current_month_sales_cents || 0)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px]">
            <span className="min-w-0 text-slate-500">{kpis?.current_month_sales_count || 0} comprobantes</span>
            {/* Variación */}
            {kpis?.monthly_variation_pct !== null && kpis?.monthly_variation_pct !== undefined ? (
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  kpis.monthly_variation_pct >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {kpis.monthly_variation_pct >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {kpis.monthly_variation_pct >= 0 ? `+${kpis.monthly_variation_pct}%` : `${kpis.monthly_variation_pct}%`}
              </span>
            ) : (
              <span className="text-slate-400 text-[10px]">Sin base previa</span>
            )}
          </div>
        </div>

        {/* 3. Ganancia Bruta Estimada */}
        <div className="flex min-h-36 min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3 text-slate-500">
            <span className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-wider sm:text-xs">Ganancia Bruta Est.</span>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0 break-words font-mono text-xl font-extrabold leading-tight tracking-tight text-emerald-700 sm:text-2xl">
            {formatCurrency(kpis?.current_month_gross_profit_cents || 0)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-slate-500">
            <span>Margen estimado: <strong className="text-slate-800">{profitMargin}%</strong></span>
            <span className="text-[10px] text-slate-400">Costo congelado</span>
          </div>
        </div>

        {/* 4. Alertas de Inventario */}
        <div className="flex min-h-36 min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3 text-slate-500">
            <span className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-wider sm:text-xs">Estado de Stock</span>
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
                (kpis?.out_of_stock_products_count || 0) > 0
                  ? 'bg-red-50 text-red-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-extrabold text-amber-600 font-mono">
                {kpis?.low_stock_products_count || 0}
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight">Stock Bajo</span>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <span className="text-2xl font-extrabold text-red-600 font-mono">
                {kpis?.out_of_stock_products_count || 0}
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight">Agotados</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-0.5 text-[11px] text-slate-500">
            <span>{kpis?.total_active_products || 0} productos activos</span>
            {onNavigateToStockAlerts && (
              <button
                onClick={onNavigateToStockAlerts}
                className="text-indigo-600 hover:underline font-semibold flex items-center gap-0.5"
              >
                Revisar <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de Evolución Diaria de Ventas y Ganancia */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Evolución Diaria de Ventas en {summary?.period_label}
            </h3>
            <p className="text-[11px] text-slate-400">
              Curva de facturación y rentabilidad bruta por día en pesos argentinos ($)
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block"></span>
              <span className="text-slate-600 font-medium">Facturación ($)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-slate-600 font-medium">Ganancia Est. ($)</span>
            </div>
          </div>
        </div>

        <div className="w-full h-72">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
              <p className="text-xs">Generando curva gráfica...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
              No hay datos para mostrar en este período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dia" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `$${val.toLocaleString('es-AR')}`}
                />
                <Tooltip
                  formatter={(val: unknown) => [
                    `$ ${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                    ''
                  ]}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  name="Facturación"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVentas)"
                />
                <Area
                  type="monotone"
                  dataKey="ganancia"
                  name="Ganancia Bruta"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGanancia)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top 3 Productos Más Vendidos */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Medal className="w-4 h-4 text-amber-500" />
              Top 3 Productos Más Vendidos del Mes
            </h3>
            <p className="text-[11px] text-slate-400">
              Artículos con mayor rotación y su impacto en ingresos
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            Total unidades vendidas: {kpis?.current_month_units_sold || 0}
          </span>
        </div>

        {summary?.top_products.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No se registraron ventas de productos en este período.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summary?.top_products.map((prod, index) => {
              const medalColors = [
                'bg-amber-100 text-amber-800 border-amber-300', // 1° Oro
                'bg-slate-200 text-slate-800 border-slate-300', // 2° Plata
                'bg-amber-50 text-amber-900 border-amber-200'   // 3° Bronce
              ]

              return (
                <div
                  key={prod.product_id}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                        {prod.sku}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs mt-1 line-clamp-1">{prod.name}</h4>
                    </div>

                    <span
                      className={`w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                        medalColors[index] || 'bg-slate-100'
                      }`}
                    >
                      {index + 1}°
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Cantidad</span>
                      <span className="font-bold font-mono text-slate-800">
                        {formatQuantity(prod.units_sold, prod.unit_of_measure)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Recaudado</span>
                      <span className="font-bold font-mono text-emerald-700">
                        {formatCurrency(prod.revenue_cents)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
