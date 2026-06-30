import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { paiseToRupees } from '@/lib/utils';

type Supplier = {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  openingBalance: number;
  openingDate: string | null;
};

const empty = {
  name: '',
  location: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  openingBalance: '',
  openingDate: '',
};

export const SuppliersPage = () => {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try {
      setRows(await window.surya.suppliers.list());
    } catch (err) {
      toast.error('Failed to load suppliers', { description: (err as Error).message });
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
  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({
      name: s.name ?? '',
      location: s.location ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      gstin: s.gstin ?? '',
      openingBalance: s.openingBalance ? String(paiseToRupees(s.openingBalance)) : '',
      openingDate: s.openingDate ?? '',
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
      location: form.location || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      gstin: form.gstin || undefined,
      openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
      openingDate: form.openingDate || undefined,
    };
    try {
      if (editId) {
        await window.surya.suppliers.update(editId, payload);
        toast.success('Supplier updated');
      } else {
        await window.surya.suppliers.create(payload);
        toast.success('Supplier added');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error('Save failed', { description: (err as Error).message });
    }
  };

  const remove = async (s: Supplier) => {
    if (!window.confirm(`Delete supplier "${s.name}"?`)) return;
    try {
      await window.surya.suppliers.remove(s.id);
      toast.success('Supplier deleted');
      load();
    } catch (err) {
      toast.error('Delete failed', { description: (err as Error).message });
    }
  };

  const filtered = rows.filter((s) =>
    [s.name, s.location, s.phone, s.gstin]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers…"
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
              <TableHead>GSTIN</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.location || '—'}</TableCell>
                <TableCell>{s.phone || '—'}</TableCell>
                <TableCell>{s.gstin || '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <TableEmpty>No suppliers yet. Click “Add New”.</TableEmpty>}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Address">
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label="GSTIN">
              <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            </Field>
            <div className="rounded-md border border-dashed p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Opening Balance — amount you already owe them
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₹)">
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.openingBalance}
                    onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                  />
                </Field>
                <Field label="As on date">
                  <Input
                    type="date"
                    value={form.openingDate}
                    onChange={(e) => setForm({ ...form, openingDate: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editId ? 'Save changes' : 'Add supplier'}</Button>
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
