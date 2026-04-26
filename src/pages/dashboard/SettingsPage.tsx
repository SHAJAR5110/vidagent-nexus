import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiKey, saveApiKey } from '@/services/dataService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Key, Bot, Mic } from 'lucide-react';
import { toast } from 'sonner';

interface KeyField {
  service: string;
  label: string;
  placeholder: string;
  type?: string;
  hint?: string;
}

const API_KEY_FIELDS: KeyField[] = [
  {
    service: 'apify',
    label: 'Apify API Token',
    placeholder: 'apify_api_…',
    type: 'password',
    hint: 'Found in your Apify account → Settings → Integrations. Used to verify prospect email addresses.',
  },
  {
    service: 'gemini',
    label: 'Gemini API Key',
    placeholder: 'AIza…',
    type: 'password',
    hint: 'Get it from Google AI Studio (aistudio.google.com)',
  },
  {
    service: 'heygen',
    label: 'HeyGen API Key',
    placeholder: 'Your HeyGen API key',
    type: 'password',
    hint: 'Found in your HeyGen account → API settings',
  },
  {
    service: 'manyreach',
    label: 'ManyReach API Key',
    placeholder: 'Your ManyReach API key',
    type: 'password',
    hint: 'Found in your ManyReach account → Settings → API. Used to send outreach emails.',
  },
];

const CONFIG_FIELDS: KeyField[] = [
  {
    service: 'heygen_avatar_id',
    label: 'HeyGen Avatar ID',
    placeholder: '03b55fe9b60a4584a0d5b507bcba060e',
    hint: 'Avatar ID for video renders. If set, takes priority over Talking Photo ID.',
  },
  {
    service: 'heygen_talking_photo_id',
    label: 'HeyGen Talking Photo ID',
    placeholder: 'e.g. talking_photo_abc123',
    hint: 'Used when no Avatar ID is set. Upload a photo in HeyGen → Talking Photo to get this ID.',
  },
  {
    service: 'heygen_voice_id',
    label: 'HeyGen Voice ID',
    placeholder: 'f255114308d841858d1ca9230bf83285',
    hint: 'The voice ID to use for all video renders',
  },
];

export default function SettingsPage() {
  const { user } = useAuth();

  // values[service] = current input value
  const [values, setValues] = useState<Record<string, string>>({});
  // saved[service] = whether a value is saved in DB
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const allFields = [...API_KEY_FIELDS, ...CONFIG_FIELDS];

  const loadKeys = useCallback(async () => {
    if (!user) return;
    const results = await Promise.all(
      allFields.map(f => getApiKey(user.id, f.service).then(v => ({ service: f.service, value: v }))),
    );
    const vals: Record<string, string> = {};
    const savedMap: Record<string, boolean> = {};
    for (const { service, value } of results) {
      vals[service] = value ?? '';
      savedMap[service] = !!value;
    }
    setValues(vals);
    setSaved(savedMap);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleSave = async (service: string) => {
    const val = values[service]?.trim();
    if (!val) { toast.error('Field cannot be empty'); return; }
    setSaving(prev => ({ ...prev, [service]: true }));
    try {
      await saveApiKey(user!.id, service, val);
      setSaved(prev => ({ ...prev, [service]: true }));
      toast.success('Saved');
    } catch {
      toast.error('Failed to save — try again');
    } finally {
      setSaving(prev => ({ ...prev, [service]: false }));
    }
  };

  const renderField = (field: KeyField) => {
    const isSaved = saved[field.service];
    const isSaving = saving[field.service];
    const isDirty = (values[field.service] ?? '') !== '' &&
      // consider dirty if user typed something different from what was loaded
      // (we don't store the original; just check non-empty)
      true;

    return (
      <div key={field.service} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{field.label}</label>
          {isSaved && (
            <Badge className="text-xs bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </Badge>
          )}
        </div>
        {field.hint && (
          <p className="text-xs text-muted-foreground">{field.hint}</p>
        )}
        <div className="flex gap-2">
          <Input
            type={field.type ?? 'text'}
            placeholder={field.placeholder}
            value={values[field.service] ?? ''}
            onChange={e => {
              setValues(prev => ({ ...prev, [field.service]: e.target.value }));
              setSaved(prev => ({ ...prev, [field.service]: false }));
            }}
            className="flex-1 font-mono text-sm"
          />
          <Button
            onClick={() => handleSave(field.service)}
            disabled={isSaving || !values[field.service]?.trim()}
            size="sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your API keys and video defaults</p>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            API Keys
          </CardTitle>
          <CardDescription>
            Keys are stored securely per account and used automatically during video creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {API_KEY_FIELDS.map(renderField)}
        </CardContent>
      </Card>

      {/* HeyGen Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            HeyGen Configuration
          </CardTitle>
          <CardDescription>
            Default avatar and voice used for every video render. Can be changed any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {CONFIG_FIELDS.map(renderField)}
        </CardContent>
      </Card>
    </div>
  );
}
