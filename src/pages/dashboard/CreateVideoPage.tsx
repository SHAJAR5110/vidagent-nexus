import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Video } from '@/types/data';
import { getVideos, saveVideo, triggerVideoGeneration, addActivity } from '@/services/dataService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Video as VideoIcon,
  Loader2,
  FileUp,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

const AVATARS = [
  { id: 'professional-male', name: 'Professional Male' },
  { id: 'professional-female', name: 'Professional Female' },
  { id: 'casual-male', name: 'Casual Male' },
  { id: 'casual-female', name: 'Casual Female' },
  { id: 'corporate-male', name: 'Corporate Male' },
  { id: 'corporate-female', name: 'Corporate Female' },
];

export default function CreateVideoPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingScripts, setPendingScripts] = useState<{ name: string; script: string }[]>([]);

  const loadVideos = useCallback(() => {
    if (user) {
      setVideos(getVideos(user.id));
    }
  }, [user]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const parseCSV = (text: string): { name: string; script: string }[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const scriptIdx = headers.indexOf('script');
    const nameIdx = headers.indexOf('name');

    if (scriptIdx === -1) {
      toast.error('CSV must contain a "script" column');
      return [];
    }

    return lines.slice(1).map((line, i) => {
      const values = line.split(',').map(v => v.trim());
      return {
        name: nameIdx !== -1 ? values[nameIdx] : `Video ${i + 1}`,
        script: values[scriptIdx] || '',
      };
    }).filter(item => item.script);
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setIsUploading(true);
    const text = await file.text();
    const scripts = parseCSV(text);

    if (scripts.length > 0) {
      setPendingScripts(scripts);
      toast.success(`Found ${scripts.length} scripts ready for video generation`);
    }

    setIsUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleGenerateVideos = async () => {
    if (pendingScripts.length === 0) {
      toast.error('No scripts to process');
      return;
    }

    setIsGenerating(true);

    for (const { name, script } of pendingScripts) {
      const video: Video = {
        id: crypto.randomUUID(),
        userId: user!.id,
        name,
        script,
        avatar: selectedAvatar,
        status: 'processing',
        createdAt: new Date().toISOString(),
      };

      saveVideo(video);
      loadVideos();

      await triggerVideoGeneration(video.id, script, selectedAvatar);

      addActivity({
        id: crypto.randomUUID(),
        type: 'video_created',
        message: `Generated video: ${name}`,
        timestamp: new Date().toISOString(),
        userId: user!.id,
      });
    }

    setPendingScripts([]);
    toast.success(`Generated ${pendingScripts.length} videos`);
    loadVideos();
    setIsGenerating(false);
  };

  const statusBadge = (status: Video['status']) => {
    const config = {
      pending: { label: 'Pending', icon: Clock, variant: 'secondary' as const },
      processing: { label: 'Processing', icon: Loader2, variant: 'outline' as const },
      completed: { label: 'Completed', icon: CheckCircle2, variant: 'default' as const },
      failed: { label: 'Failed', icon: AlertCircle, variant: 'destructive' as const },
    };
    const { label, icon: Icon, variant } = config[status];
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Video</h1>
        <p className="text-muted-foreground mt-1">Generate AI videos from CSV scripts</p>
      </div>

      {/* Important Notice */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Script must come from CSV</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Video scripts are loaded from your CSV file. Include a <strong>"script"</strong> column with the text you want the AI avatar to speak.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Scripts</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center transition-all
                ${dragActive ? 'border-primary bg-primary/5' : 'border-border'}
                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              {isUploading ? (
                <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
              ) : (
                <FileUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              )}
              <h3 className="text-lg font-semibold mb-2">
                {isUploading ? 'Uploading...' : 'Upload CSV with Scripts'}
              </h3>
              <p className="text-muted-foreground mb-4">
                Required column: <strong>script</strong>. Optional: <strong>name</strong>
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button asChild disabled={isUploading}>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Select File
                  </span>
                </Button>
              </label>
            </div>

            {pendingScripts.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-muted">
                <p className="font-medium mb-2">{pendingScripts.length} scripts ready</p>
                <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                  {pendingScripts.map((s, i) => (
                    <li key={i} className="truncate">• {s.name}: {s.script.slice(0, 50)}...</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Video Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Avatar</label>
              <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVATARS.map((avatar) => (
                    <SelectItem key={avatar.id} value={avatar.id}>
                      {avatar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerateVideos}
              disabled={isGenerating || pendingScripts.length === 0}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <VideoIcon className="w-4 h-4 mr-2" />
              )}
              Generate {pendingScripts.length} Videos
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Videos Table */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Videos ({videos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {videos.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Avatar</TableHead>
                    <TableHead>Script Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell className="font-medium">{video.name}</TableCell>
                      <TableCell>{AVATARS.find(a => a.id === video.avatar)?.name || video.avatar}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{video.script}</TableCell>
                      <TableCell>{statusBadge(video.status)}</TableCell>
                      <TableCell>
                        {video.status === 'completed' && (
                          <Button size="sm" variant="outline">
                            <Play className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No videos yet. Upload a CSV with scripts to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
