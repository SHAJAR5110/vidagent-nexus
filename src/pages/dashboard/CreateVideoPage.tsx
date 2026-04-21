import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, Video } from '@/types/data';
import {
  getLeads, getVideos, saveVideo, updateVideo,
  getApiKey, saveApiKey, addActivity,
} from '@/services/dataService';
import { generateScriptForLead } from '@/services/scriptGenerationService';
import { submitVideoPrompt, pollSession, pollVideo } from '@/services/videoGenerationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Video as VideoIcon, Loader2, CheckCircle2, Clock,
  AlertCircle, Sparkles, Key, Play, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 15_000;

type ScriptMap = Record<string, string>; // leadId → script

export default function CreateVideoPage() {
  const { user } = useAuth();

  // Data
  const [validLeads, setValidLeads] = useState<Lead[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Campaign config
  const [campaignDescription, setCampaignDescription] = useState('');
  const [avatarId, setAvatarId] = useState('03b55fe9b60a4584a0d5b507bcba060e');
  const [voiceId, setVoiceId] = useState('f255114308d841858d1ca9230bf83285');
  const [geminiKeyField, setGeminiKeyField] = useState('');
  const [heygenKeyField, setHeygenKeyField] = useState('');

  // Script step
  const [scripts, setScripts] = useState<ScriptMap>({});
  const [expandedScripts, setExpandedScripts] = useState<Set<string>>(new Set());
  const [isGeneratingScripts, setIsGeneratingScripts] = useState(false);
  const [scriptProgress, setScriptProgress] = useState<{ current: number; total: number } | null>(null);

  // Video step
  const [isSubmitting, setIsSubmitting] = useState(false);

  // API key dialogs
  const [geminiDialog, setGeminiDialog] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [heygenDialog, setHeygenDialog] = useState(false);
  const [heygenKeyInput, setHeygenKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    const [leads, vids, savedGeminiKey, savedHeygenKey, savedAvatarId, savedVoiceId] = await Promise.all([
      getLeads(user.id),
      getVideos(user.id),
      getApiKey(user.id, 'gemini'),
      getApiKey(user.id, 'heygen'),
      getApiKey(user.id, 'heygen_avatar_id'),
      getApiKey(user.id, 'heygen_voice_id'),
    ]);
    setValidLeads(leads.filter(l => l.status === 'valid'));
    setVideos(vids);
    if (savedGeminiKey) setGeminiKeyField(savedGeminiKey);
    if (savedHeygenKey) setHeygenKeyField(savedHeygenKey);
    if (savedAvatarId) setAvatarId(savedAvatarId);
    if (savedVoiceId) setVoiceId(savedVoiceId);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Polling ──────────────────────────────────────────────────────────────────

  const runPoll = useCallback(async () => {
    if (!user) return;
    const current = await getVideos(user.id);
    const processing = current.filter(v => v.status === 'processing');
    if (processing.length === 0) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      setVideos(current);
      return;
    }
    const apiKey = await getApiKey(user.id, 'heygen');
    if (!apiKey) return;

    await Promise.all(processing.map(async (video) => {
      try {
        if (!video.heygenVideoId && video.heygenSessionId) {
          const session = await pollSession(video.heygenSessionId, apiKey);
          if (session.videoId) {
            await updateVideo(video.id, { heygenVideoId: session.videoId });
          }
          if (session.status === 'failed') {
            await updateVideo(video.id, { status: 'failed', errorMessage: 'HeyGen session failed' });
          }
        } else if (video.heygenVideoId) {
          const result = await pollVideo(video.heygenVideoId, apiKey);
          if (result.status === 'completed') {
            await updateVideo(video.id, {
              status: 'completed',
              videoUrl: result.videoUrl,
              thumbnailUrl: result.thumbnailUrl,
            });
          } else if (result.status === 'failed') {
            await updateVideo(video.id, { status: 'failed', errorMessage: result.failureMessage });
          }
        }
      } catch { /* keep polling */ }
    }));

    const updated = await getVideos(user.id);
    setVideos(updated);
  }, [user]);

  useEffect(() => {
    const hasProcessing = videos.some(v => v.status === 'processing');
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(runPoll, POLL_INTERVAL_MS);
    }
    if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [videos, runPoll]);

  // ── Lead selection ───────────────────────────────────────────────────────────

  const toggleLead = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev =>
      prev.size === validLeads.length ? new Set() : new Set(validLeads.map(l => l.id)),
    );
  };

  // ── Script generation (Gemini) ───────────────────────────────────────────────

  const handleGenerateScripts = async () => {
    if (selectedIds.size === 0) return toast.error('Select at least one lead');
    if (!campaignDescription.trim()) return toast.error('Enter a campaign description first');

    const key = geminiKeyField.trim() || await getApiKey(user!.id, 'gemini');
    if (!key) { setGeminiDialog(true); return; }
    // Persist if it's new/changed
    const saved = await getApiKey(user!.id, 'gemini');
    if (geminiKeyField.trim() && geminiKeyField.trim() !== saved) {
      await saveApiKey(user!.id, 'gemini', geminiKeyField.trim());
    }
    runScriptGeneration(Array.from(selectedIds), campaignDescription, key);
  };

  const runScriptGeneration = async (leadIds: string[], description: string, apiKey: string) => {
    const leads = validLeads.filter(l => leadIds.includes(l.id));
    setIsGeneratingScripts(true);
    setScriptProgress({ current: 0, total: leads.length });

    const newScripts: ScriptMap = { ...scripts };
    for (const lead of leads) {
      try {
        const script = await generateScriptForLead(lead, description, apiKey);
        newScripts[lead.id] = script;
      } catch (e) {
        toast.error(`Script failed for ${lead.firstName} ${lead.lastName}: ${e instanceof Error ? e.message : 'error'}`);
      }
      setScriptProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
    }

    setScripts(newScripts);
    setIsGeneratingScripts(false);
    setScriptProgress(null);
    toast.success(`Generated ${Object.keys(newScripts).length} scripts`);
  };

  // ── HeyGen submission ────────────────────────────────────────────────────────

  const handleSubmitToHeygen = async () => {
    const toSubmit = Array.from(selectedIds).filter(id => scripts[id]);
    if (toSubmit.length === 0) return toast.error('Generate scripts first');

    const key = heygenKeyField.trim() || await getApiKey(user!.id, 'heygen');
    if (!key) { setHeygenDialog(true); return; }
    const saved = await getApiKey(user!.id, 'heygen');
    if (heygenKeyField.trim() && heygenKeyField.trim() !== saved) {
      await saveApiKey(user!.id, 'heygen', heygenKeyField.trim());
    }
    runHeygenSubmission(toSubmit, key);
  };

  const runHeygenSubmission = async (leadIds: string[], apiKey: string) => {
    // Persist avatar/voice IDs for next session
    await Promise.all([
      avatarId && saveApiKey(user!.id, 'heygen_avatar_id', avatarId),
      voiceId && saveApiKey(user!.id, 'heygen_voice_id', voiceId),
    ]);
    setIsSubmitting(true);
    const leads = validLeads.filter(l => leadIds.includes(l.id));
    let submitted = 0;

    for (const lead of leads) {
      const script = scripts[lead.id];
      if (!script) continue;
      const video: Video = {
        id: crypto.randomUUID(),
        userId: user!.id,
        leadId: lead.id,
        name: `${lead.firstName} ${lead.lastName} — ${lead.company}`,
        script,
        avatarId: avatarId || undefined,
        voiceId: voiceId || undefined,
        status: 'processing',
        createdAt: new Date().toISOString(),
      };

      try {
        const sessionId = await submitVideoPrompt(
          script, apiKey,
          { avatarId: avatarId || undefined, voiceId: voiceId || undefined },
        );
        video.heygenSessionId = sessionId;
        await saveVideo(video);
        submitted++;
      } catch (e) {
        video.status = 'failed';
        video.errorMessage = e instanceof Error ? e.message : 'Submit failed';
        await saveVideo(video);
        toast.error(`Failed for ${lead.firstName}: ${video.errorMessage}`);
      }
    }

    addActivity({
      id: crypto.randomUUID(),
      type: 'video_created',
      message: `Submitted ${submitted} videos to HeyGen`,
      timestamp: new Date().toISOString(),
      userId: user!.id,
    });

    toast.success(`${submitted} videos submitted — polling every 15s`);
    await loadData();
    setIsSubmitting(false);
  };

  // ── API key save handlers ────────────────────────────────────────────────────

  const saveKey = async (service: string, value: string, onDone: (key: string) => void) => {
    if (!value.trim()) return;
    setIsSavingKey(true);
    try {
      await saveApiKey(user!.id, service, value.trim());
      toast.success('API key saved');
      onDone(value.trim());
    } catch { toast.error('Failed to save key'); }
    finally { setIsSavingKey(false); }
  };

  // ── UI helpers ───────────────────────────────────────────────────────────────

  const scriptsReady = Array.from(selectedIds).some(id => scripts[id]);
  const allSelected = validLeads.length > 0 && selectedIds.size === validLeads.length;

  const statusBadge = (status: Video['status']) => {
    const map: Record<Video['status'], { label: string; variant: 'secondary' | 'outline' | 'default' | 'destructive'; spin?: boolean }> = {
      pending:           { label: 'Pending',          variant: 'secondary' },
      generating_script: { label: 'Generating Script', variant: 'outline', spin: true },
      script_ready:      { label: 'Script Ready',      variant: 'secondary' },
      processing:        { label: 'Processing',        variant: 'outline', spin: true },
      completed:         { label: 'Completed',         variant: 'default' },
      failed:            { label: 'Failed',            variant: 'destructive' },
    };
    const { label, variant, spin } = map[status];
    const Icon = spin ? Loader2 : status === 'completed' ? CheckCircle2 : status === 'failed' ? AlertCircle : Clock;
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className={`w-3 h-3 ${spin ? 'animate-spin' : ''}`} /> {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Videos</h1>
        <p className="text-muted-foreground mt-1">Generate personalised scripts with Gemini, then render with HeyGen</p>
      </div>

      {/* Campaign config */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />Campaign Setup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Campaign Description <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Describe what you offer. Gemini will use this to personalise each script. e.g. 'We help SaaS companies reduce churn by 40% using AI-powered onboarding...'"
              value={campaignDescription}
              onChange={e => setCampaignDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">HeyGen Avatar ID</label>
              <Input value={avatarId} onChange={e => setAvatarId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">HeyGen Voice ID</label>
              <Input value={voiceId} onChange={e => setVoiceId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Gemini API Key</label>
              <Input
                type="password"
                placeholder="AIza…"
                value={geminiKeyField}
                onChange={e => setGeminiKeyField(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">HeyGen API Key</label>
              <Input
                type="password"
                placeholder="Your HeyGen API key"
                value={heygenKeyField}
                onChange={e => setHeygenKeyField(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lead selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select Valid Leads ({validLeads.length})</CardTitle>
            {validLeads.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {validLeads.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No valid leads yet — verify emails on the Leads page first.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Script</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validLeads.map(lead => (
                    <TableRow key={lead.id} className="cursor-pointer" onClick={() => toggleLead(lead.id)}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleLead(lead.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{lead.firstName} {lead.lastName}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.company}</TableCell>
                      <TableCell>
                        {scripts[lead.id] ? (
                          <button
                            className="flex items-center gap-1 text-xs text-primary"
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedScripts(prev => {
                                const next = new Set(prev);
                                next.has(lead.id) ? next.delete(lead.id) : next.add(lead.id);
                                return next;
                              });
                            }}
                          >
                            {expandedScripts.has(lead.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {expandedScripts.has(lead.id) ? 'Hide' : 'Preview'}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Script preview rows */}
                  {validLeads.filter(l => expandedScripts.has(l.id) && scripts[l.id]).map(lead => (
                    <TableRow key={`script-${lead.id}`} className="bg-muted/30">
                      <TableCell colSpan={5} className="py-2 px-4">
                        <Textarea
                          className="text-sm min-h-[80px] bg-background"
                          value={scripts[lead.id]}
                          onChange={e => setScripts(prev => ({ ...prev, [lead.id]: e.target.value }))}
                          onClick={e => e.stopPropagation()}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleGenerateScripts}
          disabled={isGeneratingScripts || selectedIds.size === 0 || !campaignDescription.trim()}
          variant="outline"
          size="lg"
        >
          {isGeneratingScripts
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating {scriptProgress?.current}/{scriptProgress?.total}…</>
            : <><Sparkles className="w-4 h-4 mr-2" />Step 1: Generate Scripts ({selectedIds.size})</>
          }
        </Button>
        <Button
          onClick={handleSubmitToHeygen}
          disabled={isSubmitting || !scriptsReady}
          size="lg"
        >
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
            : <><VideoIcon className="w-4 h-4 mr-2" />Step 2: Submit to HeyGen</>
          }
        </Button>
      </div>

      {/* Videos status table */}
      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Generated Videos ({videos.length})
              {videos.some(v => v.status === 'processing') && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />Polling every 15s
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map(video => (
                    <TableRow key={video.id}>
                      <TableCell className="font-medium">{video.name}</TableCell>
                      <TableCell>{statusBadge(video.status)}</TableCell>
                      <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                        {video.errorMessage ?? '—'}
                      </TableCell>
                      <TableCell>
                        {video.status === 'completed' && video.videoUrl && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={video.videoUrl} target="_blank" rel="noreferrer">
                              <Play className="w-4 h-4 mr-1" />Watch
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gemini API key dialog */}
      <Dialog open={geminiDialog} onOpenChange={setGeminiDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" />Gemini API Key</DialogTitle>
            <DialogDescription>Enter your Google AI Studio API key for script generation.</DialogDescription>
          </DialogHeader>
          <Input placeholder="AIza..." value={geminiKeyInput} onChange={e => setGeminiKeyInput(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setGeminiDialog(false)}>Cancel</Button>
            <Button disabled={isSavingKey || !geminiKeyInput.trim()} onClick={() =>
              saveKey('gemini', geminiKeyInput, key => {
                setGeminiDialog(false);
                setGeminiKeyInput('');
                runScriptGeneration(Array.from(selectedIds), campaignDescription, key);
              })
            }>
              {isSavingKey ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Save & Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HeyGen API key dialog */}
      <Dialog open={heygenDialog} onOpenChange={setHeygenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" />HeyGen API Key</DialogTitle>
            <DialogDescription>Enter your HeyGen API key for video generation.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Your HeyGen API key" value={heygenKeyInput} onChange={e => setHeygenKeyInput(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeygenDialog(false)}>Cancel</Button>
            <Button disabled={isSavingKey || !heygenKeyInput.trim()} onClick={() =>
              saveKey('heygen', heygenKeyInput, key => {
                setHeygenDialog(false);
                setHeygenKeyInput('');
                runHeygenSubmission(Array.from(selectedIds).filter(id => scripts[id]), key);
              })
            }>
              {isSavingKey ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Save & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
