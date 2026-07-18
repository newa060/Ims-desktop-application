import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Plus, Edit2, ChevronDown, ChevronRight, ChevronLeft, RefreshCw,
  Search, Hash, AlertTriangle, CheckCircle2, Loader2, X,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** 
 * Extract the base item code from a set of variants.
 * Returns the exact SKU of the main variant (null color/size).
 * If not found, falls back to the exact SKU of the first variant.
 */
const deriveParentCode = (variants: any[]): string => {
  if (!variants || variants.length === 0) return '';

  // Find a variant with empty color/size
  const mainVariant = variants.find(v => !v.color && !v.size);
  if (mainVariant && mainVariant.sku) {
    return mainVariant.sku;
  }

  // Fallback to first SKU
  return variants[0]?.sku || '';
};

/** Build preview rows for the dialog preview table. */
const buildPreview = (variants: any[], baseCode: string) => {
  // Sort variants: Main variant (null color/size) first, then others alphabetically
  const sorted = [...variants].sort((a, b) => {
    const aMain = !a.color && !a.size;
    const bMain = !b.color && !b.size;
    if (aMain && !bMain) return -1;
    if (!aMain && bMain) return 1;
    const aLabel = [a.variantName !== 'Default' ? a.variantName : null, a.color, a.size].filter(Boolean).join(' · ');
    const bLabel = [b.variantName !== 'Default' ? b.variantName : null, b.color, b.size].filter(Boolean).join(' · ');
    return aLabel.localeCompare(bLabel);
  });

  return sorted.map((v, i) => ({
    id: v.id,
    label: [v.variantName !== 'Default' ? v.variantName : null, v.color, v.size]
      .filter(Boolean).join(' · ') || 'Default (Main)',
    currentSku: v.sku || '',
    newSku: baseCode ? `${baseCode}.${i + 1}` : '',
  }));
};

// ── Component ──────────────────────────────────────────────────────────────────

const VariantsPage = () => {
  const [parents, setParents] = useState<any[]>([]);
  const [variantMap, setVariantMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [jumpVal, setJumpVal] = useState('1');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogParent, setDialogParent] = useState<any | null>(null);
  const [baseCode, setBaseCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadData = useCallback(async (p = page, l = limit, s = search) => {
    setLoading(true);
    try {
      const [parentsRes, variantsRes] = await Promise.all([
        window.electron.getParentProducts({ page: p, limit: l, search: s }),
        window.electron.getVariants({ page: 1, limit: 50000 }), // Increased limit to fetch all variants for the resolution map
      ]);

      if (parentsRes.success) {
        setParents(parentsRes.data?.data ?? parentsRes.data ?? []);
        setTotal(parentsRes.data?.pagination?.total ?? parentsRes.data?.total ?? 0);
        setTotalPages(parentsRes.data?.pagination?.totalPages ?? parentsRes.data?.totalPages ?? 1);
        const activePage = parentsRes.data?.pagination?.page ?? parentsRes.data?.page ?? p;
        setPage(activePage);
        setJumpVal(String(activePage));
      } else {
        setParents([]);
        setTotal(0);
        setTotalPages(1);
      }

      if (variantsRes.success) {
        const all: any[] = variantsRes.data?.data ?? [];
        const map: Record<string, any[]> = {};
        for (const v of all) {
          const pid: string = v.productFlatId || v.product_flat_id || '';
          if (!pid) continue;
          if (!map[pid]) map[pid] = [];
          map[pid].push(v);
        }
        setVariantMap(prev => ({ ...prev, ...map }));
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => { loadData(1, limit, ''); }, []);

  const handleSearch = () => {
    setPage(1);
    loadData(1, limit, search);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    loadData(p, limit, search);
  };

  const toggleExpand = async (id: string) => {
    const isExpanded = !!expanded[id];
    setExpanded(prev => ({ ...prev, [id]: !isExpanded }));

    if (!isExpanded && (!variantMap[id] || variantMap[id].length === 0)) {
      try {
        const res = await window.electron.getVariantsByProduct(id);
        if (res.success) {
          setVariantMap(prev => ({ ...prev, [id]: res.data }));
        }
      } catch {
        toast.error('Failed to fetch variants for this product');
      }
    }
  };

  // ── Open dialog ────────────────────────────────────────────────────────────
  const openDialog = (parent: any) => {
    const variants = variantMap[parent.id] || [];
    setDialogParent(parent);
    setBaseCode(deriveParentCode(variants));
    setConflicts([]);
    setDialogOpen(true);
  };

  // ── Conflict check ─────────────────────────────────────────────────────────
  const checkConflicts = async (code: string): Promise<string[]> => {
    if (!code || !dialogParent) return [];
    setChecking(true);
    const variants = variantMap[dialogParent.id] || [];
    const ownIds = new Set(variants.map((v: any) => v.id));
    const generated = variants.map((_: any, i: number) => `${code}.${i + 1}`);
    const found: string[] = [];

    for (const sku of generated) {
      try {
        const res = await window.electron.searchVariantBySKU(sku);
        if (res.success && res.data && !ownIds.has(res.data.id)) {
          found.push(sku);
        }
      } catch { /* skip */ }
    }

    setChecking(false);
    setConflicts(found);
    return found;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const trimmed = baseCode.trim();
    if (!trimmed) { toast.error('Please enter a base item code'); return; }
    if (!dialogParent) return;

    const variants = variantMap[dialogParent.id] || [];
    if (variants.length === 0) {
      toast.error('No variants found for this product');
      return;
    }

    // Overwrite warning
    const hasCodes = variants.some((v: any) => v.sku);
    if (hasCodes) {
      const go = window.confirm(
        `This will overwrite the existing SKUs for all ${variants.length} variant(s) of "${dialogParent.name}".\n\nDo you want to continue?`
      );
      if (!go) return;
    }

    // Conflict check
    const found = await checkConflicts(trimmed);
    if (found.length > 0) {
      toast.error(`Already used by another product: ${found.join(', ')}`);
      return;
    }

    // Sort variants to ensure main variant (null color/size) gets code.1
    const sortedVariants = [...variants].sort((a, b) => {
      const aMain = !a.color && !a.size;
      const bMain = !b.color && !b.size;
      if (aMain && !bMain) return -1;
      if (!aMain && bMain) return 1;
      const aLabel = [a.variantName !== 'Default' ? a.variantName : null, a.color, a.size].filter(Boolean).join(' · ');
      const bLabel = [b.variantName !== 'Default' ? b.variantName : null, b.color, b.size].filter(Boolean).join(' · ');
      return aLabel.localeCompare(bLabel);
    });

    // Persist
    setSaving(true);
    try {
      for (let i = 0; i < sortedVariants.length; i++) {
        await window.electron.updateVariant(sortedVariants[i].id, { sku: `${trimmed}.${i + 1}` });
      }
      toast.success(`Item codes set for "${dialogParent.name}"`);
      setDialogOpen(false);
      loadData(page, limit, search);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save item codes');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredParents = parents; // Filtering done server-side now

  const preview = dialogParent
    ? buildPreview(variantMap[dialogParent.id] || [], baseCode.trim())
    : [];

  const withCodes = parents.filter(p => deriveParentCode(variantMap[p.id] || []) !== '').length;
  const missingCode = parents.length - withCodes;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Item Codes</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">
            Manage parent product item codes and auto-generate variant SKUs
          </p>
        </div>
        <Button variant="outline" onClick={() => loadData(page, limit, search)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={17} />
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
                loadData(1, limit, '');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink/80 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      {/* Summary strip */}
      {!loading && (
        <div className="flex gap-6 text-sm">
          <span className="text-ink/50">
            <span className="font-bold text-ink">{parents.length}</span> parent products
          </span>
          <span className="text-ink/50">
            <span className="font-bold text-success-text">{withCodes}</span> with item codes
          </span>
          {missingCode > 0 && (
            <span className="flex items-center gap-1 text-ink/50">
              <AlertTriangle size={12} className="text-warning-text" />
              <span className="font-bold text-warning-text">{missingCode}</span> missing codes
            </span>
          )}
        </div>
      )}

      {/* Product list */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Column headers */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-ink/[0.08] bg-[#faf9f5]">
            <div className="w-12 text-[11px] font-bold uppercase tracking-wider text-ink/45">S.N.</div>
            <div className="flex-1 text-[11px] font-bold uppercase tracking-wider text-ink/45">Product</div>
            <div className="w-28 text-[11px] font-bold uppercase tracking-wider text-ink/45 text-center">Variants</div>
            <div className="w-36 text-[11px] font-bold uppercase tracking-wider text-ink/45 text-right">Item Code</div>
            <div className="w-44 text-[11px] font-bold uppercase tracking-wider text-ink/45 text-right pr-2">Actions</div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredParents.length === 0 ? (
            <div className="text-center py-16 text-ink/40">
              {search ? 'No products match your search.' : 'No products found.'}
            </div>
          ) : (
            <div className="divide-y divide-ink/[0.05]">
              {filteredParents.map((parent, idx) => {
                const rawVariants = variantMap[parent.id] || [];
                // Sort variants for display: Main variant first, then alphabetically
                const variants = [...rawVariants].sort((a, b) => {
                  const aMain = !a.color && !a.size;
                  const bMain = !b.color && !b.size;
                  if (aMain && !bMain) return -1;
                  if (!aMain && bMain) return 1;
                  const aLabel = [a.variantName !== 'Default' ? a.variantName : null, a.color, a.size].filter(Boolean).join(' · ');
                  const bLabel = [b.variantName !== 'Default' ? b.variantName : null, b.color, b.size].filter(Boolean).join(' · ');
                  return aLabel.localeCompare(bLabel);
                });

                const code = deriveParentCode(variants);
                const hasCode = code !== '';
                const isExpanded = !!expanded[parent.id];

                return (
                  <div key={parent.id}>
                    {/* ── Parent row ── */}
                    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#faf9f5]/60 transition-colors">
                      {/* S.N. */}
                      <div className="w-12 text-sm text-ink/40 font-medium">{idx + 1}</div>

                      {/* Product Name */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13.5px] text-ink truncate">{parent.name}</div>
                      </div>

                      {/* Variants Count Column */}
                      <div className="w-28 text-center">
                        <span className="text-xs bg-ink/[0.04] border border-ink/[0.08] text-ink/75 font-semibold px-2 py-0.5 rounded-full">
                          {variants.length} variant{variants.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Code badge */}
                      <div className="w-36 flex justify-end">
                        {hasCode ? (
                          <span className="font-mono text-[12.5px] font-bold text-primary bg-primary/[0.08] border border-primary/20 rounded-md px-2.5 py-0.5">
                            {code}
                          </span>
                        ) : (
                          <span className="text-[12px] text-warning-text/80 font-medium italic">No code</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="w-44 flex justify-end gap-1.5 items-center">
                        {hasCode ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-ink/20 hover:border-primary/40 hover:text-primary"
                            onClick={() => openDialog(parent)}
                          >
                            <Edit2 size={11} /> Edit Code
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => openDialog(parent)}
                          >
                            <Plus size={11} /> Set Code
                          </Button>
                        )}

                        {/* Expand button shifted to right side of Edit/Set button */}
                        <button
                          onClick={() => toggleExpand(parent.id)}
                          className="h-7 w-7 text-ink/40 hover:text-primary hover:bg-ink/[0.03] rounded-md transition-colors flex items-center justify-center border border-transparent"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* ── Expanded variant rows ── */}
                    {isExpanded && (
                      <div className="bg-[#f8f7f3]/80 border-t border-dashed border-ink/[0.06]">
                        {variants.length === 0 ? (
                          <div className="py-3 pl-12 text-xs text-ink/35 italic">No variants</div>
                        ) : variants.map((v: any, i: number) => {
                          const expectedSku = code ? `${code}.${i + 1}` : '';
                          const matches = expectedSku ? v.sku === expectedSku : false;
                          const isMain = !v.color && !v.size;
                          return (
                            <div
                              key={v.id}
                              className="flex items-center gap-4 px-5 py-2.5 pl-12 border-b border-ink/[0.04] last:border-b-0"
                            >
                              <div className="flex-1 text-[12.5px] text-ink/65 flex items-center gap-2">
                                <span>
                                  {[v.variantName !== 'Default' ? v.variantName : null, v.color, v.size]
                                    .filter(Boolean).join(' · ') || 'Default'}
                                </span>
                                {isMain && (
                                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded uppercase tracking-wide scale-90">
                                    Main Product
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {v.sku ? (
                                  <>
                                    <span className="font-mono text-[11.5px] text-ink/60 bg-ink/[0.05] rounded px-2 py-0.5">
                                      {v.sku}
                                    </span>
                                    {code && (
                                      matches
                                        ? <span title="Matches expected pattern"><CheckCircle2 size={13} className="text-success-text" /></span>
                                        : <span title="SKU doesn't match expected pattern"><AlertTriangle size={13} className="text-warning-text" /></span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-ink/30 italic">No SKU</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Footer */}
      {!loading && parents.length > 0 && (
        <div className="flex items-center justify-between text-sm text-ink/55 pt-2">
          <span>Total: {total} parent product(s)</span>
          <div className="flex items-center gap-4">
            {/* Jump to Page */}
            <div className="flex items-center gap-1.5 text-xs">
              <span>Jump to:</span>
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={jumpVal}
                onChange={(e) => setJumpVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt(jumpVal);
                    if (val >= 1 && val <= totalPages) {
                      handlePageChange(val);
                    } else {
                      toast.error(`Please enter a page between 1 and ${totalPages}`);
                    }
                  }
                }}
                className="w-14 h-7 px-1.5 text-center text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="px-3 py-1 bg-ink/[0.03] border border-ink/[0.08] rounded-md font-medium text-xs flex items-center">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set / Edit Code Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v && !saving) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
              <Hash size={18} className="text-primary" />
              {dialogParent && deriveParentCode(variantMap[dialogParent.id] || []) !== ''
                ? 'Edit Item Code'
                : 'Set Item Code'}
            </DialogTitle>
          </DialogHeader>

          {dialogParent && (
            <div className="space-y-4">
              {/* Product info pill */}
              <div className="bg-ink/[0.03] border border-ink/[0.07] rounded-lg px-4 py-3 text-sm">
                <span className="text-ink/50">Product: </span>
                <span className="font-semibold text-ink">{dialogParent.name}</span>
                <span className="ml-2 text-ink/40 text-xs">
                  · {(variantMap[dialogParent.id] || []).length} variant(s)
                </span>
              </div>

              {/* Base code input */}
              <div className="space-y-1.5">
                <Label htmlFor="base-code">Base Item Code *</Label>
                <Input
                  id="base-code"
                  placeholder="e.g. 124"
                  value={baseCode}
                  onChange={(e) => { setBaseCode(e.target.value); setConflicts([]); }}
                  className="font-mono text-base"
                  autoFocus
                />
                <p className="text-xs text-ink/40">
                  Variants will be assigned{' '}
                  <code className="font-mono bg-ink/[0.05] px-1 rounded">{baseCode || '124'}.1</code>,{' '}
                  <code className="font-mono bg-ink/[0.05] px-1 rounded">{baseCode || '124'}.2</code>…
                </p>
              </div>

              {/* Preview table */}
              {preview.length > 0 && baseCode.trim() && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink/45">Preview</p>
                  <div className="border border-ink/[0.08] rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-[#faf9f5] border-b border-ink/[0.06]">
                          <th className="text-left py-2 px-3 font-semibold text-ink/50">Variant</th>
                          <th className="text-left py-2 px-3 font-semibold text-ink/50">Current SKU</th>
                          <th className="text-left py-2 px-3 font-semibold text-ink/50">→ New SKU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => {
                          const hasConflict = conflicts.includes(row.newSku);
                          return (
                            <tr key={row.id} className={`border-b border-ink/[0.04] last:border-b-0 ${hasConflict ? 'bg-danger/[0.04]' : ''}`}>
                              <td className="py-2 px-3 text-ink/65">{row.label}</td>
                              <td className="py-2 px-3 font-mono text-ink/40">
                                {row.currentSku || <span className="not-italic italic text-ink/25">—</span>}
                              </td>
                              <td className={`py-2 px-3 font-mono font-bold flex items-center gap-1.5 ${hasConflict ? 'text-danger-text' : 'text-primary'}`}>
                                {row.newSku}
                                {hasConflict && <AlertTriangle size={11} />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Conflict banner */}
              {conflicts.length > 0 && (
                <div className="flex items-start gap-2.5 bg-danger/[0.05] border border-danger/20 rounded-lg px-3.5 py-3 text-sm">
                  <AlertTriangle size={15} className="text-danger-text flex-none mt-0.5" />
                  <div>
                    <p className="font-semibold text-danger-text text-sm">Code conflict detected</p>
                    <p className="text-ink/60 text-xs mt-0.5">
                      <span className="font-mono font-bold">{conflicts.join(', ')}</span>{' '}
                      {conflicts.length === 1 ? 'is' : 'are'} already used by another product.
                      Choose a different base code.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!baseCode.trim() || saving || checking}
              className="gap-1.5 min-w-[140px]"
            >
              {(saving || checking) && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : checking ? 'Checking…' : 'Save Item Codes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VariantsPage;

