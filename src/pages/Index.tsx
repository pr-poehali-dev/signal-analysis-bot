import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';

type SignalType = 'BUY' | 'SELL';
type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h';

interface Signal {
  id: string;
  pair: string;
  type: SignalType;
  confidence: number;
  volatility: 'low' | 'medium' | 'high';
  timeframe: TimeFrame;
  price: number;
  timestamp: string;
  target?: number;
  status?: 'active' | 'win' | 'loss';
}

const mockSignals: Signal[] = [
  { id: '1', pair: 'EUR/USD', type: 'BUY', confidence: 87, volatility: 'high', timeframe: '5m', price: 1.0842, timestamp: '10:34', target: 1.0865, status: 'active' },
  { id: '2', pair: 'GBP/USD', type: 'SELL', confidence: 92, volatility: 'medium', timeframe: '15m', price: 1.2654, timestamp: '10:31', target: 1.2620, status: 'active' },
  { id: '3', pair: 'USD/JPY', type: 'BUY', confidence: 78, volatility: 'low', timeframe: '1h', price: 149.23, timestamp: '10:28', target: 149.85, status: 'active' },
  { id: '4', pair: 'AUD/USD', type: 'SELL', confidence: 84, volatility: 'high', timeframe: '5m', price: 0.6534, timestamp: '10:25', target: 0.6510, status: 'active' },
  { id: '5', pair: 'USD/CAD', type: 'BUY', confidence: 71, volatility: 'medium', timeframe: '15m', price: 1.3542, timestamp: '10:22', target: 1.3570, status: 'active' },
  { id: '6', pair: 'NZD/USD', type: 'SELL', confidence: 89, volatility: 'high', timeframe: '1m', price: 0.5987, timestamp: '10:20', target: 0.5960, status: 'active' },
];

const historySignals: Signal[] = [
  { id: 'h1', pair: 'EUR/USD', type: 'BUY', confidence: 85, volatility: 'medium', timeframe: '5m', price: 1.0820, timestamp: '09:15', target: 1.0845, status: 'win' },
  { id: 'h2', pair: 'GBP/USD', type: 'SELL', confidence: 76, volatility: 'low', timeframe: '15m', price: 1.2680, timestamp: '08:50', target: 1.2650, status: 'win' },
  { id: 'h3', pair: 'USD/JPY', type: 'BUY', confidence: 68, volatility: 'high', timeframe: '1h', price: 148.90, timestamp: '08:30', target: 149.40, status: 'loss' },
  { id: 'h4', pair: 'AUD/USD', type: 'SELL', confidence: 91, volatility: 'medium', timeframe: '5m', price: 0.6560, timestamp: '08:10', target: 0.6535, status: 'win' },
];

const Index = () => {
  const [botActive, setBotActive] = useState(false);
  const [command, setCommand] = useState('');
  const [signals, setSignals] = useState<Signal[]>(mockSignals);
  const [history, setHistory] = useState<Signal[]>(historySignals);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeFrame | 'all'>('all');
  const [selectedVolatility, setSelectedVolatility] = useState<string>('all');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [countdown, setCountdown] = useState(5);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (botActive) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            fetchNewSignals();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
      intervalRef.current = timer;
      return () => clearInterval(timer);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCountdown(5);
    }
  }, [botActive]);

  const fetchNewSignals = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/25f9b946-47e6-4de9-832e-9a49927bd0b3');
      const data = await response.json();
      
      if (data.signals && data.signals.length > 0) {
        setSignals(data.signals);
      }
    } catch (error) {
      console.error('Failed to fetch signals:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      setUploadedImage(base64Image);
      setIsAnalyzing(true);

      try {
        const response = await fetch('https://functions.poehali.dev/622a11e2-25b0-46b0-ad83-516b393fe08a', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image.split(',')[1] })
        });

        const data = await response.json();
        if (data.signal) {
          setSignals(prev => [data.signal, ...prev.slice(0, 5)]);
        }
      } catch (error) {
        console.error('Failed to analyze chart:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.toLowerCase() === '/start') {
      setBotActive(true);
      setCommand('');
      fetchNewSignals();
    } else if (command.toLowerCase() === '/stop') {
      setBotActive(false);
      setCommand('');
    }
  };

  const filteredSignals = signals.filter(signal => {
    if (selectedTimeframe !== 'all' && signal.timeframe !== selectedTimeframe) return false;
    if (selectedVolatility !== 'all' && signal.volatility !== selectedVolatility) return false;
    if (signal.confidence < minConfidence) return false;
    return true;
  });

  const getVolatilityColor = (vol: string) => {
    switch (vol) {
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return '';
    }
  };

  const winRate = history.length > 0 ? Math.round((history.filter(s => s.status === 'win').length / history.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Icon name="TrendingUp" size={32} className="text-accent" />
              Pocket Options Analyzer
            </h1>
            <p className="text-muted-foreground mt-1">Точный анализ торговых сигналов</p>
          </div>
          <div className="flex items-center gap-4">
            {botActive && (
              <div className="flex items-center gap-2 px-4 py-2 bg-success/20 border border-success/30 rounded-lg">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-sm text-success font-medium">Обновление через {countdown}с</span>
              </div>
            )}
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold text-success">{winRate}%</p>
            </div>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4 border-border bg-card">
            <form onSubmit={handleCommand} className="flex gap-3">
              <div className="flex-1 relative">
                <Icon name="Terminal" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Введите команду (/start или /stop)"
                className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
              />
            </div>
            <Button type="submit" className="bg-accent hover:bg-accent/90">
              <Icon name="Play" size={18} />
              Выполнить
            </Button>
          </form>
          {!botActive && (
            <p className="text-sm text-muted-foreground mt-2">💡 Введите <code className="bg-secondary px-2 py-1 rounded">/start</code> для запуска автоматического обновления сигналов</p>
          )}
          {botActive && (
            <p className="text-sm text-success mt-2 flex items-center gap-2">
              <Icon name="CheckCircle" size={16} />
              Бот активен. Сигналы обновляются каждые 5 секунд
            </p>
          )}
        </Card>

        <Card className="p-4 border-border bg-card">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Icon name="Image" size={20} className="text-accent" />
            Анализ скриншота графика
          </h3>
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="w-full bg-accent hover:bg-accent/90"
            >
              {isAnalyzing ? (
                <>
                  <Icon name="Loader2" size={18} className="animate-spin" />
                  Анализирую график...
                </>
              ) : (
                <>
                  <Icon name="Upload" size={18} />
                  Загрузить скриншот
                </>
              )}
            </Button>
            {uploadedImage && (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={uploadedImage} alt="Загруженный график" className="w-full h-auto" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              📸 Загрузите скриншот графика валютной пары. ИИ определит валюту, таймфрейм и даст точный сигнал BUY/SELL на следующие 5 секунд
            </p>
          </div>
        </Card>
        </div>

        <Tabs defaultValue="signals" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="signals" className="flex items-center gap-2">
              <Icon name="Zap" size={16} />
              Сигналы
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Icon name="History" size={16} />
              История
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Icon name="BarChart3" size={16} />
              Статистика
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signals" className="space-y-6">
            <Card className="p-4 border-border bg-card">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm text-muted-foreground mb-2 block">Таймфрейм</label>
                  <Select value={selectedTimeframe} onValueChange={(val) => setSelectedTimeframe(val as TimeFrame | 'all')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="1m">1 минута</SelectItem>
                      <SelectItem value="5m">5 минут</SelectItem>
                      <SelectItem value="15m">15 минут</SelectItem>
                      <SelectItem value="1h">1 час</SelectItem>
                      <SelectItem value="4h">4 часа</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm text-muted-foreground mb-2 block">Волатильность</label>
                  <Select value={selectedVolatility} onValueChange={setSelectedVolatility}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="low">Низкая</SelectItem>
                      <SelectItem value="medium">Средняя</SelectItem>
                      <SelectItem value="high">Высокая</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm text-muted-foreground mb-2 block">Уверенность: {minConfidence}%</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={minConfidence}
                      onChange={(e) => setMinConfidence(Number(e.target.value))}
                      className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSignals.map((signal) => (
                <Card key={signal.id} className="p-5 border-border bg-card hover:border-accent transition-all duration-300 hover:shadow-lg hover:shadow-accent/10">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{signal.pair}</h3>
                        <p className="text-sm text-muted-foreground">{signal.timestamp}</p>
                      </div>
                      <Badge className={`${signal.type === 'BUY' ? 'bg-success' : 'bg-destructive'} text-white font-bold px-3 py-1`}>
                        {signal.type}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Цена входа</span>
                        <span className="text-lg font-semibold text-foreground">{signal.price}</span>
                      </div>
                      {signal.target && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Цель</span>
                          <span className="text-lg font-semibold text-accent">{signal.target}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Уверенность</span>
                        <span className="text-sm font-bold text-foreground">{signal.confidence}%</span>
                      </div>
                      <Progress value={signal.confidence} className="h-2" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {signal.timeframe}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${getVolatilityColor(signal.volatility)}`}>
                        {signal.volatility}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {filteredSignals.length === 0 && (
              <Card className="p-12 text-center border-border bg-card">
                <Icon name="SearchX" size={48} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Нет сигналов, соответствующих фильтрам</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="space-y-3">
              {history.map((signal) => (
                <Card key={signal.id} className="p-4 border-border bg-card hover:border-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="min-w-[100px]">
                        <p className="font-bold text-foreground">{signal.pair}</p>
                        <p className="text-xs text-muted-foreground">{signal.timestamp}</p>
                      </div>
                      
                      <Badge className={`${signal.type === 'BUY' ? 'bg-success/80' : 'bg-destructive/80'} text-white text-xs`}>
                        {signal.type}
                      </Badge>

                      <div className="hidden md:flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{signal.timeframe}</Badge>
                        <Badge variant="outline" className={`text-xs ${getVolatilityColor(signal.volatility)}`}>
                          {signal.volatility}
                        </Badge>
                      </div>

                      <div className="hidden md:block">
                        <p className="text-sm text-muted-foreground">Уверенность: <span className="text-foreground font-semibold">{signal.confidence}%</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{signal.price} → {signal.target}</p>
                      </div>
                      {signal.status === 'win' ? (
                        <div className="flex items-center gap-1 text-success">
                          <Icon name="TrendingUp" size={20} />
                          <span className="font-bold text-sm">WIN</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-destructive">
                          <Icon name="TrendingDown" size={20} />
                          <span className="font-bold text-sm">LOSS</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 border-border bg-card">
                <div className="flex items-center gap-3 mb-2">
                  <Icon name="Target" size={24} className="text-success" />
                  <h3 className="text-sm text-muted-foreground">Win Rate</h3>
                </div>
                <p className="text-4xl font-bold text-success">{winRate}%</p>
                <Progress value={winRate} className="mt-3 h-2" />
              </Card>

              <Card className="p-6 border-border bg-card">
                <div className="flex items-center gap-3 mb-2">
                  <Icon name="Activity" size={24} className="text-accent" />
                  <h3 className="text-sm text-muted-foreground">Всего сигналов</h3>
                </div>
                <p className="text-4xl font-bold text-foreground">{mockSignals.length + historySignals.length}</p>
                <p className="text-sm text-muted-foreground mt-2">Активных: {mockSignals.length}</p>
              </Card>

              <Card className="p-6 border-border bg-card">
                <div className="flex items-center gap-3 mb-2">
                  <Icon name="TrendingUp" size={24} className="text-blue-400" />
                  <h3 className="text-sm text-muted-foreground">Средняя уверенность</h3>
                </div>
                <p className="text-4xl font-bold text-foreground">
                  {Math.round(mockSignals.reduce((acc, s) => acc + s.confidence, 0) / mockSignals.length)}%
                </p>
              </Card>
            </div>

            <Card className="p-6 border-border bg-card">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="PieChart" size={20} />
                Распределение по валютам
              </h3>
              <div className="space-y-3">
                {['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD'].map((pair) => {
                  const count = [...mockSignals, ...historySignals].filter(s => s.pair === pair).length;
                  const percentage = Math.round((count / (mockSignals.length + historySignals.length)) * 100);
                  return (
                    <div key={pair}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-foreground">{pair}</span>
                        <span className="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;