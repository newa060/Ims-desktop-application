import { ipcMain } from 'electron';
import StaffService from '../../src/services/StaffService';
import logger from '../../src/utils/logger';
import supabase from '../../src/database/supabaseClient';

/**
 * All Staff Management IPC handlers.
 * Channel naming convention: "staff:<action>" — no existing channel uses this prefix.
 */
export const setupStaffHandlers = () => {

  // ── Staff Directory ────────────────────────────────────────────────────────

  /** Paginated staff list with optional search */
  ipcMain.handle('staff:getAll', async (_event, params: any = {}) => {
    try {
      const result = await StaffService.getStaffList({
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        search: params.search ?? '',
        sortBy: params.sortBy ?? 'createdAt',
        sortOrder: params.sortOrder ?? 'desc',
      });
      return { success: true, data: result };
    } catch (error) {
      logger.error('staff:getAll error:', error);
      return { success: false, error: 'Failed to fetch staff list' };
    }
  });

  /** Full staff profile by ID (includes identity doc + emergency contact) */
  ipcMain.handle('staff:getById', async (_event, id: string) => {
    try {
      const staff = await StaffService.getStaffById(id);
      if (!staff) return { success: false, error: 'Staff member not found' };
      return { success: true, data: staff };
    } catch (error) {
      logger.error('staff:getById error:', error);
      return { success: false, error: 'Failed to fetch staff member' };
    }
  });

  /** Summary stat cards for the Staff Management directory page */
  ipcMain.handle('staff:getStats', async () => {
    try {
      const stats = await StaffService.getDirectoryStats();
      return { success: true, data: stats };
    } catch (error) {
      logger.error('staff:getStats error:', error);
      return { success: false, error: 'Failed to fetch staff stats' };
    }
  });

  /** Staff currently marked Present today */
  ipcMain.handle('staff:getPresentToday', async () => {
    try {
      const staff = await StaffService.getPresentToday();
      return { success: true, data: staff };
    } catch (error) {
      logger.error('staff:getPresentToday error:', error);
      return { success: false, error: 'Failed to fetch present staff' };
    }
  });

  /** Staff currently marked On Leave */
  ipcMain.handle('staff:getOnLeave', async () => {
    try {
      const staff = await StaffService.getOnLeave();
      return { success: true, data: staff };
    } catch (error) {
      logger.error('staff:getOnLeave error:', error);
      return { success: false, error: 'Failed to fetch on-leave staff' };
    }
  });

  /** All pending/in-progress tasks across all staff */
  ipcMain.handle('staff:getAllPendingTasks', async () => {
    try {
      const tasks = await StaffService.getAllPendingTasks();
      return { success: true, data: tasks };
    } catch (error) {
      logger.error('staff:getAllPendingTasks error:', error);
      return { success: false, error: 'Failed to fetch pending tasks' };
    }
  });

  /** Create a new staff member (with identity doc + emergency contact) */
  ipcMain.handle('staff:create', async (_event, data: any) => {
    try {
      const staff = await StaffService.createStaff(data);
      return { success: true, data: staff };
    } catch (error) {
      logger.error('staff:create error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to create staff member';
      return { success: false, error: msg };
    }
  });

  /** Update an existing staff member */
  ipcMain.handle('staff:update', async (_event, id: string, data: any) => {
    try {
      const staff = await StaffService.updateStaff(id, data);
      return { success: true, data: staff };
    } catch (error) {
      logger.error('staff:update error:', error);
      return { success: false, error: 'Failed to update staff member' };
    }
  });

  /** Soft-delete a staff member */
  ipcMain.handle('staff:delete', async (_event, id: string) => {
    try {
      await StaffService.deleteStaff(id);
      return { success: true };
    } catch (error) {
      logger.error('staff:delete error:', error);
      return { success: false, error: 'Failed to delete staff member' };
    }
  });

  /**
   * Hard-delete a staff member and ALL related data, including their Supabase
   * Auth portal account if one exists.  Each step is non-fatal so a missing
   * row in one table never blocks the rest of the cleanup.
   */
  ipcMain.handle('staff:hardDelete', async (_event, staffId: string, portalUserId?: string) => {
    try {
      // ── 1. Remove portal account rows ──────────────────────────────────────
      if (portalUserId) {
        const { error: sdErr } = await supabase
          .from('staff_details')
          .delete()
          .eq('id', portalUserId);
        if (sdErr) logger.warn(`staff:hardDelete — staff_details: ${sdErr.message}`);

        const { error: profErr } = await supabase
          .from('profiles')
          .delete()
          .eq('id', portalUserId);
        if (profErr) logger.warn(`staff:hardDelete — profiles: ${profErr.message}`);

        const { error: authErr } = await supabase.auth.admin.deleteUser(portalUserId);
        if (authErr) logger.warn(`staff:hardDelete — Auth user: ${authErr.message}`);
      }

      // ── 2. Delete related HR data ──────────────────────────────────────────
      // staff_identity_documents and staff_emergency_contacts use camelCase "staffId"
      // staff_attendance / staff_tasks / staff_purchases / staff_salary_records
      // were created with snake_case staff_id — try both, log non-fatal errors
      const relatedTables: [string, string][] = [
        ['staff_identity_documents', 'staffId'],
        ['staff_emergency_contacts', 'staffId'],
        ['staff_attendance',         'staffId'],
        ['staff_tasks',              'staffId'],
        ['staff_purchases',          'staffId'],
        ['staff_salary_records',     'staffId'],
      ];

      for (const [table, col] of relatedTables) {
        const { error } = await supabase.from(table).delete().eq(col, staffId);
        if (error) logger.warn(`staff:hardDelete — ${table} (${col}): ${error.message}`);
      }

      // ── 3. Delete payslips (FK on salary_records, may already be gone) ─────
      const { error: psErr } = await supabase
        .from('staff_payslips')
        .delete()
        .eq('staffId', staffId);
      if (psErr) logger.warn(`staff:hardDelete — staff_payslips: ${psErr.message}`);

      // ── 4. Delete the staff HR record itself (must succeed) ────────────────
      const { error: staffErr } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffId);
      if (staffErr) throw staffErr;

      logger.info(`staff:hardDelete — complete for staffId=${staffId}`);
      return { success: true };
    } catch (error) {
      logger.error('staff:hardDelete error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to delete staff member';
      return { success: false, error: msg };
    }
  });

  // ── Attendance ─────────────────────────────────────────────────────────────

  /** Get all attendance records for a staff member for a given month */
  ipcMain.handle(
    'staff:getAttendance',
    async (_event, staffId: string, year: number, month: number) => {
      try {
        const records = await StaffService.getAttendanceForMonth(staffId, year, month);
        return { success: true, data: records };
      } catch (error) {
        logger.error('staff:getAttendance error:', error);
        return { success: false, error: 'Failed to fetch attendance records' };
      }
    }
  );

  /** Insert or update an attendance record (upsert by staffId + date) */
  ipcMain.handle('staff:recordAttendance', async (_event, data: any) => {
    try {
      const record = await StaffService.recordAttendance(data);
      return { success: true, data: record };
    } catch (error) {
      logger.error('staff:recordAttendance error:', error);
      return { success: false, error: 'Failed to record attendance' };
    }
  });

  // ── Tasks ──────────────────────────────────────────────────────────────────

  /** Get all tasks assigned to a staff member */
  ipcMain.handle('staff:getTasks', async (_event, staffId: string) => {
    try {
      const tasks = await StaffService.getTasksForStaff(staffId);
      return { success: true, data: tasks };
    } catch (error) {
      logger.error('staff:getTasks error:', error);
      return { success: false, error: 'Failed to fetch tasks' };
    }
  });

  /** Assign a new task to a staff member */
  ipcMain.handle('staff:createTask', async (_event, data: any) => {
    try {
      const task = await StaffService.createTask(data);
      return { success: true, data: task };
    } catch (error) {
      logger.error('staff:createTask error:', error);
      return { success: false, error: 'Failed to create task' };
    }
  });

  /** Update a task's status (pending → in-progress → completed) */
  ipcMain.handle(
    'staff:updateTaskStatus',
    async (_event, taskId: string, status: string) => {
      try {
        const task = await StaffService.updateTaskStatus(taskId, status as any);
        return { success: true, data: task };
      } catch (error) {
        logger.error('staff:updateTaskStatus error:', error);
        return { success: false, error: 'Failed to update task' };
      }
    }
  );

  /** Soft-delete a task */
  ipcMain.handle('staff:deleteTask', async (_event, taskId: string) => {
    try {
      await StaffService.deleteTask(taskId);
      return { success: true };
    } catch (error) {
      logger.error('staff:deleteTask error:', error);
      return { success: false, error: 'Failed to delete task' };
    }
  });

  // ── Purchases ──────────────────────────────────────────────────────────────

  /** Get purchases for a staff member; optional month/year filter */
  ipcMain.handle(
    'staff:getPurchases',
    async (_event, staffId: string, params: any = {}) => {
      try {
        const purchases = await StaffService.getPurchasesForStaff(staffId, params);
        return { success: true, data: purchases };
      } catch (error) {
        logger.error('staff:getPurchases error:', error);
        return { success: false, error: 'Failed to fetch purchases' };
      }
    }
  );

  /** Record a new staff purchase */
  ipcMain.handle('staff:recordPurchase', async (_event, data: any) => {
    try {
      const purchase = await StaffService.recordPurchase(data);
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('staff:recordPurchase error:', error);
      return { success: false, error: 'Failed to record purchase' };
    }
  });

  /** Update purchase deduction status */
  ipcMain.handle('staff:updatePurchaseStatus', async (_event, purchaseId: string, status: string, paymentMethod?: string) => {
    try {
      const purchase = await StaffService.updatePurchaseStatus(purchaseId, status as any, paymentMethod);
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('staff:updatePurchaseStatus error:', error);
      return { success: false, error: 'Failed to update purchase status' };
    }
  });

  // ── Salary ─────────────────────────────────────────────────────────────────

  /** Get all salary records for a staff member */
  ipcMain.handle('staff:getSalaryHistory', async (_event, staffId: string) => {
    try {
      const records = await StaffService.getSalaryHistory(staffId);
      return { success: true, data: records };
    } catch (error) {
      logger.error('staff:getSalaryHistory error:', error);
      return { success: false, error: 'Failed to fetch salary history' };
    }
  });

  /** Get or compute salary for a specific month */
  ipcMain.handle(
    'staff:getSalaryForPeriod',
    async (_event, staffId: string, year: number, month: number) => {
      try {
        const record = await StaffService.getSalaryForPeriod(staffId, year, month);
        return { success: true, data: record };
      } catch (error) {
        logger.error('staff:getSalaryForPeriod error:', error);
        return { success: false, error: 'Failed to fetch salary for period' };
      }
    }
  );

  /**
   * Compute and save a salary record for the given period.
   * Automatically aggregates purchase deductions.
   */
  ipcMain.handle(
    'staff:processSalary',
    async (
      _event,
      staffId: string,
      year: number,
      month: number,
      bonusAmount = 0,
      otherDeductions = 0,
      notes?: string
    ) => {
      try {
        const record = await StaffService.processSalary(
          staffId, year, month, bonusAmount, otherDeductions, notes
        );
        return { success: true, data: record };
      } catch (error) {
        logger.error('staff:processSalary error:', error);
        return { success: false, error: 'Failed to process salary' };
      }
    }
  );

  /** Get payslip history for a staff member */
  ipcMain.handle('staff:getPayslips', async (_event, staffId: string) => {
    try {
      const payslips = await StaffService.getPayslips(staffId);
      return { success: true, data: payslips };
    } catch (error) {
      logger.error('staff:getPayslips error:', error);
      return { success: false, error: 'Failed to fetch payslips' };
    }
  });

  /** Generate and record a new payslip for a salary record */
  ipcMain.handle(
    'staff:generatePayslip',
    async (
      _event,
      staffId: string,
      salaryRecordId: string,
      generatedByUserId?: string
    ) => {
      try {
        const payslip = await StaffService.generatePayslip(
          staffId,
          salaryRecordId,
          generatedByUserId
        );
        return { success: true, data: payslip };
      } catch (error) {
        logger.error('staff:generatePayslip error:', error);
        return { success: false, error: 'Failed to generate payslip' };
      }
    }
  );

  /** Staff IDs that have at least one push subscription */
  ipcMain.handle('staff:getPushCapableIds', async () => {
    try {
      const ids = await StaffService.getStaffIdsWithPush();
      return { success: true, data: ids };
    } catch (error) {
      logger.error('staff:getPushCapableIds error:', error);
      return { success: false, error: 'Failed to load push subscriptions' };
    }
  });

  /** Send Web Push notification to all or selected staff */
  ipcMain.handle(
    'staff:sendNotification',
    async (
      _event,
      input: {
        title: string;
        body: string;
        recipientMode: 'all' | 'selected';
        staffIds?: string[];
        sentByUserId?: string;
      }
    ) => {
      try {
        const result = await StaffService.sendNotification(input);
        return { success: true, data: result };
      } catch (error: any) {
        logger.error('staff:sendNotification error:', error);
        return {
          success: false,
          error: error?.message || 'Failed to send notification',
        };
      }
    }
  );
};
