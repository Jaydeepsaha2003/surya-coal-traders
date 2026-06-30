import { asc, eq, isNull } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { customers, suppliers, transporters } from '../../shared/db/schema';
import { openingBalancesMap, setOpeningBalance } from './ledger';
import {
  type CustomerFormInput,
  type SupplierFormInput,
  type TransporterFormInput,
} from '../../shared/types';

const now = () => new Date().toISOString();

// --------------------------- Customers ---------------------------

export const listCustomers = () => {
  const db = getDb();
  const rows = db
    .select()
    .from(customers)
    .where(isNull(customers.deletedAt))
    .orderBy(asc(customers.name))
    .all();
  const opening = openingBalancesMap('customer');
  return rows.map((r) => ({
    ...r,
    openingBalance: opening[r.id]?.amount ?? 0,
    openingDate: opening[r.id]?.date ?? null,
  }));
};

export const getCustomer = (id: string) => {
  const db = getDb();
  return db.select().from(customers).where(eq(customers.id, id)).get();
};

export const createCustomer = (input: CustomerFormInput): string => {
  if (!input.name?.trim()) throw new Error('Customer name is required');
  const db = getDb();
  const id = uuid();
  db.insert(customers)
    .values({
      id,
      name: input.name.trim(),
      location: input.location ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      gstin: input.gstin ?? null,
      creditPeriod: input.creditPeriod ?? 0,
      notes: input.notes ?? null,
    })
    .run();
  setOpeningBalance('customer', id, input.openingBalance ?? 0, input.openingDate);
  return id;
};

export const updateCustomer = (id: string, input: CustomerFormInput) => {
  if (!input.name?.trim()) throw new Error('Customer name is required');
  const db = getDb();
  db.update(customers)
    .set({
      name: input.name.trim(),
      location: input.location ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      gstin: input.gstin ?? null,
      creditPeriod: input.creditPeriod ?? 0,
      notes: input.notes ?? null,
      updatedAt: now(),
    })
    .where(eq(customers.id, id))
    .run();
  setOpeningBalance('customer', id, input.openingBalance ?? 0, input.openingDate);
};

export const deleteCustomer = (id: string) => {
  const db = getDb();
  db.update(customers).set({ deletedAt: now() }).where(eq(customers.id, id)).run();
};

// --------------------------- Suppliers ---------------------------

export const listSuppliers = () => {
  const db = getDb();
  const rows = db
    .select()
    .from(suppliers)
    .where(isNull(suppliers.deletedAt))
    .orderBy(asc(suppliers.name))
    .all();
  const opening = openingBalancesMap('supplier');
  return rows.map((r) => ({
    ...r,
    openingBalance: opening[r.id]?.amount ?? 0,
    openingDate: opening[r.id]?.date ?? null,
  }));
};

export const getSupplier = (id: string) => {
  const db = getDb();
  return db.select().from(suppliers).where(eq(suppliers.id, id)).get();
};

export const createSupplier = (input: SupplierFormInput): string => {
  if (!input.name?.trim()) throw new Error('Supplier name is required');
  const db = getDb();
  const id = uuid();
  db.insert(suppliers)
    .values({
      id,
      name: input.name.trim(),
      location: input.location ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      gstin: input.gstin ?? null,
      notes: input.notes ?? null,
    })
    .run();
  setOpeningBalance('supplier', id, input.openingBalance ?? 0, input.openingDate);
  return id;
};

export const updateSupplier = (id: string, input: SupplierFormInput) => {
  if (!input.name?.trim()) throw new Error('Supplier name is required');
  const db = getDb();
  db.update(suppliers)
    .set({
      name: input.name.trim(),
      location: input.location ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      gstin: input.gstin ?? null,
      notes: input.notes ?? null,
      updatedAt: now(),
    })
    .where(eq(suppliers.id, id))
    .run();
  setOpeningBalance('supplier', id, input.openingBalance ?? 0, input.openingDate);
};

export const deleteSupplier = (id: string) => {
  const db = getDb();
  db.update(suppliers).set({ deletedAt: now() }).where(eq(suppliers.id, id)).run();
};

// --------------------------- Transporters ---------------------------

export const listTransporters = () => {
  const db = getDb();
  return db
    .select()
    .from(transporters)
    .where(isNull(transporters.deletedAt))
    .orderBy(asc(transporters.name))
    .all();
};

export const getTransporter = (id: string) => {
  const db = getDb();
  return db.select().from(transporters).where(eq(transporters.id, id)).get();
};

export const createTransporter = (input: TransporterFormInput): string => {
  if (!input.name?.trim()) throw new Error('Transporter name is required');
  const db = getDb();
  const id = uuid();
  db.insert(transporters)
    .values({
      id,
      name: input.name.trim(),
      phone: input.phone ?? null,
      vehicleNo: input.vehicleNo ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
    })
    .run();
  return id;
};

export const updateTransporter = (id: string, input: TransporterFormInput) => {
  if (!input.name?.trim()) throw new Error('Transporter name is required');
  const db = getDb();
  db.update(transporters)
    .set({
      name: input.name.trim(),
      phone: input.phone ?? null,
      vehicleNo: input.vehicleNo ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      updatedAt: now(),
    })
    .where(eq(transporters.id, id))
    .run();
};

export const deleteTransporter = (id: string) => {
  const db = getDb();
  db.update(transporters).set({ deletedAt: now() }).where(eq(transporters.id, id)).run();
};
