import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lead } from '@/types/data';
import { getLeads, saveLeads, triggerEmailVerification, addActivity } from '@/services/dataService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Search,
  MailCheck,
  Loader2,
  FileUp,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const loadLeads = useCallback(() => {
    if (user) {
      setLeads(getLeads(user.id));
    }
  }, [user]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateCSV = (headers: string[]): { valid: boolean; missing: string[] } => {
    const required = ['name', 'email', 'company', 'domain'];
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    const missing = required.filter(r => !lowerHeaders.includes(r));
    return { valid: missing.length === 0, missing };
  };

  const parseCSV = (text: string): Lead[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const { valid, missing } = validateCSV(headers);

    if (!valid) {
      toast.error(`Missing required columns: ${missing.join(', ')}`);
      return [];
    }

    const nameIdx = headers.indexOf('name');
    const emailIdx = headers.indexOf('email');
    const companyIdx = headers.indexOf('company');
    const domainIdx = headers.indexOf('domain');

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return {
        id: crypto.randomUUID(),
        userId: user!.id,
        name: values[nameIdx] || '',
        email: values[emailIdx] || '',
        company: values[companyIdx] || '',
        domain: values[domainIdx] || '',
        status: 'uploaded' as const,
        createdAt: new Date().toISOString(),
      };
    }).filter(lead => lead.email);
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setIsUploading(true);
    const text = await file.text();
    const newLeads = parseCSV(text);

    if (newLeads.length > 0) {
      saveLeads(newLeads);
      addActivity({
        id: crypto.randomUUID(),
        type: 'lead_uploaded',
        message: `Uploaded ${newLeads.length} leads`,
        timestamp: new Date().toISOString(),
        userId: user!.id,
      });
      toast.success(`Successfully uploaded ${newLeads.length} leads`);
      loadLeads();
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

  const handleVerifyEmails = async () => {
    const uploadedLeads = leads.filter(l => l.status === 'uploaded');
    if (uploadedLeads.length === 0) {
      toast.error('No leads to verify');
      return;
    }

    setIsVerifying(true);

    // Update status to processing
    uploadedLeads.forEach(lead => {
      lead.status = 'processing';
    });
    loadLeads();

    await triggerEmailVerification(uploadedLeads);

    addActivity({
      id: crypto.randomUUID(),
      type: 'lead_verified',
      message: `Verified ${uploadedLeads.length} email addresses`,
      timestamp: new Date().toISOString(),
      userId: user!.id,
    });

    toast.success(`Verified ${uploadedLeads.length} emails`);
    loadLeads();
    setIsVerifying(false);
  };

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(search.toLowerCase()) ||
    lead.email.toLowerCase().includes(search.toLowerCase()) ||
    lead.company.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: Lead['status']) => {
    const config = {
      uploaded: { label: 'Uploaded', icon: Clock, variant: 'secondary' as const },
      processing: { label: 'Processing', icon: Loader2, variant: 'outline' as const },
      verified: { label: 'Verified', icon: CheckCircle2, variant: 'default' as const },
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground mt-1">Upload and verify your lead emails</p>
        </div>
        <Button
          onClick={handleVerifyEmails}
          disabled={isVerifying || leads.filter(l => l.status === 'uploaded').length === 0}
        >
          {isVerifying ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <MailCheck className="w-4 h-4 mr-2" />
          )}
          Verify Emails
        </Button>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="pt-6">
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
              {isUploading ? 'Uploading...' : 'Upload CSV File'}
            </h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop or click to upload. Required columns: <strong>name, email, company, domain</strong>
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
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>All Leads ({leads.length})</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.company}</TableCell>
                      <TableCell>{lead.domain}</TableCell>
                      <TableCell>{statusBadge(lead.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No leads found. Upload a CSV to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
