import {
  staffRepository,
  staffAttendanceRepository,
  staffTaskRepository,
  staffPurchaseRepository,
  staffSalaryRepository,
  staffNotificationRepository,
} from '../repositories/StaffRepository';
import {
  StaffMember,
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
  SendStaffNotificationInput,
  SendStaffNotificationResult,
} from '../types';
import logger from '../utils/logger';
import webpush from 'web-push';

export class StaffService {
  // ── Staff directory ────────────────────────────────────────────────────────

  async getStaffList(
    params: PaginationParams
  ): Promise<PaginatedResponse<StaffMember>> {
    try {
      return await staffRepository.findAllWithPagination(params);
    } catch (error) {
      logger.error('StaffService.getStaffList error:', error);
      throw new Error('Failed to fetch staff list');
    }
  }

  async getStaffById(id: string): Promise<StaffMember | null> {
    try {
      return await staffRepository.findById(id);
    } catch (error) {
      logger.error('StaffService.getStaffById error:', error);
      throw new Error('Failed to fetch staff member');
    }
  }

  async createStaff(input: CreateStaffInput): Promise<StaffMember> {
    try {
      return await staffRepository.createWithRelations(input);
    } catch (error) {
      logger.error('StaffService.createStaff error:', error);
      throw new Error('Failed to create staff member');
    }
  }

  async updateStaff(id: string, data: UpdateStaffInput): Promise<StaffMember> {
    try {
      return await staffRepository.updateStaff(id, data);
    } catch (error) {
      logger.error('StaffService.updateStaff error:', error);
      throw new Error('Failed to update staff member');
    }
  }

  async deleteStaff(id: string): Promise<void> {
    try {
      await staffRepository.deleteStaff(id);
    } catch (error) {
      logger.error('StaffService.deleteStaff error:', error);
      throw new Error('Failed to delete staff member');
    }
  }

  async getDirectoryStats(): Promise<StaffDirectoryStats> {
    try {
      return await staffRepository.getDirectoryStats();
    } catch (error) {
      logger.error('StaffService.getDirectoryStats error:', error);
      throw new Error('Failed to fetch staff directory stats');
    }
  }

  async getPresentToday(): Promise<StaffMember[]> {
    try {
      return await staffRepository.getPresentToday();
    } catch (error) {
      logger.error('StaffService.getPresentToday error:', error);
      throw new Error('Failed to fetch present staff');
    }
  }

  async getOnLeave(): Promise<StaffMember[]> {
    try {
      return await staffRepository.getOnLeave();
    } catch (error) {
      logger.error('StaffService.getOnLeave error:', error);
      throw new Error('Failed to fetch on-leave staff');
    }
  }

  async getAllPendingTasks(): Promise<any[]> {
    try {
      return await staffRepository.getAllPendingTasks();
    } catch (error) {
      logger.error('StaffService.getAllPendingTasks error:', error);
      throw new Error('Failed to fetch pending tasks');
    }
  }

  // ── Attendance ─────────────────────────────────────────────────────────────

  async getAttendanceForMonth(
    staffId: string,
    year: number,
    month: number
  ): Promise<StaffAttendanceRecord[]> {
    try {
      return await staffAttendanceRepository.findByStaffAndMonth(staffId, year, month);
    } catch (error) {
      logger.error('StaffService.getAttendanceForMonth error:', error);
      throw new Error('Failed to fetch attendance records');
    }
  }

  async recordAttendance(input: CreateAttendanceInput): Promise<StaffAttendanceRecord> {
    try {
      return await staffAttendanceRepository.upsert(input);
    } catch (error) {
      logger.error('StaffService.recordAttendance error:', error);
      throw new Error('Failed to record attendance');
    }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async getTasksForStaff(staffId: string): Promise<StaffTask[]> {
    try {
      return await staffTaskRepository.findByStaff(staffId);
    } catch (error) {
      logger.error('StaffService.getTasksForStaff error:', error);
      throw new Error('Failed to fetch staff tasks');
    }
  }

  async createTask(input: CreateTaskInput): Promise<StaffTask> {
    try {
      return await staffTaskRepository.create(input);
    } catch (error) {
      logger.error('StaffService.createTask error:', error);
      throw new Error('Failed to create task');
    }
  }

  async updateTaskStatus(
    taskId: string,
    status: StaffTask['status']
  ): Promise<StaffTask> {
    try {
      return await staffTaskRepository.updateStatus(taskId, status);
    } catch (error) {
      logger.error('StaffService.updateTaskStatus error:', error);
      throw new Error('Failed to update task status');
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      await staffTaskRepository.softDelete(taskId);
    } catch (error) {
      logger.error('StaffService.deleteTask error:', error);
      throw new Error('Failed to delete task');
    }
  }

  // ── Purchases ──────────────────────────────────────────────────────────────

  async getPurchasesForStaff(
    staffId: string,
    params?: { month?: number; year?: number }
  ): Promise<StaffPurchase[]> {
    try {
      return await staffPurchaseRepository.findByStaff(staffId, params);
    } catch (error) {
      logger.error('StaffService.getPurchasesForStaff error:', error);
      throw new Error('Failed to fetch staff purchases');
    }
  }

  async recordPurchase(input: CreateStaffPurchaseInput): Promise<StaffPurchase> {
    try {
      return await staffPurchaseRepository.create(input);
    } catch (error) {
      logger.error('StaffService.recordPurchase error:', error);
      throw new Error('Failed to record staff purchase');
    }
  }

  async updatePurchaseStatus(
    purchaseId: string,
    status: StaffPurchase['deductionStatus'],
    paymentMethod?: string
  ): Promise<StaffPurchase> {
    try {
      return await staffPurchaseRepository.updateDeductionStatus(purchaseId, status, undefined, paymentMethod);
    } catch (error) {
      logger.error('StaffService.updatePurchaseStatus error:', error);
      throw new Error('Failed to update purchase status');
    }
  }

  // ── Salary ─────────────────────────────────────────────────────────────────

  async getSalaryHistory(staffId: string): Promise<StaffSalaryRecord[]> {
    try {
      return await staffSalaryRepository.findByStaff(staffId);
    } catch (error) {
      logger.error('StaffService.getSalaryHistory error:', error);
      throw new Error('Failed to fetch salary history');
    }
  }

  async getSalaryForPeriod(
    staffId: string,
    year: number,
    month: number
  ): Promise<StaffSalaryRecord | null> {
    try {
      return await staffSalaryRepository.findByPeriod(staffId, year, month);
    } catch (error) {
      logger.error('StaffService.getSalaryForPeriod error:', error);
      throw new Error('Failed to fetch salary record');
    }
  }

  /**
   * Compute and save the salary record for a given month.
   * Automatically sums all "Pending" purchase deductions for the period.
   */
  async processSalary(
    staffId: string,
    year: number,
    month: number,
    bonusAmount = 0,
    otherDeductions = 0,
    notes?: string
  ): Promise<StaffSalaryRecord> {
    try {
      const staff = await staffRepository.findById(staffId);
      if (!staff) throw new Error('Staff member not found');

      // Sum ONLY salary-deduction purchases for the period
      // (Cash / eSewa / Other are marked "Paid" and excluded from salary)
      const purchases = await staffPurchaseRepository.findByStaff(staffId, { year, month });
      const purchaseDeductions = purchases
        .filter((p) =>
          p.paymentMethod === 'Salary Deduction' &&
          (p.deductionStatus === 'Pending' || p.deductionStatus === 'Deducted')
        )
        .reduce((sum, p) => sum + p.amount, 0);

      return await staffSalaryRepository.upsert({
        staffId,
        salaryMonth: month,
        salaryYear: year,
        baseSalary: staff.baseSalary,
        bonusAmount,
        purchaseDeductions,
        otherDeductions,
        status: 'draft',
        notes,
      });
    } catch (error) {
      logger.error('StaffService.processSalary error:', error);
      throw new Error('Failed to process salary');
    }
  }

  async getPayslips(staffId: string): Promise<StaffPayslip[]> {
    try {
      return await staffSalaryRepository.findPayslips(staffId);
    } catch (error) {
      logger.error('StaffService.getPayslips error:', error);
      throw new Error('Failed to fetch payslips');
    }
  }

  async generatePayslip(
    staffId: string,
    salaryRecordId: string,
    generatedByUserId?: string
  ): Promise<StaffPayslip> {
    try {
      return await staffSalaryRepository.createPayslip(
        staffId,
        salaryRecordId,
        generatedByUserId
      );
    } catch (error) {
      logger.error('StaffService.generatePayslip error:', error);
      throw new Error('Failed to generate payslip');
    }
  }

  /** Staff IDs that currently have at least one push subscription */
  async getStaffIdsWithPush(): Promise<string[]> {
    const set = await staffNotificationRepository.getStaffIdsWithSubscriptions();
    return Array.from(set);
  }

  /**
   * Send a Web Push notification to all / selected staff.
   * Skips staff with no subscription; prunes 410 Gone endpoints.
   */
  async sendNotification(
    input: SendStaffNotificationInput
  ): Promise<SendStaffNotificationResult> {
    const title = input.title?.trim();
    const body = input.body?.trim();
    if (!title || !body) {
      throw new Error('Title and message are required');
    }

    let staffIds = input.staffIds ?? [];
    if (input.recipientMode === 'all') {
      const list = await staffRepository.findAllWithPagination({
        page: 1,
        limit: 500,
        search: '',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      staffIds = list.data.filter((s) => s.isActive).map((s) => s.id);
    }

    if (staffIds.length === 0) {
      throw new Error('No staff recipients selected');
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@stockflow.pro';
    if (!publicKey || !privateKey) {
      throw new Error('VAPID keys are not configured');
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const subscriptions =
      await staffNotificationRepository.findSubscriptionsByStaffIds(staffIds);

    const subsByStaff = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const arr = subsByStaff.get(sub.staffId) ?? [];
      arr.push(sub);
      subsByStaff.set(sub.staffId, arr);
    }

    const payload = JSON.stringify({
      title,
      body,
      url: '/staff/home',
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const recipientRows: Array<{
      staffId: string;
      status: string;
      errorMessage?: string | null;
    }> = [];

    for (const staffId of staffIds) {
      const subs = subsByStaff.get(staffId);
      if (!subs || subs.length === 0) {
        skipped += 1;
        recipientRows.push({
          staffId,
          status: 'skipped_no_subscription',
        });
        continue;
      }

      let anySent = false;
      let lastError: string | null = null;

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          anySent = true;
        } catch (err: any) {
          const statusCode = err?.statusCode;
          lastError = err?.body || err?.message || 'Push failed';
          if (statusCode === 404 || statusCode === 410) {
            try {
              await staffNotificationRepository.deleteSubscriptionByEndpoint(
                sub.endpoint
              );
            } catch (pruneErr) {
              logger.warn('Failed to prune dead push endpoint', pruneErr);
            }
          }
        }
      }

      if (anySent) {
        sent += 1;
        recipientRows.push({ staffId, status: 'sent' });
      } else {
        failed += 1;
        recipientRows.push({
          staffId,
          status: 'failed',
          errorMessage: lastError,
        });
      }
    }

    const notificationId =
      await staffNotificationRepository.createNotificationLog({
        title,
        body,
        recipientMode: input.recipientMode,
        sentByUserId: input.sentByUserId,
      });
    await staffNotificationRepository.insertRecipients(
      notificationId,
      recipientRows
    );

    return { notificationId, sent, skipped, failed };
  }
}

export default new StaffService();
