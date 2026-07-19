import { useRef, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Camera,
  Save,
  Eye,
  EyeOff,
  Upload,
  Clock,
  ShieldCheck,
  Loader2,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';

// ─── Field primitives ─────────────────────────────────────────────────────────

const Label = ({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="block text-[12.5px] font-semibold text-ink/60 mb-1.5 uppercase tracking-wide">
    {children}
    {required && <span className="text-danger-text ml-0.5">*</span>}
  </label>
);

interface FieldInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}
const FieldInput = ({ error, ...props }: FieldInputProps) => (
  <>
    <input
      {...props}
      className={`w-full h-10 px-3.5 rounded-[9px] border ${
        error ? 'border-danger-text/60 bg-danger-bg/30' : 'border-ink/[0.12] bg-white'
      } text-[13.5px] text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-olive/50 focus:border-transparent transition ${
        props.className ?? ''
      }`}
    />
    {error && <p className="mt-1 text-[11.5px] text-danger-text">{error}</p>}
  </>
);

interface FieldSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder: string;
  options: string[];
  error?: string;
}
const FieldSelect = ({
  placeholder,
  options,
  error,
  value,
  onChange,
  ...props
}: FieldSelectProps) => (
  <>
    <select
      {...props}
      value={value ?? ''}
      onChange={onChange}
      className={`w-full h-10 px-3.5 rounded-[9px] border ${
        error ? 'border-danger-text/60 bg-danger-bg/30' : 'border-ink/[0.12] bg-white'
      } text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-olive/50 focus:border-transparent transition appearance-none cursor-pointer`}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
    {error && <p className="mt-1 text-[11.5px] text-danger-text">{error}</p>}
  </>
);

const SectionCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <div className="bg-white border border-ink/[0.08] rounded-2xl p-7">
    <div className="mb-5">
      <h3 className="font-display font-bold text-[16px] text-ink">{title}</h3>
      {subtitle && <p className="text-[13px] text-ink/45 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ─── Upload zone (functional — stores selected file for Cloudinary upload) ────

interface UploadZoneProps {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Existing saved URL (edit mode) — shown as a preview when no new file is chosen */
  existingUrl?: string | null;
  /** Called when the admin explicitly clears the existing saved file */
  onClearExisting?: () => void;
  accept?: string;
}

const UploadZone = ({
  label,
  file,
  onFileChange,
  existingUrl,
  onClearExisting,
  accept = 'image/*,.pdf',
}: UploadZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Generate preview using FileReader (works reliably in Electron renderer)
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null); // PDF — no image preview
    }
  }, [file]);

  const isPdf = file?.type === 'application/pdf';
  const fileSizeKB = file ? Math.round(file.size / 1024) : 0;
  const fileSizeStr = fileSizeKB >= 1024
    ? `${(fileSizeKB / 1024).toFixed(1)} MB`
    : `${fileSizeKB} KB`;

  // Derive the filename from an existing URL for display
  const existingFileName = existingUrl
    ? decodeURIComponent(existingUrl.split('/').pop()?.split('?')[0] ?? 'Document')
    : null;

  return (
    <div>
      <Label>{label}</Label>

      {file ? (
        /* ── New file selected ───────────────────────────────── */
        <div className="rounded-[10px] border-2 border-olive/50 bg-olive/[0.04] overflow-hidden">
          {preview ? (
            <img src={preview} alt={file.name} className="w-full h-36 object-cover" />
          ) : (
            <div className="w-full h-36 flex flex-col items-center justify-center gap-2 bg-olive/[0.06]">
              <div className="w-10 h-10 rounded-lg bg-olive/20 flex items-center justify-center">
                <Upload size={18} strokeWidth={1.5} className="text-olive" />
              </div>
              <span className="text-[11.5px] font-semibold text-olive/80 uppercase tracking-wide">
                {isPdf ? 'PDF Document' : 'File Ready'}
              </span>
            </div>
          )}
          <div className="bg-ink/[0.92] px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-success-text flex-none" />
              <span className="text-[11.5px] text-paper/90 font-medium truncate">{file.name}</span>
              <span className="text-[10.5px] text-paper/45 flex-none">{fileSizeStr}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-none">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-[11px] font-semibold text-paper/65 hover:text-paper transition-colors underline underline-offset-2"
              >
                Change
              </button>
              <span className="text-paper/25">·</span>
              <button
                type="button"
                onClick={() => onFileChange(null)}
                className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>

      ) : existingUrl ? (
        /* ── Existing saved file (edit mode, no new file chosen yet) ── */
        <div className="rounded-[10px] border-2 border-ink/20 bg-ink/[0.02] overflow-hidden">
          {/* If the saved file looks like an image, show it; otherwise show a generic icon */}
          {/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(existingUrl) ? (
            <img
              src={existingUrl}
              alt={existingFileName ?? label}
              className="w-full h-36 object-cover"
              onError={(e) => {
                // If the URL is broken show the generic placeholder instead
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-36 flex flex-col items-center justify-center gap-2 bg-ink/[0.03]">
              <div className="w-10 h-10 rounded-lg bg-ink/10 flex items-center justify-center">
                <Upload size={18} strokeWidth={1.5} className="text-ink/40" />
              </div>
              <span className="text-[11.5px] font-semibold text-ink/50 uppercase tracking-wide">
                Document on file
              </span>
            </div>
          )}
          {/* Footer — "currently saved" indicator + replace / remove actions */}
          <div className="bg-ink/[0.07] px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-ink/40 flex-none" />
              <span className="text-[11.5px] text-ink/60 font-medium truncate">
                {existingFileName ?? 'Saved document'}
              </span>
              <span className="text-[10.5px] text-success-text font-semibold flex-none">On file</span>
            </div>
            <div className="flex items-center gap-2.5 flex-none">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-[11px] font-semibold text-ink/55 hover:text-ink transition-colors underline underline-offset-2"
              >
                Replace
              </button>
              {onClearExisting && (
                <>
                  <span className="text-ink/20">·</span>
                  <button
                    type="button"
                    onClick={onClearExisting}
                    className="text-[11px] font-semibold text-red-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

      ) : (
        /* ── Empty state ─────────────────────────────────────── */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onFileChange(f);
          }}
          className="w-full border-2 border-dashed border-ink/[0.15] hover:border-olive/60 rounded-[10px] py-8 flex flex-col items-center gap-2 transition-colors group bg-ink/[0.015] hover:bg-olive/[0.04]"
        >
          <Upload
            size={20}
            strokeWidth={1.5}
            className="text-ink/30 group-hover:text-olive/60 transition-colors"
          />
          <span className="text-[12.5px] font-semibold text-ink/50 group-hover:text-ink/70 transition-colors">
            Click or drag to upload
          </span>
          <span className="text-[11px] text-ink/30">PNG, JPG, PDF — max 5MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onFileChange(f);
          e.target.value = '';
        }}
      />
    </div>
  );
};

// ─── Form state type ──────────────────────────────────────────────────────────

interface FormState {
  // Basic Info
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  jobTitle: string;
  branch: string;
  employmentType: string;
  joiningDate: string;
  baseSalary: string;
  // Identity
  idType: string;
  idNumber: string;
  idExpiryDate: string;
  idVerificationStatus: string;
  // Emergency
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  // Credentials — email comes from form.email; only password is separate
  password: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL: FormState = {
  firstName: '', lastName: '', phone: '', email: '',
  jobTitle: '', branch: '', employmentType: 'Full-time',
  joiningDate: '', baseSalary: '',
  idType: '', idNumber: '', idExpiryDate: '', idVerificationStatus: 'Pending',
  emergencyContactName: '', emergencyContactRelationship: '', emergencyContactPhone: '',
  password: '',
};

// ─── Main component ───────────────────────────────────────────────────────────

const AddStaffPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = Boolean(id);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);   // only show errors after first submit attempt
  const [loading, setLoading] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  // Edit mode — existing Cloudinary URLs for photo and ID documents.
  // These are separate from the File states: a non-null existingUrl means a
  // saved file is on record; selecting a new File replaces it on save.
  const [existingPhotoUrl,    setExistingPhotoUrl]    = useState<string | null>(null);
  const [idFrontExistingUrl,  setIdFrontExistingUrl]  = useState<string | null>(null);
  const [idBackExistingUrl,   setIdBackExistingUrl]   = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit mode: existing credential display state
  const [existingLoginEmail, setExistingLoginEmail]   = useState<string | null>(null);
  const [changingCredentials, setChangingCredentials] = useState(false);
  const [showChangeWarning, setShowChangeWarning]     = useState(false);

  // ── Load staff data in edit mode ──────────────────────────────────────────
  useEffect(() => {
    const loadStaff = async () => {
      if (!isEditMode || !id) return;

      try {
        setLoading(true);
        const response = await window.electron.getStaffById(id);
        
        if (response.success && response.data) {
          const staff = response.data;

          // Capture existing linked login email for display
          // portalUserId is the Supabase Auth UUID for PWA login (not userId which is POS only)
          if (staff.portalUserId) {
            const linkedEmail = staff.email
              ? staff.email
              : `(portal account linked, id: ${staff.portalUserId.slice(0, 8)}...)`;
            setExistingLoginEmail(linkedEmail);
          } else if (staff.user?.email) {
            setExistingLoginEmail(staff.user.email);
          }

          // Supabase embedded joins can return a single-item array even for 1-to-1
          // relations — normalise to a plain object before reading fields.
          const identityDoc = Array.isArray(staff.identityDocument)
            ? (staff.identityDocument[0] ?? null)
            : (staff.identityDocument ?? null);

          const emergencyContact = Array.isArray(staff.emergencyContact)
            ? (staff.emergencyContact[0] ?? null)
            : (staff.emergencyContact ?? null);

          // Seed photo preview from the saved Cloudinary URL
          if (staff.photoUrl) {
            setPhotoPreview(staff.photoUrl);
            setExistingPhotoUrl(staff.photoUrl);
          }

          // Seed existing ID document URLs so the UploadZone shows "on file"
          if (identityDoc?.frontDocumentUrl) {
            setIdFrontExistingUrl(identityDoc.frontDocumentUrl);
          }
          if (identityDoc?.backDocumentUrl) {
            setIdBackExistingUrl(identityDoc.backDocumentUrl);
          }

          setForm({
            firstName: staff.firstName,
            lastName:  staff.lastName,
            phone:     staff.phone  || '',
            email:     staff.email  || '',
            jobTitle:  staff.jobTitle,
            branch:    staff.branch || '',
            employmentType: staff.employmentType,
            joiningDate:    staff.joiningDate || '',
            baseSalary:     staff.baseSalary.toString(),
            idType:               identityDoc?.idType              || '',
            idNumber:             identityDoc?.idNumber            || '',
            idExpiryDate:         identityDoc?.idExpiryDate        || '',
            idVerificationStatus: identityDoc?.verificationStatus  || 'Pending',
            emergencyContactName:         emergencyContact?.contactName  || '',
            emergencyContactRelationship: emergencyContact?.relationship || '',
            emergencyContactPhone:        emergencyContact?.phone        || '',
            password: '',
          });
        } else {
          setLoadError(response.error || 'Staff member not found');
        }
      } catch (err) {
        console.error('Error loading staff:', err);
        setLoadError('Failed to load staff data');
      } finally {
        setLoading(false);
      }
    };

    loadStaff();
  }, [isEditMode, id]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!form.firstName.trim()) errs.firstName = 'First name is required.';
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required.';
    if (!form.jobTitle)         errs.jobTitle  = 'Role is required.';

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address.';
    }
    if (form.baseSalary && isNaN(Number(form.baseSalary))) {
      errs.baseSalary = 'Salary must be a number.';
    }

    // Portal credentials require a valid email to use as the login identifier
    if (form.password && !form.email.trim()) {
      errs.email = 'An email address is required to create a login account.';
    }
    if (form.password && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address to use as the login identifier.';
    }
    if (form.password && form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }

    setSubmitted(true);   // mark as submitted so errors become visible
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Only pass errors to fields after the user has attempted to submit
  const fieldError = (field: keyof FormErrors) => submitted ? errors[field] : undefined;

  // ── Save handler ───────────────────────────────────────────────────────────

  /** Save a File to a temp path and upload to Cloudinary, returning the hosted URL */
  const uploadFile = async (file: File, folder: string, publicId?: string): Promise<string | null> => {
    try {
      // Write file to a temporary path the main process can read
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      // Use Electron's webUtils or a temp file approach via base64 data URL
      // Since we can't write to disk from the renderer directly, encode as base64
      // and pass to a handler that writes temp + uploads
      // Chunk-based encoding — btoa(String.fromCharCode(...uint8)) crashes on
      // files larger than ~64KB because the spread exceeds the JS engine's
      // maximum call-stack argument limit (RangeError). Process in 8KB chunks.
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const ext     = file.name.split('.').pop() ?? 'jpg';
      // Include a random suffix so rapid sequential uploads (photo + ID front + ID back
      // within the same second) each produce a unique Cloudinary signature and public_id.
      const rand    = Math.random().toString(36).slice(2, 8);
      const tmpName = `staff_upload_${Date.now()}_${rand}.${ext}`;

      // Pass base64 content + filename to a new IPC handler that writes temp + uploads
      const res = await window.electron.uploadToCloudinaryBase64({
        base64,
        fileName: tmpName,
        folder,
        publicId,
      });

      if (res.success && res.url) return res.url;
      console.error('Cloudinary upload failed:', res.error);
      return null;
    } catch (err) {
      console.error('uploadFile error:', err);
      return null;
    }
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && id) {
        // ── UPDATE MODE ───────────────────────────────────────────────────────

        // 1. Upload any newly selected files to Cloudinary
        let resolvedPhotoUrl: string | undefined | null = existingPhotoUrl; // null = cleared
        let resolvedFrontUrl: string | undefined | null = idFrontExistingUrl;
        let resolvedBackUrl:  string | undefined | null = idBackExistingUrl;

        if (photoFile) {
          toast.loading('Uploading photo...', { id: 'staff-save' });
          const res = await uploadFile(photoFile, 'staff/photos');
          if (res) resolvedPhotoUrl = res;
          else toast.warning('Photo upload failed — existing photo will be kept.');
        } else if (!existingPhotoUrl) {
          // Admin explicitly removed the photo
          resolvedPhotoUrl = null;
        }

        if (idFrontFile) {
          toast.loading('Uploading ID front...', { id: 'staff-save' });
          const res = await uploadFile(idFrontFile, 'staff/id_documents');
          if (res) resolvedFrontUrl = res;
          else toast.warning('ID front upload failed — existing file will be kept.');
        } else if (!idFrontExistingUrl) {
          resolvedFrontUrl = null;
        }

        if (idBackFile) {
          toast.loading('Uploading ID back...', { id: 'staff-save' });
          const res = await uploadFile(idBackFile, 'staff/id_documents');
          if (res) resolvedBackUrl = res;
          else toast.warning('ID back upload failed — existing file will be kept.');
        } else if (!idBackExistingUrl) {
          resolvedBackUrl = null;
        }

        toast.loading('Saving changes...', { id: 'staff-save' });

        const updateData = {
          firstName:      form.firstName.trim(),
          lastName:       form.lastName.trim(),
          email:          form.email.trim()  || undefined,
          phone:          form.phone.trim()  || undefined,
          jobTitle:       form.jobTitle,
          branch:         form.branch        || undefined,
          employmentType: form.employmentType || 'Full-time',
          joiningDate:    form.joiningDate   || undefined,
          baseSalary:     form.baseSalary ? Number(form.baseSalary) : 0,
          photoUrl:       resolvedPhotoUrl   ?? undefined,

          // Identity document fields (routed to staff_identity_documents by updateStaff)
          idType:               form.idType              || undefined,
          idNumber:             form.idNumber.trim()     || undefined,
          idExpiryDate:         form.idExpiryDate        || undefined,
          idVerificationStatus: form.idVerificationStatus || 'Pending',
          frontDocumentUrl:     resolvedFrontUrl ?? undefined,
          backDocumentUrl:      resolvedBackUrl  ?? undefined,

          // Emergency contact (routed to staff_emergency_contacts by updateStaff)
          emergencyContactName:         form.emergencyContactName.trim()     || undefined,
          emergencyContactRelationship: form.emergencyContactRelationship    || undefined,
          emergencyContactPhone:        form.emergencyContactPhone.trim()    || undefined,
        };

        const staffRes = await window.electron.updateStaff(id, updateData);
        toast.dismiss('staff-save');

        if (!staffRes.success) {
          toast.error(staffRes.error ?? 'Failed to update staff member.');
          return;
        }

        // If a password is provided in edit mode (new account or change flow),
        // create/update the Supabase Auth account using the staff email as identifier.
        if (form.password && form.email.trim() && (changingCredentials || !existingLoginEmail)) {
          const accountRes = await window.electron.createStaffUserAccount({
            staffId:   id,
            password:  form.password,
            email:     form.email.trim(),
            firstName: form.firstName.trim(),
            lastName:  form.lastName.trim(),
            phone:     form.phone.trim() || undefined,
          });

          if (accountRes.success) {
            toast.success(
              `${form.firstName} ${form.lastName}'s profile and login credentials have been updated.`
            );
          } else {
            toast.warning(
              `Profile updated, but login account could not be saved: ${accountRes.error ?? 'unknown error'}.`
            );
          }
        } else {
          toast.success(`${form.firstName} ${form.lastName}'s profile has been updated.`);
        }

        window.dispatchEvent(new Event('staff:refresh'));
        setChangingCredentials(false);
        navigate(`/staff/${id}`);

      } else {
        // ── CREATE MODE ───────────────────────────────────────────────────────
        setSaving(true);
        toast.loading('Saving staff member...', { id: 'staff-save' });

        // 1. Upload files to Cloudinary (non-blocking — warn if fails)
        let photoUrl:    string | undefined;
        let idFrontUrl:  string | undefined;
        let idBackUrl:   string | undefined;

        if (photoFile) {
          toast.loading('Uploading photo...', { id: 'staff-save' });
          const res = await uploadFile(photoFile, 'staff/photos');
          if (res) photoUrl = res;
          else toast.warning('Photo upload failed — staff will be saved without a photo.');
        }
        if (idFrontFile) {
          toast.loading('Uploading ID front...', { id: 'staff-save' });
          const res = await uploadFile(idFrontFile, 'staff/id_documents');
          if (res) idFrontUrl = res;
          else toast.warning('ID front upload failed — will be saved without it.');
        }
        if (idBackFile) {
          toast.loading('Uploading ID back...', { id: 'staff-save' });
          const res = await uploadFile(idBackFile, 'staff/id_documents');
          if (res) idBackUrl = res;
          else toast.warning('ID back upload failed — will be saved without it.');
        }

        toast.loading('Creating staff record...', { id: 'staff-save' });

        // 2. Create the staff HR record
        const staffRes = await window.electron.createStaff({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          jobTitle: form.jobTitle,
          branch: form.branch || undefined,
          employmentType: form.employmentType || 'Full-time',
          joiningDate: form.joiningDate || undefined,
          baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
          photoUrl: photoUrl || undefined,

          // Identity document fields
          idType:                  form.idType || undefined,
          idNumber:                form.idNumber.trim() || undefined,
          idExpiryDate:            form.idExpiryDate || undefined,
          idVerificationStatus:    form.idVerificationStatus || 'Pending',
          frontDocumentUrl:        idFrontUrl || undefined,
          backDocumentUrl:         idBackUrl  || undefined,

          // Emergency contact
          emergencyContactName:         form.emergencyContactName.trim() || undefined,
          emergencyContactRelationship: form.emergencyContactRelationship || undefined,
          emergencyContactPhone:        form.emergencyContactPhone.trim() || undefined,
        });

        toast.dismiss('staff-save');

        if (!staffRes.success) {
          toast.error(staffRes.error ?? 'Failed to save staff member.');
          return;
        }

        const newStaffId = staffRes.data?.id;

        // 3. If a password is provided and the staff member has an email, create the portal account
        if (form.password && form.email.trim() && newStaffId) {
          const accountRes = await window.electron.createStaffUserAccount({
            staffId:   newStaffId,
            password:  form.password,
            email:     form.email.trim(),
            firstName: form.firstName.trim(),
            lastName:  form.lastName.trim(),
            phone:     form.phone.trim() || undefined,
          });

          if (!accountRes.success) {
            toast.warning(
              `Staff saved, but login account could not be created: ${accountRes.error ?? 'unknown error'}. You can retry by editing the profile.`
            );
          }
        }

        toast.success(`${form.firstName} ${form.lastName} has been added to the team.`);
        window.dispatchEvent(new Event('staff:refresh'));
        navigate('/staff');
      }
    } catch (err) {
      console.error('Save staff error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="text-ink/30 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p className="font-display font-bold text-[18px] text-danger-text">{loadError}</p>
        <button onClick={() => navigate('/staff')} className="text-[13px] text-ink/55 hover:text-ink underline">
          Back to Staff Management
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/staff')}
            disabled={saving}
            className="mt-1.5 w-8 h-8 flex items-center justify-center rounded-[8px] border border-ink/[0.12] hover:border-ink/25 text-ink/50 hover:text-ink transition-colors flex-none disabled:opacity-40"
            title="Back to Staff Management"
          >
            <ArrowLeft size={15} strokeWidth={2} />
          </button>
          <div>
            <h1 className="font-display font-bold text-[36px] leading-[1.15] tracking-tight text-ink">
              {isEditMode ? 'Edit Staff Profile' : 'Add New Staff'}
            </h1>
            <p className="text-[14.5px] text-ink/55 mt-2">
              {isEditMode
                ? 'Update this staff member\'s information and documents.'
                : 'Onboard a new member to your operational team.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-none mt-1">
          <button
            type="button"
            onClick={() => navigate('/staff')}
            disabled={saving}
            className="h-9 px-5 rounded-[9px] border border-ink/[0.14] text-[13px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors bg-white disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 h-9 px-5 rounded-[9px] bg-ink text-paper text-[13px] font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />
            ) : (
              <Save size={14} strokeWidth={2.5} />
            )}
            {saving ? 'Saving…' : 'Save Staff'}
          </button>
        </div>
      </div>

      {/* ── Profile Photo ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-ink/[0.08] rounded-2xl p-7 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="relative w-24 h-24 rounded-full bg-ink/[0.05] border-2 border-dashed border-ink/[0.18] hover:border-olive/60 overflow-hidden flex items-center justify-center group transition-colors"
          title="Upload profile photo"
        >
          {/* Show new preview first, then fall back to existing saved URL, then empty */}
          {(photoPreview) ? (
            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <Camera size={28} strokeWidth={1.4} className="text-ink/30 group-hover:text-olive/60 transition-colors" />
          )}
          {photoPreview && (
            <div className="absolute inset-0 bg-ink/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={22} strokeWidth={1.6} className="text-paper" />
            </div>
          )}
        </button>
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <div className="text-center">
          <p className="text-[12px] font-bold text-ink/50 uppercase tracking-widest">
            {photoPreview ? 'Change Photo' : 'Upload Photo'}
          </p>
          <p className="text-[11.5px] text-ink/35 mt-0.5">Avatar size: 250×250px</p>
        </div>
        {/* In edit mode with an existing photo, offer a clear/remove option */}
        {isEditMode && photoPreview && (
          <button
            type="button"
            onClick={() => {
              setPhotoPreview(null);
              setPhotoFile(null);
              setExistingPhotoUrl(null);
            }}
            className="text-[11.5px] font-semibold text-danger-text/70 hover:text-danger-text transition-colors"
          >
            Remove photo
          </button>
        )}
      </div>

      {/* ── Basic Information ─────────────────────────────────────────────────── */}
      <SectionCard title="Basic Information" subtitle="Personal details and employment specifics.">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <Label required>First Name</Label>
            <FieldInput
              placeholder="e.g. Jonathan"
              value={form.firstName}
              onChange={set('firstName')}
              error={fieldError('firstName')}
            />
          </div>
          <div>
            <Label required>Last Name</Label>
            <FieldInput
              placeholder="e.g. Aris"
              value={form.lastName}
              onChange={set('lastName')}
              error={fieldError('lastName')}
            />
          </div>
          <div>
            <Label>Phone Number</Label>
            <FieldInput
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={form.phone}
              onChange={set('phone')}
              error={fieldError('phone')}
            />
          </div>
          <div>
            <Label>Email Address</Label>
            <FieldInput
              type="email"
              placeholder="jonathan@stockflow.com"
              value={form.email}
              onChange={set('email')}
              error={fieldError('email')}
            />
          </div>
          <div>
            <Label required>Role / Job Title</Label>
            <FieldSelect
              placeholder="Select Role"
              options={['Store Manager', 'Sales Associate', 'Cashier', 'Inventory Officer', 'Security', 'Supervisor']}
              value={form.jobTitle}
              onChange={set('jobTitle')}
              error={fieldError('jobTitle')}
            />
          </div>
          <div>
            <Label>Store / Branch</Label>
            <FieldSelect
              placeholder="Select Branch"
              options={['Main Store', 'Branch A', 'Branch B', 'Warehouse']}
              value={form.branch}
              onChange={set('branch')}
            />
          </div>
          <div>
            <Label>Employment Type</Label>
            <FieldSelect
              placeholder="Select Type"
              options={['Full-time', 'Part-time', 'Contract', 'Intern']}
              value={form.employmentType}
              onChange={set('employmentType')}
            />
          </div>
          <div>
            <Label>Joining Date</Label>
            <FieldInput
              type="date"
              value={form.joiningDate}
              onChange={set('joiningDate')}
            />
          </div>
          <div>
            <Label>Base Salary ($)</Label>
            <FieldInput
              type="number"
              placeholder="45000"
              min="0"
              step="100"
              value={form.baseSalary}
              onChange={set('baseSalary')}
              error={fieldError('baseSalary')}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── National Identity ─────────────────────────────────────────────────── */}
      <SectionCard
        title="National Identity & Documents"
        subtitle="Track and verify government-issued identification for compliance."
      >
        <div className="flex items-center gap-2 mb-5 pb-5 border-b border-ink/[0.07]">
          <span className="text-[13px] text-ink/55 font-medium">Verification Status</span>
          {form.idVerificationStatus === 'Verified' ? (
            <span className="inline-flex items-center gap-1.5 bg-success-bg text-success-text text-[12px] font-semibold px-2.5 py-1 rounded-full">
              <ShieldCheck size={12} strokeWidth={2.2} />
              Verified
            </span>
          ) : form.idVerificationStatus === 'Rejected' ? (
            <span className="inline-flex items-center gap-1.5 bg-danger-bg text-danger-text text-[12px] font-semibold px-2.5 py-1 rounded-full">
              <AlertTriangle size={12} strokeWidth={2.2} />
              Rejected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-warning-bg text-warning-text text-[12px] font-semibold px-2.5 py-1 rounded-full">
              <Clock size={12} strokeWidth={2.2} />
              Pending
            </span>
          )}
          {!isEditMode && (
            <span className="text-[11.5px] text-ink/35 ml-1">
              Default for new entries — update after document review.
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <Label>ID Type</Label>
            <FieldSelect
              placeholder="Select ID Type"
              options={['National ID', 'Passport', 'Driving License', 'Voter ID', 'Social Security Card']}
              value={form.idType}
              onChange={set('idType')}
            />
          </div>
          <div>
            <Label>ID Number</Label>
            <FieldInput
              placeholder="e.g. GHA-000123456-0"
              value={form.idNumber}
              onChange={set('idNumber')}
            />
          </div>
          <div>
            <Label>
              ID Expiry Date{' '}
              <span className="text-ink/35 font-normal normal-case tracking-normal">(optional)</span>
            </Label>
            <FieldInput
              type="date"
              value={form.idExpiryDate}
              onChange={set('idExpiryDate')}
            />
          </div>
          <div />
          <UploadZone
            label="Front Side of ID"
            file={idFrontFile}
            onFileChange={setIdFrontFile}
            existingUrl={idFrontFile ? null : idFrontExistingUrl}
            onClearExisting={() => setIdFrontExistingUrl(null)}
          />
          <UploadZone
            label="Back Side of ID"
            file={idBackFile}
            onFileChange={setIdBackFile}
            existingUrl={idBackFile ? null : idBackExistingUrl}
            onClearExisting={() => setIdBackExistingUrl(null)}
          />
        </div>
      </SectionCard>

      {/* ── Emergency Contact ─────────────────────────────────────────────────── */}
      <SectionCard title="Emergency Contact" subtitle="Person to reach in case of an emergency.">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <Label>Contact Name</Label>
            <FieldInput
              placeholder="e.g. Mary Aris"
              value={form.emergencyContactName}
              onChange={set('emergencyContactName')}
            />
          </div>
          <div>
            <Label>Relationship</Label>
            <FieldSelect
              placeholder="Select Relationship"
              options={['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other']}
              value={form.emergencyContactRelationship}
              onChange={set('emergencyContactRelationship')}
            />
          </div>
          <div className="col-span-2 max-w-[calc(50%-12px)]">
            <Label>Contact Phone Number</Label>
            <FieldInput
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={form.emergencyContactPhone}
              onChange={set('emergencyContactPhone')}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Access Credentials ────────────────────────────────────────────────── */}
      <SectionCard
        title="Access Credentials"
        subtitle="Optional — only fill in if this staff member needs to log into the Staff Portal."
      >
        {/* Gate: no email = portal login not possible */}
        {!form.email.trim() ? (
          <div className="flex items-start gap-3 bg-ink/[0.025] rounded-[10px] px-4 py-3.5">
            <AlertTriangle size={15} strokeWidth={1.8} className="text-warning-text flex-none mt-0.5" />
            <p className="text-[12.5px] text-ink/55 leading-relaxed">
              Add an email address in Basic Information above to enable portal login for this staff member.
            </p>
          </div>
        ) : isEditMode ? (
          /* ── EDIT MODE ─────────────────────────────────────────────────────── */
          <>
            {existingLoginEmail ? (
              /* Account already exists — show it, gate changes behind confirmation */
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                  {/* Login email (read-only display) */}
                  <div>
                    <Label>Login Email</Label>
                    <div className="h-11 px-4 rounded-[9px] border border-ink/[0.10] bg-ink/[0.025] flex items-center gap-2">
                      <ShieldCheck size={14} strokeWidth={1.8} className="text-success-text flex-none" />
                      <span className="text-[13.5px] text-ink font-medium truncate">
                        {existingLoginEmail}
                      </span>
                    </div>
                  </div>

                  {/* Password (masked display) */}
                  <div>
                    <Label>Password</Label>
                    <div className="h-11 px-4 rounded-[9px] border border-ink/[0.10] bg-ink/[0.025] flex items-center gap-2">
                      <span className="text-[18px] text-ink/40 tracking-[4px]">••••••••</span>
                    </div>
                  </div>
                </div>

                {/* Change credentials button */}
                {!changingCredentials ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowChangeWarning(true)}
                      className="flex items-center gap-2 h-9 px-4 rounded-[9px] border border-ink/[0.14] text-[13px] font-semibold text-ink/60 hover:text-ink hover:border-ink/30 transition-colors bg-white"
                    >
                      <KeyRound size={14} strokeWidth={2} />
                      Change Password
                    </button>
                  </div>
                ) : (
                  /* Expanded password change form */
                  <div className="mt-5 space-y-4 rounded-[10px] border border-warning-text/30 bg-warning-bg/30 p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={15} strokeWidth={2} className="text-warning-text flex-none" />
                      <p className="text-[12.5px] font-semibold text-warning-text">
                        Changing the password will update the portal login for this staff member immediately.
                      </p>
                    </div>
                    {/* Login email — read-only, auto-filled from profile */}
                    <div>
                      <Label>Login Email</Label>
                      <div className="h-10 px-3.5 rounded-[9px] border border-ink/[0.10] bg-ink/[0.025] flex items-center gap-2">
                        <span className="text-[13.5px] text-ink/60 truncate">{form.email}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-ink/35">
                        The login email matches the email address in Basic Information.
                      </p>
                    </div>
                    <div>
                      <Label>New Password</Label>
                      <div className="relative">
                        <FieldInput
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                          className="pr-10"
                          value={form.password}
                          onChange={set('password')}
                          error={fieldError('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-[20px] -translate-y-1/2 text-ink/35 hover:text-ink/65 transition-colors"
                          tabIndex={-1}
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword
                            ? <EyeOff size={15} strokeWidth={1.8} />
                            : <Eye size={15} strokeWidth={1.8} />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setChangingCredentials(false);
                        setForm(prev => ({ ...prev, password: '' }));
                        setErrors(prev => ({ ...prev, password: undefined }));
                      }}
                      className="text-[12.5px] font-semibold text-ink/45 hover:text-ink transition-colors"
                    >
                      Cancel password change
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* No account yet — create one */
              <>
                {/* Login email — read-only, auto-filled */}
                <div className="mb-5">
                  <Label>Login Email</Label>
                  <div className="h-10 px-3.5 rounded-[9px] border border-ink/[0.10] bg-ink/[0.025] flex items-center gap-2">
                    <span className="text-[13.5px] text-ink/70 truncate">{form.email}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink/35">
                    Matches the email in Basic Information — this is what the staff member will log in with.
                  </p>
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative max-w-[calc(50%-12px)]">
                    <FieldInput
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      className="pr-10"
                      value={form.password}
                      onChange={set('password')}
                      error={fieldError('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-[20px] -translate-y-1/2 text-ink/35 hover:text-ink/65 transition-colors"
                      tabIndex={-1}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword
                        ? <EyeOff size={15} strokeWidth={1.8} />
                        : <Eye size={15} strokeWidth={1.8} />}
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 bg-ink/[0.025] rounded-[9px] px-4 py-3">
                  <ShieldCheck size={15} strokeWidth={1.8} className="text-ink/35 flex-none mt-0.5" />
                  <p className="text-[12.5px] text-ink/45 leading-relaxed">
                    No portal account exists yet. Set a password to create one using the email above.
                  </p>
                </div>
              </>
            )}
          </>
        ) : (
          /* ── CREATE MODE ─────────────────────────────────────────────────── */
          <>
            {/* Login email — read-only, auto-filled from form.email */}
            <div className="mb-5">
              <Label>Login Email</Label>
              <div className="h-10 px-3.5 rounded-[9px] border border-ink/[0.10] bg-ink/[0.025] flex items-center gap-2">
                <span className="text-[13.5px] text-ink/70 truncate">
                  {form.email || <span className="text-ink/30 italic">Enter email in Basic Information</span>}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink/35">
                The login email is taken from Basic Information above — no need to enter it twice.
              </p>
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative max-w-[calc(50%-12px)]">
                <FieldInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pr-10"
                  value={form.password}
                  onChange={set('password')}
                  error={fieldError('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[20px] -translate-y-1/2 text-ink/35 hover:text-ink/65 transition-colors"
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff size={15} strokeWidth={1.8} />
                    : <Eye size={15} strokeWidth={1.8} />}
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 bg-ink/[0.025] rounded-[9px] px-4 py-3">
              <ShieldCheck size={15} strokeWidth={1.8} className="text-ink/35 flex-none mt-0.5" />
              <p className="text-[12.5px] text-ink/45 leading-relaxed">
                Leave password blank if this staff member doesn't need portal access.
                If set, a login account will be created using their email. Password must be at least 8 characters.
              </p>
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Change Credentials Warning Dialog ────────────────────────────────── */}
      {showChangeWarning && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowChangeWarning(false); }}
        >
          <div className="bg-white rounded-2xl border border-ink/[0.08] w-full max-w-md mx-4 shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-11 h-11 rounded-xl bg-warning-bg flex items-center justify-center flex-none">
                <AlertTriangle size={20} strokeWidth={1.8} className="text-warning-text" />
              </div>
              <div>
                <h3 className="font-display font-bold text-[16px] text-ink mb-1">
                  Change Login Credentials?
                </h3>
                <p className="text-[13px] text-ink/60 leading-relaxed">
                  This will update the portal login password for this staff member. They will need to
                  use their email and the new password to log in going forward.
                </p>
                {existingLoginEmail && (
                  <p className="text-[12px] text-ink/45 mt-2">
                    Current login: <span className="font-semibold text-ink">{existingLoginEmail}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowChangeWarning(false)}
                className="h-10 px-5 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowChangeWarning(false);
                  setChangingCredentials(true);
                }}
                className="h-10 px-5 rounded-[9px] bg-warning-bg border border-warning-text/40 text-warning-text text-[13.5px] font-semibold hover:bg-warning-text hover:text-white transition-colors"
              >
                Yes, Change Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer Actions ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2 pb-4">
        <button
          type="button"
          onClick={() => navigate('/staff')}
          disabled={saving}
          className="h-10 px-6 rounded-[9px] border border-ink/[0.14] text-[13.5px] font-semibold text-ink/65 hover:text-ink hover:border-ink/30 transition-colors bg-white disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 h-10 px-6 rounded-[9px] bg-ink text-paper text-[13.5px] font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />
          ) : (
            <Save size={15} strokeWidth={2.5} />
          )}
          {saving ? 'Saving…' : 'Save Staff'}
        </button>
      </div>

    </div>
  );
};

export default AddStaffPage;
