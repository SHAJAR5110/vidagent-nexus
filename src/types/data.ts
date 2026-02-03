export interface Lead {
  id: string;
  userId: string;
  name: string;
  email: string;
  company: string;
  domain: string;
  status: 'uploaded' | 'processing' | 'verified' | 'failed';
  createdAt: string;
}

export interface Video {
  id: string;
  userId: string;
  name: string;
  script: string;
  avatar: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  leadIds: string[];
  videoId: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed';
  scheduledAt?: string;
  createdAt: string;
}

export interface Analytics {
  totalLeads: number;
  verifiedEmails: number;
  activeCampaigns: number;
  videosGenerated: number;
  emailOpenRate: number;
  videoWatchRate: number;
  replyRate: number;
}
