import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts'
import {
  TrendingUp, TrendingDown, BarChart3,
  Plus, Trash2, Activity, Brain, Target, Wallet, Bell, RefreshCw
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

interface MarketIndex {
  symbol: string; name: string; price: number; change: number; change_percent: number;
}
interface TrendingStock {
  symbol: string; name: string; price: number; change_percent: number;
}
interface BasketSummary {
  id: string; name: string; market: string; strategy: string;
  initial_capital: number; created_at: string; num_positions: number;
}
interface BasketDetail {
  basket_id: string; name: string; strategy: string; market: string;
  initial_capital: number; current_value: number; total_gain_loss: number;
  total_gain_loss_percent: number; positions: BasketPosition[]; created_at: string;
}
interface BasketPosition {
  symbol: string; name: string; shares: number; buy_price: number;
  current_price: number; current_value: number; gain_loss: number;
  gain_loss_percent: number; weight: number;
}
interface Prediction {
  date: string; predicted_price: number;
}
interface PredictionResult {
  symbol: string; current_price: number; predictions: Prediction[];
  expected_change_percent: number; model_r2_score: number; trend: string;
}
interface OptResult {
  symbols: string[];
  individual_metrics: { symbol: string; name: string; annual_return: number; annual_volatility: number; sharpe_ratio: number; }[];
  portfolios: Record<string, { weights: Record<string, number>; expected_return: number; volatility: number; sharpe_ratio: number; }>;
}
interface StockUniverse {
  ibex: { symbol: string; name: string }[];
  international: { symbol: string; name: string }[];
}
interface AlertItem {
  id: string; symbol: string; name: string; target_price: number;
  condition: string; current_price: number | null; triggered: boolean;
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [trending, setTrending] = useState<TrendingStock[]>([])
  const [baskets, setBaskets] = useState<BasketSummary[]>([])
  const [selectedBasket, setSelectedBasket] = useState<BasketDetail | null>(null)
  const [basketHistory, setBasketHistory] = useState<{ date: string; value: number }[]>([])
  const [universe, setUniverse] = useState<StockUniverse>({ ibex: [], international: [] })
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [predSymbol, setPredSymbol] = useState('AAPL')
  const [optResult, setOptResult] = useState<OptResult | null>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [newBasketName, setNewBasketName] = useState('')
  const [newBasketMarket, setNewBasketMarket] = useState('mixed')
  const [newBasketStrategy, setNewBasketStrategy] = useState('optimized')
  const [selectedStocks, setSelectedStocks] = useState<string[]>([])
  const [alertSymbol, setAlertSymbol] = useState('')
  const [alertPrice, setAlertPrice] = useState('')
  const [alertCondition, setAlertCondition] = useState('above')

  const fetchJson = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(`${API}${url}`, opts)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(l => ({ ...l, dashboard: true }))
    try {
      const [idx, trend] = await Promise.all([
        fetchJson('/api/market/overview'),
        fetchJson('/api/market/trending'),
      ])
      setIndices(idx.indices || [])
      setTrending(trend.stocks || [])
    } catch (e) { console.error(e) }
    setLoading(l => ({ ...l, dashboard: false }))
  }, [fetchJson])

  const loadBaskets = useCallback(async () => {
    try {
      const data = await fetchJson('/api/baskets')
      setBaskets(data.baskets || [])
    } catch (e) { console.error(e) }
  }, [fetchJson])

  const loadUniverse = useCallback(async () => {
    try {
      const data = await fetchJson('/api/stocks/universe')
      setUniverse(data)
    } catch (e) { console.error(e) }
  }, [fetchJson])

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchJson('/api/alerts')
      setAlerts(data.alerts || [])
    } catch (e) { console.error(e) }
  }, [fetchJson])

  useEffect(() => {
    loadDashboard()
    loadBaskets()
    loadUniverse()
    loadAlerts()
  }, [loadDashboard, loadBaskets, loadUniverse, loadAlerts])

  const selectBasket = async (id: string) => {
    setLoading(l => ({ ...l, basket: true }))
    try {
      const [detail, hist] = await Promise.all([
        fetchJson(`/api/baskets/${id}`),
        fetchJson(`/api/baskets/${id}/history?period=1mo`),
      ])
      setSelectedBasket(detail)
      setBasketHistory(hist.history || [])
    } catch (e) { console.error(e) }
    setLoading(l => ({ ...l, basket: false }))
  }

  const createBasket = async () => {
    if (!newBasketName || selectedStocks.length < 2) return
    setLoading(l => ({ ...l, createBasket: true }))
    try {
      await fetchJson('/api/baskets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBasketName, symbols: selectedStocks,
          market: newBasketMarket, strategy: newBasketStrategy, initial_capital: 200,
        }),
      })
      setNewBasketName('')
      setSelectedStocks([])
      await loadBaskets()
    } catch (e) { console.error(e) }
    setLoading(l => ({ ...l, createBasket: false }))
  }

  const deleteBasket = async (id: string) => {
    try {
      await fetchJson(`/api/baskets/${id}`, { method: 'DELETE' })
      setSelectedBasket(null)
      await loadBaskets()
    } catch (e) { console.error(e) }
  }

  const runPrediction = async () => {
    if (!predSymbol) return
    setLoading(l => ({ ...l, predict: true }))
    try {
      const data = await fetchJson(`/api/predict/${predSymbol}?days=30`)
      setPrediction(data)
    } catch (e) { console.error(e) }
    setLoading(l => ({ ...l, predict: false }))
  }

  const runOptimization = async () => {
    if (selectedStocks.length < 2) return
    setLoading(l => ({ ...l, optimize: true }))
    try {
      const data = await fetchJson('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedStocks),
      })
      setOptResult(data)
    } catch (e) { console.error(e) }
    setLoading(l => ({ ...l, optimize: false }))
  }

  const createAlert = async () => {
    if (!alertSymbol || !alertPrice) return
    try {
      await fetchJson('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: alertSymbol, target_price: parseFloat(alertPrice), condition: alertCondition,
        }),
      })
      setAlertSymbol('')
      setAlertPrice('')
      await loadAlerts()
    } catch (e) { console.error(e) }
  }

  const deleteAlert = async (id: string) => {
    try {
      await fetchJson(`/api/alerts/${id}`, { method: 'DELETE' })
      await loadAlerts()
    } catch (e) { console.error(e) }
  }

  const toggleStock = (symbol: string) => {
    setSelectedStocks(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    )
  }

  const allStocks = [...universe.ibex, ...universe.international]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-blue-500" />
            <h1 className="text-xl font-bold">Devin Bursatil</h1>
            <Badge variant="outline" className="text-xs text-gray-400 border-gray-700">v1.0</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={loadDashboard} className="text-gray-400">
            <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-900 border border-gray-800 mb-6">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-1" /> Mercado
            </TabsTrigger>
            <TabsTrigger value="baskets" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Wallet className="h-4 w-4 mr-1" /> Cestas
            </TabsTrigger>
            <TabsTrigger value="predict" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Brain className="h-4 w-4 mr-1" /> Prediccion
            </TabsTrigger>
            <TabsTrigger value="optimize" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Target className="h-4 w-4 mr-1" /> Optimizar
            </TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Bell className="h-4 w-4 mr-1" /> Alertas
            </TabsTrigger>
          </TabsList>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {indices.map(idx => (
                <Card key={idx.symbol} className="bg-gray-900 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-gray-500">{idx.symbol}</CardDescription>
                    <CardTitle className="text-lg">{idx.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{idx.price.toLocaleString()}</span>
                      <Badge className={idx.change_percent >= 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}>
                        {idx.change_percent >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {idx.change_percent >= 0 ? '+' : ''}{idx.change_percent}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle>Acciones Populares</CardTitle>
                <CardDescription>IBEX 35 + Mercado Internacional</CardDescription>
              </CardHeader>
              <CardContent>
                {loading.dashboard ? (
                  <div className="text-center py-8 text-gray-500">Cargando datos de mercado...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400">Simbolo</TableHead>
                        <TableHead className="text-gray-400">Nombre</TableHead>
                        <TableHead className="text-gray-400 text-right">Precio</TableHead>
                        <TableHead className="text-gray-400 text-right">Cambio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trending.map(s => (
                        <TableRow key={s.symbol} className="border-gray-800">
                          <TableCell className="font-mono font-bold">{s.symbol}</TableCell>
                          <TableCell>{s.name}</TableCell>
                          <TableCell className="text-right">${s.price}</TableCell>
                          <TableCell className={`text-right font-semibold ${s.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {s.change_percent >= 0 ? '+' : ''}{s.change_percent}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BASKETS TAB */}
          <TabsContent value="baskets">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Create basket */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Nueva Cesta</CardTitle>
                  <CardDescription>Capital virtual: 200 EUR</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-400">Nombre</Label>
                    <Input value={newBasketName} onChange={e => setNewBasketName(e.target.value)}
                      placeholder="Mi cesta IBEX" className="bg-gray-800 border-gray-700 mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Mercado</Label>
                    <Select value={newBasketMarket} onValueChange={setNewBasketMarket}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="ibex">IBEX 35</SelectItem>
                        <SelectItem value="international">Internacional</SelectItem>
                        <SelectItem value="mixed">Mixto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">Estrategia</Label>
                    <Select value={newBasketStrategy} onValueChange={setNewBasketStrategy}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="equal">Pesos iguales</SelectItem>
                        <SelectItem value="optimized">Markowitz (optimizado)</SelectItem>
                        <SelectItem value="ml_weighted">ML (prediccion)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">Selecciona acciones (min. 2)</Label>
                    <div className="flex flex-wrap gap-1 mt-2 max-h-48 overflow-y-auto">
                      {allStocks.map(s => (
                        <Badge key={s.symbol} variant={selectedStocks.includes(s.symbol) ? 'default' : 'outline'}
                          className={`cursor-pointer text-xs ${selectedStocks.includes(s.symbol) ? 'bg-blue-600' : 'border-gray-700 text-gray-400 hover:border-blue-500'}`}
                          onClick={() => toggleStock(s.symbol)}>
                          {s.symbol}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{selectedStocks.length} seleccionadas</p>
                  </div>
                  <Button onClick={createBasket} disabled={loading.createBasket || !newBasketName || selectedStocks.length < 2}
                    className="w-full bg-blue-600 hover:bg-blue-700">
                    {loading.createBasket ? 'Creando...' : 'Crear Cesta (200 EUR)'}
                  </Button>
                </CardContent>
              </Card>

              {/* Basket list */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Mis Cestas</h3>
                {baskets.length === 0 && <p className="text-gray-500 text-sm">No hay cestas. Crea tu primera cesta virtual.</p>}
                {baskets.map(b => (
                  <Card key={b.id} className="bg-gray-900 border-gray-800 cursor-pointer hover:border-blue-600 transition-colors"
                    onClick={() => selectBasket(b.id)}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{b.name}</p>
                          <p className="text-xs text-gray-500">
                            {b.strategy === 'optimized' ? 'Markowitz' : b.strategy === 'ml_weighted' ? 'ML' : 'Igual'} | {b.market} | {b.num_positions} acciones
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-gray-700">{b.initial_capital} EUR</Badge>
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); deleteBasket(b.id) }}>
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Basket detail */}
              <div>
                {loading.basket ? (
                  <Card className="bg-gray-900 border-gray-800"><CardContent className="py-8 text-center text-gray-500">Cargando...</CardContent></Card>
                ) : selectedBasket ? (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle>{selectedBasket.name}</CardTitle>
                      <CardDescription>
                        {selectedBasket.strategy} | Creada: {new Date(selectedBasket.created_at).toLocaleDateString('es-ES')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Valor Actual</p>
                          <p className="text-xl font-bold">{selectedBasket.current_value.toFixed(2)} EUR</p>
                        </div>
                        <div className={`rounded-lg p-3 ${selectedBasket.total_gain_loss >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                          <p className="text-xs text-gray-500">Ganancia/Perdida</p>
                          <p className={`text-xl font-bold ${selectedBasket.total_gain_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {selectedBasket.total_gain_loss >= 0 ? '+' : ''}{selectedBasket.total_gain_loss.toFixed(2)} EUR
                            <span className="text-sm ml-1">({selectedBasket.total_gain_loss_percent.toFixed(2)}%)</span>
                          </p>
                        </div>
                      </div>

                      {basketHistory.length > 0 && (
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={basketHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f680" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}

                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-800">
                            <TableHead className="text-gray-400 text-xs">Accion</TableHead>
                            <TableHead className="text-gray-400 text-xs text-right">Peso</TableHead>
                            <TableHead className="text-gray-400 text-xs text-right">G/P</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedBasket.positions.map(p => (
                            <TableRow key={p.symbol} className="border-gray-800">
                              <TableCell className="text-xs">
                                <p className="font-mono font-bold">{p.symbol}</p>
                                <p className="text-gray-500">{p.name}</p>
                              </TableCell>
                              <TableCell className="text-right text-xs">{p.weight}%</TableCell>
                              <TableCell className={`text-right text-xs font-semibold ${p.gain_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {p.gain_loss >= 0 ? '+' : ''}{p.gain_loss_percent.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="py-8 text-center text-gray-500">
                      Selecciona una cesta para ver detalles
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* PREDICTION TAB */}
          <TabsContent value="predict">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-purple-400" /> Prediccion ML</CardTitle>
                  <CardDescription>Prediccion a 30 dias con regresion lineal</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input value={predSymbol} onChange={e => setPredSymbol(e.target.value.toUpperCase())}
                      placeholder="AAPL, SAN.MC..." className="bg-gray-800 border-gray-700" />
                    <Button onClick={runPrediction} disabled={loading.predict} className="bg-purple-600 hover:bg-purple-700">
                      {loading.predict ? 'Analizando...' : 'Predecir'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['AAPL', 'MSFT', 'TSLA', 'SAN.MC', 'IBE.MC', 'ITX.MC', 'NVDA', 'AMZN'].map(s => (
                      <Badge key={s} variant="outline" className="cursor-pointer border-gray-700 text-gray-400 hover:border-purple-500 text-xs"
                        onClick={() => { setPredSymbol(s); }}>
                        {s}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {prediction && (
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {prediction.symbol}
                      <Badge className={prediction.trend === 'bullish' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}>
                        {prediction.trend === 'bullish' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {prediction.trend === 'bullish' ? 'Alcista' : 'Bajista'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-800 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Precio Actual</p>
                        <p className="text-lg font-bold">${prediction.current_price}</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${prediction.expected_change_percent >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                        <p className="text-xs text-gray-500">Cambio Esperado</p>
                        <p className={`text-lg font-bold ${prediction.expected_change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {prediction.expected_change_percent >= 0 ? '+' : ''}{prediction.expected_change_percent}%
                        </p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">R2 Score</p>
                        <p className="text-lg font-bold">{prediction.model_r2_score}</p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={prediction.predictions}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="predicted_price" stroke="#a855f7" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* OPTIMIZATION TAB */}
          <TabsContent value="optimize">
            <div className="space-y-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-amber-400" /> Optimizacion de Cartera</CardTitle>
                  <CardDescription>Markowitz + ML: selecciona acciones para analizar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1">
                    {allStocks.map(s => (
                      <Badge key={s.symbol} variant={selectedStocks.includes(s.symbol) ? 'default' : 'outline'}
                        className={`cursor-pointer text-xs ${selectedStocks.includes(s.symbol) ? 'bg-amber-600' : 'border-gray-700 text-gray-400 hover:border-amber-500'}`}
                        onClick={() => toggleStock(s.symbol)}>
                        {s.symbol}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-400">{selectedStocks.length} seleccionadas</p>
                    <Button onClick={runOptimization} disabled={loading.optimize || selectedStocks.length < 2} className="bg-amber-600 hover:bg-amber-700">
                      {loading.optimize ? 'Optimizando...' : 'Analizar y Optimizar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {optResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Individual metrics */}
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader><CardTitle className="text-base">Metricas Individuales</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-800">
                            <TableHead className="text-gray-400 text-xs">Accion</TableHead>
                            <TableHead className="text-gray-400 text-xs text-right">Retorno</TableHead>
                            <TableHead className="text-gray-400 text-xs text-right">Volatilidad</TableHead>
                            <TableHead className="text-gray-400 text-xs text-right">Sharpe</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {optResult.individual_metrics.map(m => (
                            <TableRow key={m.symbol} className="border-gray-800">
                              <TableCell className="font-mono text-xs font-bold">{m.symbol}</TableCell>
                              <TableCell className={`text-right text-xs ${m.annual_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {m.annual_return.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right text-xs">{m.annual_volatility.toFixed(1)}%</TableCell>
                              <TableCell className="text-right text-xs font-semibold">{m.sharpe_ratio.toFixed(3)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Strategy comparison */}
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader><CardTitle className="text-base">Comparacion de Estrategias</CardTitle></CardHeader>
                    <CardContent>
                      {(() => {
                        const chartData = Object.entries(optResult.portfolios).map(([key, p]) => ({
                          name: key === 'equal_weight' ? 'Igual' : key === 'optimized_markowitz' ? 'Markowitz' : 'ML',
                          retorno: p.expected_return,
                          volatilidad: p.volatility,
                          sharpe: p.sharpe_ratio,
                        }))
                        return (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                              <Legend />
                              <Bar dataKey="retorno" fill="#10b981" name="Retorno %" />
                              <Bar dataKey="volatilidad" fill="#ef4444" name="Volatilidad %" />
                            </BarChart>
                          </ResponsiveContainer>
                        )
                      })()}

                      <Separator className="my-4 bg-gray-800" />

                      {Object.entries(optResult.portfolios).map(([key, p]) => (
                        <div key={key} className="mb-4">
                          <h4 className="text-sm font-semibold mb-2">
                            {key === 'equal_weight' ? 'Pesos Iguales' : key === 'optimized_markowitz' ? 'Markowitz Optimizado' : 'ML Ponderado'}
                            <Badge className="ml-2 text-xs" variant="outline">Sharpe: {p.sharpe_ratio}</Badge>
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(p.weights).map(([sym, w]) => (
                              <Badge key={sym} variant="outline" className="text-xs border-gray-700">
                                {sym}: {w}%
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Portfolio weights pie chart */}
                  <Card className="bg-gray-900 border-gray-800 lg:col-span-2">
                    <CardHeader><CardTitle className="text-base">Distribucion Markowitz Optimizada</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={Object.entries(optResult.portfolios.optimized_markowitz.weights).map(([sym, w]) => ({ name: sym, value: w }))}
                            dataKey="value"
                            cx="50%" cy="50%" outerRadius={100} label={({ name, value }: {name: string; value: number}) => `${name}: ${value}%`}
                            labelLine={{ stroke: '#9ca3af' }}
                          >
                            {Object.keys(optResult.portfolios.optimized_markowitz.weights).map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ALERTS TAB */}
          <TabsContent value="alerts">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-cyan-400" /> Nueva Alerta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-400">Simbolo</Label>
                    <Input value={alertSymbol} onChange={e => setAlertSymbol(e.target.value.toUpperCase())}
                      placeholder="AAPL" className="bg-gray-800 border-gray-700 mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Condicion</Label>
                    <Select value={alertCondition} onValueChange={setAlertCondition}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="above">Por encima de</SelectItem>
                        <SelectItem value="below">Por debajo de</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">Precio objetivo</Label>
                    <Input type="number" value={alertPrice} onChange={e => setAlertPrice(e.target.value)}
                      placeholder="150.00" className="bg-gray-800 border-gray-700 mt-1" />
                  </div>
                  <Button onClick={createAlert} className="w-full bg-cyan-600 hover:bg-cyan-700">Crear Alerta</Button>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>Alertas Activas</CardTitle>
                  <CardDescription>{alerts.length} alertas configuradas</CardDescription>
                </CardHeader>
                <CardContent>
                  {alerts.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No hay alertas</p>
                  ) : (
                    <div className="space-y-2">
                      {alerts.map(a => (
                        <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg ${a.triggered ? 'bg-amber-900/30 border border-amber-700' : 'bg-gray-800'}`}>
                          <div>
                            <p className="font-mono font-bold text-sm">{a.symbol}</p>
                            <p className="text-xs text-gray-400">
                              {a.condition === 'above' ? 'Por encima' : 'Por debajo'} de ${a.target_price}
                              {a.current_price && <span className="ml-2">(Actual: ${a.current_price})</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {a.triggered && <Badge className="bg-amber-600 text-xs">ACTIVADA</Badge>}
                            <Button variant="ghost" size="sm" onClick={() => deleteAlert(a.id)}>
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-gray-800 mt-12 py-4 text-center text-gray-600 text-xs">
        Devin Bursatil v1.0 | Datos de mercado via Yahoo Finance | ML: scikit-learn
      </footer>
    </div>
  )
}

export default App
