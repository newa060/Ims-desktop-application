import { BaseRepository } from './BaseRepository';
import {
  StaffMember,
  StaffIdentityDocument,
  StaffEmergencyContact,
  StaffAttendanceRecord,
  StaffTask,
  StaffPurchase,
  StaffSalaryRecord,
  StaffPayslip,
  PaginationParams,
  PaginatedResponse,
  CreateStaffInput,
  UpdateStaffInput,
  CreateAttendanceInput,
  CreateTaskInput,
  CreateStaffPurchaseInput,
  StaffDirectoryStats,
} from '../types';

// ---------------------------------------------------------------------------
// Select strings
// ---------------------------------------------------------------------------

const STAFF_BASE_SELECT =
  '*, identityDocument:staff_identity_documents(*), emergencyContact:staff_emergency_contacts(*)';

const STAFF_WITH_USER_SELECT =
  '*, user:users(id, firstName, lastName, email), identityDocument:staff_identity_documents(*), emergencyContact:staff_emergency_contacts(*)';

// ---------------------------------------------------------------------------
// Staff core CRUD
// ---------------------------------------------------------------------------

export class StaffRepository extends BaseRepository<StaffMember> {
  protected getTableName(): string {
    return 'staff';
  }

  // Override findAll to exclude soft-deleted and include joined relations
  async findAll(): Promise<StaffMember[]> {
    const { data, error } = await this.supabase
      .from('staff')
      .select(STAFF_BASE_SELECT)
      .is('deletedAt', null)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return (data || []) as StaffMember[];
  }

  async findById(id: string): Promise<StaffMember | null> {
    const { data, error } = await this.supabase
      .from('staff')
      .select(STAFF_WITH_USER_SELECT)
      .eq('id', id)
      .is('deletedAt', null)
      .maybeSingle();

    if (error) throw error;
    return data as StaffMember | null;
  }

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<StaffMember>> {
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const { page, limit, from, to } = this.buildPagination(params);

    let query = this.supabase
      .from('staff')
      .select(STAFF_BASE_SELECT, { count: 'exact' })
      .is('deletedAt', null);

    if (search) {
      query = query.or(
        `firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%,staffCode.ilike.%${search}%,jobTitle.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (error) throw error;
    return this.toPaginatedResponse(data as StaffMember[], count || 0, page, limit);
  }

  // Create staff + identity doc + emergency contact in three sequential inserts
  // (Supabase JS client doesn't support multi-table transactions natively —
  //  a Postgres RPC would be cleaner but adds complexity for this step)
  async createWithRelations(input: CreateStaffInput): Promise<StaffMember> {
    const {
      idType, idNumber, idExpiryDate,
      idVerificationStatus,
      frontDocumentUrl, backDocumentUrl,
      emergencyContactName, emergencyContactRelationship, emergencyContactPhone,
      ...staffFields
    } = input;

    // Generate staff code (STF-XXX) using current count
    const { count } = await this.supabase
      .from('staff')
      .select('*', { count: 'exact', head: true });

    const nextNum = (count || 0) + 1;
    const staffCode = `STF-${String(nextNum).padStart(3, '0')}`;

    const { data: staff, error: staffError } = await this.supabase
      .from('staff')
      .insert({ ...staffFields, staffCode })
      .select('id')
      .single();

    if (staffError) throw staffError;
    const staffId = (staff as any).id;

    // Identity document row — always insert, include URLs and verification status
    const { error: idError } = await this.supabase
      .from('staff_identity_documents')
      .insert({
        staffId,
        idType,
        idNumber,
        idExpiryDate,
        verificationStatus: idVerificationStatus ?? 'Pending',
        frontDocumentUrl:   frontDocumentUrl ?? null,
        backDocumentUrl:    backDocumentUrl  ?? null,
      });

    if (idError) throw idError;

    // Emergency contact (only if name provided)
    if (emergencyContactName) {
      const { error: ecError } = await this.supabase
        .from('staff_emergency_contacts')
        .insert({
          staffId,
          contactName: emergencyContactName,
          relationship: emergencyContactRelationship,
          phone: emergencyContactPhone ?? '',
        });
      if (ecError) throw ecError;
    }

    const created = await this.findById(staffId);
    if (!created) throw new Error('Staff record not found after creation');
    return created;
  }

  async updateStaff(id: string, data: UpdateStaffInput): Promise<StaffMember> {
    // Pull out related-table fields before updating the staff row
    const {
      idType, idNumber, idExpiryDate, idVerificationStatus,
      frontDocumentUrl, backDocumentUrl,
      emergencyContactName, emergencyContactRelationship, emergencyContactPhone,
      ...staffFields
    } = data as any;

    const { data: updated, error } = await this.supabase
      .from('staff')
      .update({ ...staffFields, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();

    if (error) throw error;

    // Upsert identity document row (always exists after create, so this is always an update)
    const idDocUpdate: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (idType              !== undefined) idDocUpdate.idType             = idType;
    if (idNumber            !== undefined) idDocUpdate.idNumber           = idNumber;
    if (idExpiryDate        !== undefined) idDocUpdate.idExpiryDate       = idExpiryDate;
    if (idVerificationStatus !== undefined) idDocUpdate.verificationStatus = idVerificationStatus;
    if (frontDocumentUrl    !== undefined) idDocUpdate.frontDocumentUrl   = frontDocumentUrl;
    if (backDocumentUrl     !== undefined) idDocUpdate.backDocumentUrl    = backDocumentUrl;

    if (Object.keys(idDocUpdate).length > 1) {
      // Try update first; if no row exists yet, insert it
      const { error: idErr } = await this.supabase
        .from('staff_identity_documents')
        .upsert({ staffId: id, ...idDocUpdate }, { onConflict: 'staffId' });
      if (idErr) throw idErr;
    }

    // Upsert emergency contact row
    if (emergencyContactName !== undefined) {
      const { error: ecErr } = await this.supabase
        .from('staff_emergency_contacts')
        .upsert(
          {
            staffId:      id,
            contactName:  emergencyContactName ?? '',
            relationship: emergencyContactRelationship ?? null,
            phone:        emergencyContactPhone ?? '',
            updatedAt:    new Date().toISOString(),
          },
          { onConflict: 'staffId' }
        );
      if (ecErr) throw ecErr;
    }

    const result = await this.findById((updated as any).id);
    if (!result) throw new Error('Staff not found after update');
    return result;
  }

  // Soft delete
  async deleteStaff(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('staff')
      .update({ deletedAt: new Date().toISOString(), isActive: false })
      .eq('id', id);

    if (error) throw error;
  }

  // Directory stats for the summary cards
  async getDirectoryStats(): Promise<StaffDirectoryStats> {
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString();

    // All columns on the live staff table are camelCase (confirmed from DB).
    // staff_tasks also uses camelCase deletedAt (confirmed after migration).
    const [totalRes, presentRes, onLeaveRes, tasksRes, newRes] = await Promise.all([
      this.supabase.from('staff').select('*', { count: 'exact', head: true })
        .is('deletedAt', null).eq('isActive', true),
      this.supabase.from('staff').select('*', { count: 'exact', head: true })
        .is('deletedAt', null).eq('currentAttendanceStatus', 'Present'),
      this.supabase.from('staff').select('*', { count: 'exact', head: true })
        .is('deletedAt', null).eq('currentAttendanceStatus', 'On Leave'),
      this.supabase.from('staff_tasks').select('*', { count: 'exact', head: true })
        .is('deletedAt', null).in('status', ['pending', 'in-progress']),
      this.supabase.from('staff').select('*', { count: 'exact', head: true })
        .is('deletedAt', null).gte('createdAt', firstOfMonth),
    ]);

    return {
      totalStaff:        totalRes.count   || 0,
      presentToday:      presentRes.count || 0,
      onLeave:           onLeaveRes.count || 0,
      pendingTasksCount: tasksRes.count   || 0,
      newThisMonth:      newRes.count     || 0,
    };
  }

  /** Staff currently marked Present today */
  async getPresentToday(): Promise<StaffMember[]> {
    const { data, error } = await this.supabase
      .from('staff')
      .select(STAFF_BASE_SELECT)
      .is('deletedAt', null)
      .eq('isActive', true)
      .eq('currentAttendanceStatus', 'Present')
      .order('firstName', { ascending: true });

    if (error) throw error;
    return (data || []) as StaffMember[];
  }

  /** Staff currently marked On Leave */
  async getOnLeave(): Promise<StaffMember[]> {
    const { data, error } = await this.supabase
      .from('staff')
      .select(STAFF_BASE_SELECT)
      .is('deletedAt', null)
      .eq('isActive', true)
      .eq('currentAttendanceStatus', 'On Leave')
      .order('firstName', { ascending: true });

    if (error) throw error;
    return (data || []) as StaffMember[];
  }

  /** All pending/in-progress tasks across all staff, joined with staff name */
  async getAllPendingTasks(): Promise<Array<StaffTask & { staffFirstName: string; staffLastName: string; staffCode: string }>> {
    const { data, error } = await this.supabase
      .from('staff_tasks')
      .select('*, staff:staffId(firstName, lastName, staffCode)')
      .is('deletedAt', null)
      .in('status', ['pending', 'in-progress'])
      .order('dueDate', { ascending: true, nullsFirst: false });

    if (error) throw error;

    // Flatten nested staff join into flat fields
    return ((data || []) as any[]).map((row) => ({
      ...row,
      staffFirstName: row.staff?.firstName ?? '',
      staffLastName:  row.staff?.lastName  ?? '',
      staffCode:      row.staff?.staffCode ?? '',
      staff:          undefined,
    }));
  }
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export class StaffAttendanceRepository {
  private supabase = (new StaffRepository() as any).supabase;

  // Confirmed live columns (staff_attendance):
  //   id, staffId, attendanceDate, status, checkInTime, checkOutTime,
  //   notes, recordedByUserId, createdAt, updatedAt

  async findByStaffAndMonth(
    staffId: string,
    year: number,
    month: number
  ): Promise<StaffAttendanceRecord[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('staff_attendance')
      .select('*')
      .eq('staffId', staffId)
      .gte('attendanceDate', startDate)
      .lte('attendanceDate', endDate)
      .order('attendanceDate', { ascending: true });

    if (error) throw error;
    return (data || []) as StaffAttendanceRecord[];
  }

  async upsert(input: CreateAttendanceInput): Promise<StaffAttendanceRecord> {
    const dbRow: Record<string, unknown> = {
      staffId:        input.staffId,
      attendanceDate: input.attendanceDate,
      status:         input.status,
    };
    if (input.checkInTime)  dbRow.checkInTime  = input.checkInTime;
    if (input.checkOutTime) dbRow.checkOutTime = input.checkOutTime;
    if (input.notes)        dbRow.notes        = input.notes;

    const { data, error } = await this.supabase
      .from('staff_attendance')
      .upsert(dbRow, { onConflict: 'staffId,attendanceDate' })
      .select('*')
      .single();

    if (error) throw error;

    // Sync today's attendance snapshot on the staff row — write the EXACT
    // status (Late, On Leave, etc.) so the Directory reflects the real state.
    // Previously this collapsed Late → Present, which caused the Directory to
    // show "Present" when the member was actually marked Late.
    const today = new Date().toISOString().split('T')[0];
    if (input.attendanceDate === today) {
      await this.supabase
        .from('staff')
        .update({ currentAttendanceStatus: input.status })
        .eq('id', input.staffId);
    }

    return data as StaffAttendanceRecord;
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export class StaffTaskRepository {
  private supabase = (new StaffRepository() as any).supabase;

  // Confirmed live columns (staff_tasks):
  //   id, staffId, title, description, priority, status, dueDate,
  //   completedAt, assignedByUserId, createdAt, updatedAt, deletedAt

  async findByStaff(staffId: string): Promise<StaffTask[]> {
    const { data, error } = await this.supabase
      .from('staff_tasks')
      .select('*')
      .eq('staffId', staffId)
      .is('deletedAt', null)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return (data || []) as StaffTask[];
  }

  async create(input: CreateTaskInput): Promise<StaffTask> {
    const dbRow: Record<string, unknown> = {
      staffId:  input.staffId,
      title:    input.title,
      priority: input.priority,
      status:   input.status ?? 'pending',
    };
    if (input.description) dbRow.description = input.description;
    if (input.dueDate)     dbRow.dueDate      = input.dueDate;

    const { data, error } = await this.supabase
      .from('staff_tasks')
      .insert(dbRow)
      .select('*')
      .single();

    if (error) throw error;
    return data as StaffTask;
  }

  async updateStatus(
    id: string,
    status: StaffTask['status']
  ): Promise<StaffTask> {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('staff_tasks')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as StaffTask;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('staff_tasks')
      .update({ deletedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

export class StaffPurchaseRepository {
  private supabase = (new StaffRepository() as any).supabase;

  async findByStaff(
    staffId: string,
    params?: { month?: number; year?: number }
  ): Promise<StaffPurchase[]> {
    const buildQuery = (staffIdKey: string) => {
      let q = this.supabase
        .from('staff_purchases')
        .select('*')
        .eq(staffIdKey, staffId)
        .is('deletedAt', null)
        .order('purchaseDate', { ascending: false });
      if (params?.year && params?.month) {
        const start = `${params.year}-${String(params.month).padStart(2, '0')}-01`;
        const end = new Date(params.year, params.month, 0).toISOString().split('T')[0];
        q = q.gte('purchaseDate', start).lte('purchaseDate', end);
      }
      return q;
    };

    let { data, error } = await buildQuery('staffId');
    if (error && (error.message?.includes('staffId') || error.code === '42703')) {
      ({ data, error } = await buildQuery('staff_id'));
    }
    if (error) throw error;
    return ((data || []) as any[]).map(r => ({
      ...r,
      staffId: r.staffId ?? r.staff_id,
    })) as StaffPurchase[];
  }

  async create(input: CreateStaffPurchaseInput): Promise<StaffPurchase> {
    // Non-salary payments are immediately settled — mark as 'Paid'
    const deductionStatus =
      input.paymentMethod === 'Salary Deduction' ? 'Pending' : 'Paid';

    const payload: Record<string, unknown> = {
      staffId:      input.staffId,
      itemName:     input.itemName,
      purchaseDate: input.purchaseDate,
      amount:       input.amount,
      deductionStatus,
    };

    // Optional fields
    if (input.category)      payload.category      = input.category;
    if (input.productId)     payload.productId     = input.productId;
    if (input.paymentMethod) payload.paymentMethod = input.paymentMethod;
    if (input.paymentNote)   payload.paymentNote   = input.paymentNote;

    const { data, error } = await this.supabase
      .from('staff_purchases')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      // Fallback 1: snake_case staffId column (legacy DB)
      if (error.message?.includes('staffId') || error.code === '42703') {
        const p2: Record<string, unknown> = { ...payload, staff_id: payload.staffId };
        delete p2['staffId'];
        const { data: d2, error: e2 } = await this.supabase
          .from('staff_purchases')
          .insert(p2)
          .select('*')
          .single();
        if (e2) throw e2;
        return { ...(d2 as any), staffId: (d2 as any).staffId ?? (d2 as any).staff_id } as StaffPurchase;
      }
      // Fallback 2: paymentMethod/paymentNote columns don't exist yet
      if (error.message?.includes('paymentMethod') || error.message?.includes('paymentNote')) {
        delete payload.paymentMethod;
        delete payload.paymentNote;
        const { data: d2, error: e2 } = await this.supabase
          .from('staff_purchases')
          .insert(payload)
          .select('*')
          .single();
        if (e2) throw e2;
        return { ...(d2 as any), staffId: (d2 as any).staffId ?? (d2 as any).staff_id } as StaffPurchase;
      }
      throw error;
    }

    return { ...(data as any), staffId: (data as any).staffId ?? (data as any).staff_id } as StaffPurchase;
  }

  async updateDeductionStatus(
    id: string,
    deductionStatus: StaffPurchase['deductionStatus'],
    payslipId?: string,
    paymentMethod?: string
  ): Promise<StaffPurchase> {
    const updateData: Record<string, unknown> = {
      deductionStatus,
      deductedInPayslipId: payslipId ?? null,
      updatedAt: new Date().toISOString(),
    };
    if (paymentMethod) updateData.paymentMethod = paymentMethod;

    const { data, error } = await this.supabase
      .from('staff_purchases')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as StaffPurchase;
  }
}

// ---------------------------------------------------------------------------
// Salary Records
// ---------------------------------------------------------------------------

export class StaffSalaryRepository {
  private supabase = (new StaffRepository() as any).supabase;

  async findByStaff(staffId: string): Promise<StaffSalaryRecord[]> {
    let { data, error } = await this.supabase
      .from('staff_salary_records')
      .select('*')
      .eq('staffId', staffId)
      .order('salaryYear', { ascending: false })
      .order('salaryMonth', { ascending: false });

    if (error && (error.message?.includes('staffId') || error.code === '42703')) {
      ({ data, error } = await this.supabase
        .from('staff_salary_records')
        .select('*')
        .eq('staff_id', staffId)
        .order('salaryYear', { ascending: false })
        .order('salaryMonth', { ascending: false }));
    }
    if (error) throw error;
    return ((data || []) as any[]).map(r => ({
      ...r, staffId: r.staffId ?? r.staff_id,
    })) as StaffSalaryRecord[];
  }

  async findByPeriod(
    staffId: string,
    year: number,
    month: number
  ): Promise<StaffSalaryRecord | null> {
    let { data, error } = await this.supabase
      .from('staff_salary_records')
      .select('*')
      .eq('staffId', staffId)
      .eq('salaryYear', year)
      .eq('salaryMonth', month)
      .maybeSingle();

    if (error && (error.message?.includes('staffId') || error.code === '42703')) {
      ({ data, error } = await this.supabase
        .from('staff_salary_records')
        .select('*')
        .eq('staff_id', staffId)
        .eq('salaryYear', year)
        .eq('salaryMonth', month)
        .maybeSingle());
    }
    if (error) throw error;
    if (!data) return null;
    return { ...(data as any), staffId: (data as any).staffId ?? (data as any).staff_id } as StaffSalaryRecord;
  }

  async upsert(record: Omit<StaffSalaryRecord, 'id' | 'netPayable' | 'createdAt' | 'updatedAt'>): Promise<StaffSalaryRecord> {
    // Try camelCase upsert first; fall back to snake_case for legacy DB
    let { data, error } = await this.supabase
      .from('staff_salary_records')
      .upsert(record, { onConflict: 'staffId,salaryYear,salaryMonth' })
      .select('*')
      .single();

    if (error && (error.message?.includes('staffId') || error.code === '42703')) {
      const legacyRecord = { ...record, staff_id: record.staffId } as any;
      delete legacyRecord.staffId;
      ({ data, error } = await this.supabase
        .from('staff_salary_records')
        .upsert(legacyRecord, { onConflict: 'staff_id,salaryYear,salaryMonth' })
        .select('*')
        .single());
    }
    if (error) throw error;
    return { ...(data as any), staffId: (data as any).staffId ?? (data as any).staff_id } as StaffSalaryRecord;
  }

  async findPayslips(staffId: string): Promise<StaffPayslip[]> {
    let { data, error } = await this.supabase
      .from('staff_payslips')
      .select('*')
      .eq('staffId', staffId)
      .order('generatedAt', { ascending: false });

    if (error && (error.message?.includes('staffId') || error.code === '42703')) {
      ({ data, error } = await this.supabase
        .from('staff_payslips')
        .select('*')
        .eq('staff_id', staffId)
        .order('generatedAt', { ascending: false }));
    }
    if (error) throw error;
    return ((data || []) as any[]).map(r => ({
      ...r, staffId: r.staffId ?? r.staff_id,
    })) as StaffPayslip[];
  }

  async createPayslip(
    staffId: string,
    salaryRecordId: string,
    generatedByUserId?: string
  ): Promise<StaffPayslip> {
    const record = await this.findById(salaryRecordId);
    if (!record) throw new Error('Salary record not found');

    // Count existing payslips — try camelCase then snake_case
    let { count } = await this.supabase
      .from('staff_payslips')
      .select('*', { count: 'exact', head: true })
      .eq('staffId', staffId);
    if (count === null) {
      const res = await this.supabase
        .from('staff_payslips')
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', staffId);
      count = res.count;
    }

    const seq = String((count || 0) + 1).padStart(3, '0');
    const payslipNumber = `PSL-${(record as any).salaryYear}-${String((record as any).salaryMonth).padStart(2, '0')}-${seq}`;

    // Insert — try camelCase then snake_case
    let { data, error } = await this.supabase
      .from('staff_payslips')
      .insert({ staffId, salaryRecordId, payslipNumber, generatedByUserId })
      .select('*')
      .single();

    if (error && (error.message?.includes('staffId') || error.code === '42703')) {
      ({ data, error } = await this.supabase
        .from('staff_payslips')
        .insert({ staff_id: staffId, salaryRecordId, payslipNumber, generatedByUserId })
        .select('*')
        .single());
    }
    if (error) throw error;
    return { ...(data as any), staffId: (data as any).staffId ?? (data as any).staff_id } as StaffPayslip;
  }

  private async findById(id: string): Promise<StaffSalaryRecord | null> {
    const { data, error } = await this.supabase
      .from('staff_salary_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}

// ---------------------------------------------------------------------------
// Push Notifications
// ---------------------------------------------------------------------------

export class StaffNotificationRepository {
  private supabase = (new StaffRepository() as any).supabase;

  async findSubscriptionsByStaffIds(
    staffIds: string[]
  ): Promise<
    Array<{
      staffId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>
  > {
    if (staffIds.length === 0) return [];
    const { data, error } = await this.supabase
      .from('staff_push_subscriptions')
      .select('staffId, endpoint, p256dh, auth')
      .in('staffId', staffIds);
    if (error) throw error;
    return (data || []) as Array<{
      staffId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>;
  }

  async getStaffIdsWithSubscriptions(): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('staff_push_subscriptions')
      .select('staffId');
    if (error) throw error;
    return new Set((data || []).map((r: { staffId: string }) => r.staffId));
  }

  async deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
    const { error } = await this.supabase
      .from('staff_push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);
    if (error) throw error;
  }

  async createNotificationLog(input: {
    title: string;
    body: string;
    recipientMode: string;
    sentByUserId?: string;
  }): Promise<string> {
    const row: Record<string, unknown> = {
      title: input.title,
      body: input.body,
      recipientMode: input.recipientMode,
    };
    if (input.sentByUserId) row.sentByUserId = input.sentByUserId;

    const { data, error } = await this.supabase
      .from('staff_notifications')
      .insert(row)
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async insertRecipients(
    notificationId: string,
    rows: Array<{
      staffId: string;
      status: string;
      errorMessage?: string | null;
    }>
  ): Promise<void> {
    if (rows.length === 0) return;
    const payload = rows.map((r) => ({
      notificationId,
      staffId: r.staffId,
      status: r.status,
      errorMessage: r.errorMessage ?? null,
    }));
    const { error } = await this.supabase
      .from('staff_notification_recipients')
      .insert(payload);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Singleton exports
// ---------------------------------------------------------------------------

export const staffRepository          = new StaffRepository();
export const staffAttendanceRepository = new StaffAttendanceRepository();
export const staffTaskRepository       = new StaffTaskRepository();
export const staffPurchaseRepository   = new StaffPurchaseRepository();
export const staffSalaryRepository     = new StaffSalaryRepository();
export const staffNotificationRepository = new StaffNotificationRepository();
