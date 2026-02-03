import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAnalytics, getActivities, Activity } from '@/services/dataService';
import { Analytics } from '@/types/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Users,
  MailCheck,
  Send,
  Video,
  ArrowRight,
  TrendingUp,
  Clock,
} from 'lucide-react';

export default function DashboardHome() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const data = getAnalytics(user.id);
      const acts = getActivities(user.id);
      setAnalytics(data);
      setActivities(acts);
      setIsLoading(false);
    }
  }, [user]);

  const stats = analytics
    ? [
        {
          label: 'Total Leads',
          value: analytics.totalLeads,
          icon: Users,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
        },
        {
          label: 'Verified Emails',
          value: analytics.verifiedEmails,
          icon: MailCheck,
          color: 'text-green-500',
          bg: 'bg-green-500/10',
        },
        {
          label: 'Active Campaigns',
          value: analytics.activeCampaigns,
          icon: Send,
          color: 'text-purple-500',
          bg: 'bg-purple-500/10',
        },
        {
          label: 'Videos Generated',
          value: analytics.videosGenerated,
          icon: Video,
          color: 'text-orange-500',
          bg: 'bg-orange-500/10',
        },
      ]
    : [];

  const quickActions = [
    { label: 'Upload Leads', path: '/dashboard/leads', icon: Users },
    { label: 'Create Video', path: '/dashboard/videos', icon: Video },
    { label: 'New Campaign', path: '/dashboard/campaigns', icon: Send },
    { label: 'View Analytics', path: '/dashboard/analytics', icon: TrendingUp },
  ];

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your campaigns</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, i) => (
                <Link key={i} to={action.path}>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex flex-col gap-2 hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    <action.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activity.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No recent activity</p>
                <Link to="/dashboard/leads">
                  <Button variant="link" className="mt-2">
                    Get started by uploading leads
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
