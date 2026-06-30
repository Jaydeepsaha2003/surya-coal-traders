import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Transporter = {
  id: string;
  name: string;
  phone: string | null;
  vehicleNo: string | null;
  location: string | null;
};

const empty = { name: '', phone: '', vehicleNo: '', location: '' };

export const TransportersPage = () => {
  const [rows, setRows] = useState<Transporter[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try {
      setRows(await window.surya.transporters.list());
    } catch (err) {
      toast.error('Failed to load transporters', { description: (err as Error).message });
    }
  };
  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (t: Transporter) => {
    setEditId(t.id);
    setForm({
      name: t.name ?? '',
      phone: t.phone ?? '',
      vehicleNo: t.vehicleNo ?? '',
      location: t.location ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const payload = {
      name: form.name.trim(),
      phone: form.phone || undefined,
      vehicleNo: form.vehicleNo || undefined,
      location: form.location || undefined,
    };
    try {
      if (editId) {
        await window.surya.transporters.update(editId, payload);
        toast.success('Transporter updated');
      } else {
        await window.surya.transporters.create(payload);
        toast.success('Transporter added');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error('Save failed', { description: (err as Error).message });
    }
  };

  const remove = async (t: Transporter) => {
    if (!window.confirm(`Delete transporter "${t.name}"?`)) return;
    try {
      await window.surya.transporters.remove(t.id);
      toast.success('Transporter deleted');
      load();
    } catch (err) {
      toast.error('Delete failed', { description: (err as Error).message });
    }
  };

  const filtered = rows.filter((t) =>
    [t.name, t.location, t.phone, t.vehicleNo]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transporters…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add New
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Vehicle No</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.location || '—'}</TableCell>
                <TableCell>{t.phone || '—'}</TableCell>
                <TableCell>{t.vehicleNo || '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <TableEmpty>No transporters yet. Click “Add New”.</TableEmpty>}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Transporter' : 'Add Transporter'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Vehicle No">
                <Input
                  value={form.vehicleNo}
                  onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editId ? 'Save changes' : 'Add transporter'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);
