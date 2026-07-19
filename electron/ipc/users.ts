import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';
import bcrypt from 'bcryptjs';

export const setupUserHandlers = () => {
  // users:getAll
  ipcMain.handle('users:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '' } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('users')
        .select('*, role:roles(id, name)', { count: 'exact' })
        .is('deletedAt', null);

      if (search) {
        query = query.or(
          `firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      const { data: users, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        success: true,
        data: {
          data: users,
          pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        },
      };
    } catch (error) {
      logger.error('Get users handler error:', error);
      return { success: false, error: 'Failed to fetch users' };
    }
  });

  // users:create
  ipcMain.handle('users:create', async (_event, data: any) => {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      // Separate password from the rest to avoid sending plaintext
      const { password: _pw, ...rest } = data;
      const { data: user, error } = await supabase
        .from('users')
        .insert({ ...rest, password: hashedPassword })
        .select('id, firstName, lastName, email, phone, isActive, createdAt, role:roles(id, name)')
        .single();

      if (error) throw error;
      return { success: true, data: user };
    } catch (error) {
      logger.error('Create user handler error:', error);
      const msg = error instanceof Error && error.message.includes('duplicate key')
        ? 'Email already exists'
        : 'Failed to create user';
      return { success: false, error: msg };
    }
  });

  // staff:createUserAccount — creates or re-creates a Supabase Auth account for a
  // staff member, inserts into staff_details, updates profiles.role = 'staff',
  // then links the Auth UUID back via staff.portalUserId. Safe to call multiple times.
  // Requires a real email — username@staff.local fallback has been removed.
  ipcMain.handle('staff:createUserAccount', async (_event, params: {
    staffId: string;
    password: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => {
    try {
      const { staffId, password, email, firstName, lastName, phone } = params;

      // Email is required — no synthetic fallback
      if (!email || !email.trim()) {
        return { success: false, error: 'An email address is required to create a portal login account.' };
      }
      const resolvedEmail = email.trim();

      console.log('=== staff:createUserAccount START ===');
      console.log('  staffId:', staffId);
      console.log('  resolvedEmail:', resolvedEmail);

      let authUserId: string;

      // ── Step 1: Create or update Supabase Auth user ────────────────────────
      // Strategy: try createUser first; if email_exists, query auth.users directly
      // via raw RPC since there's no getUserByEmail admin method in this SDK version.
      console.log('[staff:createUserAccount] STEP 1 — attempting createUser for:', resolvedEmail);
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email:         resolvedEmail,
        password,
        email_confirm: true,
        user_metadata: { firstName, lastName },
      });

      if (authErr) {
        if ((authErr as any).code === 'email_exists' || authErr.message?.includes('already been registered')) {
          console.log('[staff:createUserAccount] STEP 1 — email_exists; querying auth.users directly...');

          // Direct query to auth.users via the service role client
          // This bypasses the pagination limitation of listUsers()
          const { data: authUserRows, error: queryErr } = await supabase
            .rpc('get_auth_user_id_by_email', { p_email: resolvedEmail })
            .maybeSingle() as any;

          let foundUserId: string | null = null;

          if (queryErr || !authUserRows) {
            // RPC doesn't exist — fall back to raw SQL via .from on the auth schema
            console.log('[staff:createUserAccount] STEP 1 — RPC not found, trying direct auth.users query...');
            const { data: rawRows, error: rawErr } = await supabase
              .schema('auth' as any)
              .from('users')
              .select('id')
              .eq('email', resolvedEmail)
              .maybeSingle();

            if (rawErr) {
              console.error('[staff:createUserAccount] STEP 1 — direct auth.users query also failed:', rawErr.message);
              // Last resort: paginate listUsers with a large page size
              let page = 1;
              while (!foundUserId) {
                const { data: pageData, error: pageErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
                if (pageErr || !pageData?.users?.length) break;
                const match = pageData.users.find((u: any) => u.email === resolvedEmail);
                if (match) { foundUserId = match.id; break; }
                if (pageData.users.length < 1000) break;
                page++;
              }
            } else if (rawRows) {
              foundUserId = (rawRows as any).id;
            }
          } else {
            foundUserId = authUserRows;
          }

          if (!foundUserId) {
            console.error('[staff:createUserAccount] STEP 1 ERROR — cannot locate Auth user for:', resolvedEmail);
            throw new Error(`Auth user exists for ${resolvedEmail} but could not be located. Check Supabase Auth dashboard.`);
          }

          console.log('[staff:createUserAccount] STEP 1 — found existing user:', foundUserId, '— updating password');
          const { error: upErr } = await supabase.auth.admin.updateUserById(foundUserId, { password, email_confirm: true });
          if (upErr) { console.error('[staff:createUserAccount] STEP 1 ERROR — updateUserById:', JSON.stringify(upErr)); throw upErr; }
          authUserId = foundUserId;
          console.log('[staff:createUserAccount] STEP 1 OK — updated existing Auth user:', authUserId);
        } else {
          console.error('[staff:createUserAccount] STEP 1 ERROR — createUser failed:', JSON.stringify(authErr));
          throw authErr;
        }
      } else {
        authUserId = authData.user.id;
        console.log('[staff:createUserAccount] STEP 1 OK — created new Auth user:', authUserId);
      }

      // ── Step 2: Upsert profiles row with confirmed real schema ───────────────
      // Real columns: id, email, full_name, phone, avatar_url, role, created_at, updated_at
      // No username column. Do NOT touch created_at/updated_at (let Supabase manage).
      console.log(`[staff:createUserAccount] STEP 2 — upserting profiles for authUserId=${authUserId}`);
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id:        authUserId,
            email:     resolvedEmail,
            full_name: `${firstName} ${lastName}`.trim(),
            role:      'staff',
          },
          { onConflict: 'id' }
        )
        .select();

      if (profileErr) {
        console.error('[staff:createUserAccount] STEP 2 ERROR — profiles upsert failed:');
        console.error('  message:', profileErr.message);
        console.error('  code:', (profileErr as any).code);
        console.error('  details:', (profileErr as any).details);
        console.error('  hint:', (profileErr as any).hint);
        console.error('  full error:', JSON.stringify(profileErr, null, 2));
        logger.warn(`staff:createUserAccount — profiles upsert warning: ${profileErr.message}`);
      } else {
        console.log('[staff:createUserAccount] STEP 2 OK — profiles upsert succeeded:', JSON.stringify(profileData));
      }

      // ── Step 3: Upsert staff_details row with confirmed real schema ──────────
      // Real columns: id, username, position, department, hire_date,
      //               base_salary, is_active, created_at, updated_at
      // id = same Supabase Auth UUID as profiles.id (no staff_id column)
      console.log(`[staff:createUserAccount] STEP 3 — fetching staff HR record to build staff_details payload`);

      // Fetch the HR record to get jobTitle, branch, joiningDate, baseSalary, isActive
      const { data: staffRecord } = await supabase
        .from('staff')
        .select('jobTitle, branch, joiningDate, baseSalary, isActive')
        .eq('id', staffId)
        .maybeSingle();

      const detailsPayload: Record<string, unknown> = {
        id:          authUserId,           // Supabase Auth UUID — primary key
        // username column intentionally omitted — email-only login, username removed
        position:    staffRecord?.jobTitle   ?? null,
        department:  staffRecord?.branch     ?? null,
        hire_date:   staffRecord?.joiningDate ?? null,
        base_salary: staffRecord?.baseSalary  ?? null,
        is_active:   staffRecord?.isActive    ?? true,
      };

      console.log(`[staff:createUserAccount] STEP 3 — upserting staff_details:`, JSON.stringify(detailsPayload));
      const { data: detailsData, error: detailsErr } = await supabase
        .from('staff_details')
        .upsert(detailsPayload, { onConflict: 'id' })
        .select();

      if (detailsErr) {
        console.error('[staff:createUserAccount] STEP 3 ERROR — staff_details upsert failed:');
        console.error('  message:', detailsErr.message);
        console.error('  code:', (detailsErr as any).code);
        console.error('  details:', (detailsErr as any).details);
        console.error('  hint:', (detailsErr as any).hint);
        logger.warn(`staff:createUserAccount — staff_details upsert failed: ${detailsErr.message}`);
      } else {
        console.log('[staff:createUserAccount] STEP 3 OK — staff_details upsert succeeded:', JSON.stringify(detailsData));
      }

      // ── Step 4: Maintain custom users table (for POS bcrypt desktop login) ─
      const { data: existingCustomUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', resolvedEmail)
        .maybeSingle();

      if (existingCustomUser?.id) {
        const hashed = await bcrypt.hash(password, 10);
        await supabase
          .from('users')
          .update({ password: hashed, isActive: true, updatedAt: new Date().toISOString() })
          .eq('id', existingCustomUser.id);
      } else {
        const { data: roles } = await supabase
          .from('roles')
          .select('id, name')
          .is('deletedAt', null);
        const staffRole = (roles ?? []).find(
          (r: any) => r.name.toLowerCase() === 'staff' || r.name.toLowerCase() === 'cashier'
        );
        const hashed = await bcrypt.hash(password, 10);
        await supabase
          .from('users')
          .insert({
            email:     resolvedEmail,
            firstName,
            lastName,
            phone:     phone ?? null,
            password:  hashed,
            roleId:    staffRole?.id ?? null,
            isActive:  true,
          })
          .select('id')
          .maybeSingle();
      }

      // ── Step 5: Write authUserId into staff.portalUserId (no FK) ──────────
      // portalUserId is a nullable UUID with NO FK constraint — safe to store
      // the Supabase Auth UUID without violating any DB constraint.
      // (staff.userId is reserved for the POS local bcrypt users table FK only)
      console.log(`[staff:createUserAccount] STEP 5 — writing portalUserId=${authUserId} to staffId=${staffId}`);
      const { error: portalLinkErr } = await supabase
        .from('staff')
        .update({ portalUserId: authUserId })
        .eq('id', staffId);

      if (portalLinkErr) {
        // Non-fatal: portalUserId migration may not have run yet
        console.error('[staff:createUserAccount] STEP 5 ERROR — portalUserId write failed (run migration?):', portalLinkErr.message);
        logger.warn(`staff:createUserAccount — portalUserId write failed: ${portalLinkErr.message}`);
      } else {
        console.log('[staff:createUserAccount] STEP 5 OK — portalUserId saved');
      }

      console.log('=== staff:createUserAccount COMPLETE ===');
      console.log('  staffId:', staffId, '→ Supabase Auth UUID:', authUserId);
      logger.info(`staff:createUserAccount — complete. staffId=${staffId}, authUserId=${authUserId}`);
      return { success: true, data: { authUserId, email: resolvedEmail } };
    } catch (error) {
      logger.error('staff:createUserAccount error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to create staff account';
      return { success: false, error: msg };
    }
  });

  // users:update
  ipcMain.handle('users:update', async (_event, id: string, data: any) => {
    try {
      const updateData: any = { ...data };
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      } else {
        delete updateData.password;
      }

      const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select('id, firstName, lastName, email, phone, isActive, createdAt, role:roles(id, name)')
        .single();

      if (error) throw error;
      return { success: true, data: user };
    } catch (error) {
      logger.error('Update user handler error:', error);
      return { success: false, error: 'Failed to update user' };
    }
  });

  // users:delete (soft delete)
  ipcMain.handle('users:delete', async (_event, id: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ deletedAt: new Date().toISOString(), isActive: false })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Delete user handler error:', error);
      return { success: false, error: 'Failed to delete user' };
    }
  });

  // staff:inspectSchema — one-time diagnostic: reports real column names for
  // profiles, staff_details, and staff tables directly from Supabase
  ipcMain.handle('staff:inspectSchema', async () => {
    const results: Record<string, any> = {};
    const tables = ['profiles', 'staff_details', 'staff'];

    for (const table of tables) {
      // Try a real row first (fastest way to see real columns)
      const { data: sampleRow, error: sampleErr } = await supabase
        .from(table)
        .select('*')
        .limit(1)
        .maybeSingle();

      // Also query information_schema for definitive column list
      const { data: colData, error: colErr } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .order('ordinal_position');

      results[table] = {
        sampleRow:    sampleErr  ? { error: sampleErr.message, code: (sampleErr as any).code }  : sampleRow,
        columns:      colErr     ? { error: colErr.message,    code: (colErr as any).code }      : colData,
      };

      console.log(`\n=== SCHEMA: ${table} ===`);
      if (colErr) {
        console.log('  columns query error:', colErr.message);
      } else {
        console.log('  columns:', JSON.stringify(colData?.map((c: any) => `${c.column_name} (${c.data_type}${c.is_nullable === 'NO' ? ', NOT NULL' : ''})`), null, 2));
      }
      if (sampleErr) {
        console.log('  sample row error:', sampleErr.message, '| code:', (sampleErr as any).code);
      } else {
        console.log('  sample row keys:', sampleRow ? Object.keys(sampleRow) : 'table empty');
        console.log('  sample row:', JSON.stringify(sampleRow));
      }
    }

    return { success: true, data: results };
  });

  // roles:getAll
  ipcMain.handle('roles:getAll', async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .is('deletedAt', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get roles handler error:', error);
      return { success: false, error: 'Failed to fetch roles' };
    }
  });
};
