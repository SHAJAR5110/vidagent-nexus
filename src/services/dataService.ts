import { Lead, Video, Campaign, Analytics } from '@/types/data';

const LEADS_KEY = 'hiring_ai_leads';
const VIDEOS_KEY = 'hiring_ai_videos';
const CAMPAIGNS_KEY = 'hiring_ai_campaigns';
const ACTIVITIES_KEY = 'hiring_ai_activities';

export interface Activity {
  id: string;
  type: 'lead_uploaded' | 'lead_verified' | 'video_created' | 'campaign_started' | 'campaign_completed';
  message: string;
  timestamp: string;
  userId: string;
}

// Generic storage helpers
function getFromStorage<T>(key: string): T[] {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// LEADS
export function getLeads(userId: string): Lead[] {
  return getFromStorage<Lead>(LEADS_KEY).filter(lead => lead.userId === userId);
}

export function saveLead(lead: Lead): void {
  const leads = getFromStorage<Lead>(LEADS_KEY);
  leads.push(lead);
  saveToStorage(LEADS_KEY, leads);
}

export function saveLeads(newLeads: Lead[]): void {
  const leads = getFromStorage<Lead>(LEADS_KEY);
  saveToStorage(LEADS_KEY, [...leads, ...newLeads]);
}

export function updateLead(id: string, updates: Partial<Lead>): void {
  const leads = getFromStorage<Lead>(LEADS_KEY);
  const index = leads.findIndex(lead => lead.id === id);
  if (index !== -1) {
    leads[index] = { ...leads[index], ...updates };
    saveToStorage(LEADS_KEY, leads);
  }
}

export function deleteLead(id: string): void {
  const leads = getFromStorage<Lead>(LEADS_KEY).filter(lead => lead.id !== id);
  saveToStorage(LEADS_KEY, leads);
}

// VIDEOS
export function getVideos(userId: string): Video[] {
  return getFromStorage<Video>(VIDEOS_KEY).filter(video => video.userId === userId);
}

export function saveVideo(video: Video): void {
  const videos = getFromStorage<Video>(VIDEOS_KEY);
  videos.push(video);
  saveToStorage(VIDEOS_KEY, videos);
}

export function updateVideo(id: string, updates: Partial<Video>): void {
  const videos = getFromStorage<Video>(VIDEOS_KEY);
  const index = videos.findIndex(video => video.id === id);
  if (index !== -1) {
    videos[index] = { ...videos[index], ...updates };
    saveToStorage(VIDEOS_KEY, videos);
  }
}

export function deleteVideo(id: string): void {
  const videos = getFromStorage<Video>(VIDEOS_KEY).filter(video => video.id !== id);
  saveToStorage(VIDEOS_KEY, videos);
}

// CAMPAIGNS
export function getCampaigns(userId: string): Campaign[] {
  return getFromStorage<Campaign>(CAMPAIGNS_KEY).filter(campaign => campaign.userId === userId);
}

export function saveCampaign(campaign: Campaign): void {
  const campaigns = getFromStorage<Campaign>(CAMPAIGNS_KEY);
  campaigns.push(campaign);
  saveToStorage(CAMPAIGNS_KEY, campaigns);
}

export function updateCampaign(id: string, updates: Partial<Campaign>): void {
  const campaigns = getFromStorage<Campaign>(CAMPAIGNS_KEY);
  const index = campaigns.findIndex(campaign => campaign.id === id);
  if (index !== -1) {
    campaigns[index] = { ...campaigns[index], ...updates };
    saveToStorage(CAMPAIGNS_KEY, campaigns);
  }
}

export function deleteCampaign(id: string): void {
  const campaigns = getFromStorage<Campaign>(CAMPAIGNS_KEY).filter(campaign => campaign.id !== id);
  saveToStorage(CAMPAIGNS_KEY, campaigns);
}

// ACTIVITIES
export function getActivities(userId: string): Activity[] {
  return getFromStorage<Activity>(ACTIVITIES_KEY)
    .filter(activity => activity.userId === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

export function addActivity(activity: Activity): void {
  const activities = getFromStorage<Activity>(ACTIVITIES_KEY);
  activities.push(activity);
  saveToStorage(ACTIVITIES_KEY, activities);
}

// ANALYTICS
export function getAnalytics(userId: string): Analytics {
  const leads = getLeads(userId);
  const videos = getVideos(userId);
  const campaigns = getCampaigns(userId);
  
  const verifiedLeads = leads.filter(l => l.status === 'verified').length;
  const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
  
  return {
    totalLeads: leads.length,
    verifiedEmails: verifiedLeads,
    activeCampaigns,
    videosGenerated: videos.length,
    emailOpenRate: campaigns.length > 0 ? Math.round(Math.random() * 40 + 20) : 0,
    videoWatchRate: campaigns.length > 0 ? Math.round(Math.random() * 30 + 15) : 0,
    replyRate: campaigns.length > 0 ? Math.round(Math.random() * 15 + 5) : 0,
  };
}

// API Service (placeholder for n8n integration)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-n8n-instance.com/webhook';

export async function triggerEmailVerification(leads: Lead[]): Promise<{ success: boolean }> {
  // Placeholder for n8n webhook
  console.log('Triggering email verification for', leads.length, 'leads');
  
  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Update leads status
  leads.forEach(lead => {
    updateLead(lead.id, { status: 'verified' });
  });
  
  return { success: true };
}

export async function triggerVideoGeneration(videoId: string, script: string, avatar: string): Promise<{ success: boolean }> {
  // Placeholder for n8n webhook
  console.log('Triggering video generation:', { videoId, script, avatar });
  
  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  updateVideo(videoId, { 
    status: 'completed',
    videoUrl: 'https://example.com/video.mp4'
  });
  
  return { success: true };
}

export async function triggerCampaign(campaignId: string): Promise<{ success: boolean }> {
  // Placeholder for n8n webhook
  console.log('Triggering campaign:', campaignId);
  
  updateCampaign(campaignId, { status: 'running' });
  
  return { success: true };
}
