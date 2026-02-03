import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaigns, getAnalytics } from '@/services/dataService';
import { Analytics, Campaign } from '@/types/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Eye,
  Mail,
  MessageSquare,
  Download,
  Calendar,
} from 'lucide-react';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dateRange, setDateRange] = useState('7d');
  const [selectedCampaign, setSelectedCampaign] = useState('all');

  const loadData = useCallback(() => {
    if (user) {
      setAnalytics(getAnalytics(user.id));
      setCampaigns(getCampaigns(user.id));
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate mock time-series data based on analytics
  const generateTimeData = () => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        opens: analytics ? Math.round(analytics.emailOpenRate * (0.8 + Math.random() * 0.4)) : 0,
        watches: analytics ? Math.round(analytics.videoWatchRate * (0.8 + Math.random() * 0.4)) : 0,
        replies: analytics ? Math.round(analytics.replyRate * (0.8 + Math.random() * 0.4)) : 0,
      });
    }
    return data;
  };

  const timeData = generateTimeData();

  const pieData = analytics ? [
    { name: 'Opened', value: analytics.emailOpenRate, color: 'hsl(var(--primary))' },
    { name: 'Watched', value: analytics.videoWatchRate, color: 'hsl(var(--accent))' },
    { name: 'Replied', value: analytics.replyRate, color: 'hsl(var(--success))' },
    { name: 'No Action', value: 100 - analytics.emailOpenRate, color: 'hsl(var(--muted))' },
  ] : [];

  const statsCards = analytics ? [
    { label: 'Email Open Rate', value: `${analytics.emailOpenRate}%`, icon: Mail, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Video Watch Rate', value: `${analytics.videoWatchRate}%`, icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Reply Rate', value: `${analytics.replyRate}%`, icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Engagement Score', value: `${Math.round((analytics.emailOpenRate + analytics.videoWatchRate + analytics.replyRate) / 3)}%`, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your campaign performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <Card key={i} className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Area Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Engagement Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeData}>
                  <defs>
                    <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWatches" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="opens"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorOpens)"
                    name="Email Opens"
                  />
                  <Area
                    type="monotone"
                    dataKey="watches"
                    stroke="hsl(var(--accent))"
                    fillOpacity={1}
                    fill="url(#colorWatches)"
                    name="Video Watches"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="opens" name="Opens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="watches" name="Watches" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replies" name="Replies" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
