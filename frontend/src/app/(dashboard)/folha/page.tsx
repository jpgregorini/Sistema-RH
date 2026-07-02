"use client";

import { Fragment, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator,
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Wallet,
  Gift,
  Truck,
  Users,
  FileSpreadsheet,
  Archive,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import type { Driver, Employee, PayrollRecord, PersonType } from "@/types";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Scope = "salary" | "benefits";
type PatchField =
  | "included_salary"
  | "included_benefits"
  | "paid_salary"
  | "paid_benefits";

const BENEFIT_CATS: { cat: "alimentacao" | "transporte" | "refeicao"; label: string }[] = [
  { cat: "alimentacao", label: "Alimentação" },
  { cat: "transporte", label: "Transporte" },
  { cat: "refeicao", label: "Refeição" },
];

function benefitVal(
  r: PayrollRecord,
  cat: "alimentacao" | "transporte" | "refeicao"
): number {
  const b = r.breakdown?.benefit;
  const fromBreakdown =
    cat === "alimentacao"
      ? b?.alimentacao_valor
      : cat === "transporte"
      ? b?.transporte_valor
      : b?.refeicao_valor;
  const fromRow =
    cat === "alimentacao"
      ? r.beneficio_alimentacao
      : cat === "transporte"
      ? r.beneficio_transporte
      : r.beneficio_refeicao;
  return Number(fromBreakdown ?? fromRow ?? 0);
}

export default function FolhaPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [person, setPerson] = useState<PersonType | null>(null);
  const [calculating, setCalculating] = useState<null | Scope>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => api.get("/api/drivers"),
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees"),
  });

  const { data: payroll = [], isLoading } = useQuery<PayrollRecord[]>({
    queryKey: ["payroll", month],
    queryFn: () => api.get(`/api/payroll?month=${month}`),
    enabled: Boolean(month),
  });

  const records = payroll.filter((p) => p.person_type === person);

  const patchMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: PatchField; value: boolean }) =>
      api.patch(`/api/payroll/${id}`, { [field]: value }),
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: ["payroll", month] });
      const previous = queryClient.getQueryData<PayrollRecord[]>(["payroll", month]);
      queryClient.setQueryData<PayrollRecord[]>(["payroll", month], (old) =>
        (old || []).map((p) => (p.id === id ? { ...p, [field]: value } : p))
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["payroll", month], ctx.previous);
      toast.error("Erro ao atualizar.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["payroll", month] }),
  });

  const calculateScope = async (sc: Scope) => {
    if (!month) return;
    setCalculating(sc);
    try {
      const allPeople = [
        ...drivers.map((d) => ({ type: "driver" as const, id: d.id })),
        ...employees.map((e) => ({ type: "employee" as const, id: e.id })),
      ];
      for (const p of allPeople) {
        await api.post("/api/payroll/generate", {
          person_type: p.type,
          person_id: p.id,
          month,
          scope: sc,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["payroll", month] });
      toast.success(sc === "salary" ? "Folha de salários calculada." : "Folha de benefícios calculada.");
    } catch {
      toast.error("Erro ao calcular folha.");
    }
    setCalculating(null);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadReport = (cat: string) => {
    window.open(
      `${apiUrl}/api/payroll/benefit-report?month=${month}&category=${cat}&person_type=${person}`,
      "_blank"
    );
  };

  const downloadReceiptsZip = (cat: "alimentacao" | "transporte" | "refeicao", label: string) => {
    const recipients = records.filter((r) => r.included_benefits && benefitVal(r, cat) > 0);
    if (recipients.length === 0) {
      toast.error(`Ninguém recebe ${label} neste mês.`);
      return;
    }
    const allPaid = recipients.every((r) => r.paid_benefits);
    if (!allPaid) {
      toast.error(`Marque todos como Pago para baixar os recibos de ${label}.`);
      return;
    }
    window.open(
      `${apiUrl}/api/payroll/benefit-receipts-zip?month=${month}&category=${cat}&person_type=${person}`,
      "_blank"
    );
  };

  // ---------- Step 1: month grid ----------
  if (!month) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Folha de Pagamento</h1>
          <p className="text-sm text-slate-500">Escolha o mês para ver salários e benefícios</p>
        </div>
        <div className="mb-4 flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold text-slate-800 w-20 text-center">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MONTHS_PT.map((label, i) => {
            const m = `${year}-${String(i + 1).padStart(2, "0")}`;
            const isCurrent =
              year === now.getFullYear() && i === now.getMonth();
            return (
              <button
                key={m}
                onClick={() => {
                  setMonth(m);
                  setScope(null);
                  setPerson(null);
                }}
                className={`rounded-xl border p-5 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 ${
                  isCurrent ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-lg font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-400">{year}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const monthLabel = `${MONTHS_PT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

  // ---------- Step 2: scope choice ----------
  if (!scope) {
    return (
      <div>
        <Breadcrumb parts={[{ label: monthLabel, onClick: () => setMonth(null) }]} />
        <h1 className="mb-1 text-2xl font-bold text-slate-900">{monthLabel}</h1>
        <p className="mb-6 text-sm text-slate-500">Escolha a folha</p>
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <ChoiceCard
            icon={<Wallet className="h-7 w-7" />}
            title="Folha de Salário"
            desc="Salário bruto, INSS, adiantamentos e líquido"
            onClick={() => { setScope("salary"); setPerson(null); }}
          />
          <ChoiceCard
            icon={<Gift className="h-7 w-7" />}
            title="Folha de Benefícios"
            desc="Alimentação, transporte e refeição"
            onClick={() => { setScope("benefits"); setPerson(null); }}
          />
        </div>
      </div>
    );
  }

  const scopeLabel = scope === "salary" ? "Folha de Salário" : "Folha de Benefícios";

  // ---------- Step 3: person choice ----------
  if (!person) {
    return (
      <div>
        <Breadcrumb
          parts={[
            { label: monthLabel, onClick: () => setMonth(null) },
            { label: scopeLabel, onClick: () => setScope(null) },
          ]}
        />
        <h1 className="mb-1 text-2xl font-bold text-slate-900">{scopeLabel}</h1>
        <p className="mb-6 text-sm text-slate-500">{monthLabel} · escolha o grupo</p>
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <ChoiceCard
            icon={<Truck className="h-7 w-7" />}
            title="Motoristas"
            onClick={() => setPerson("driver")}
          />
          <ChoiceCard
            icon={<Users className="h-7 w-7" />}
            title="Funcionários"
            onClick={() => setPerson("employee")}
          />
        </div>
      </div>
    );
  }

  const personLabel = person === "driver" ? "Motoristas" : "Funcionários";

  // ---------- Step 4: table ----------
  return (
    <div>
      <Breadcrumb
        parts={[
          { label: monthLabel, onClick: () => setMonth(null) },
          { label: scopeLabel, onClick: () => setScope(null) },
          { label: personLabel, onClick: () => setPerson(null) },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          {scopeLabel} · {personLabel}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => calculateScope(scope)} disabled={calculating !== null} className="gap-2">
            {calculating === scope ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            {calculating === scope ? "Calculando..." : "Recalcular"}
          </Button>
          {scope === "salary" && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`${apiUrl}/api/payroll/export?month=${month}&type=salary`, "_blank")}
            >
              <Download className="h-4 w-4" />
              Exportar (Excel)
            </Button>
          )}
        </div>
      </div>

      {scope === "benefits" && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Relatórios para o financeiro (Excel)</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {BENEFIT_CATS.map(({ cat, label }) => (
                <Button key={cat} variant="outline" size="sm" className="gap-1" onClick={() => downloadReport(cat)}>
                  <FileSpreadsheet className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Recibos de pagamento (ZIP) — requer todos marcados como Pago
            </p>
            <div className="flex flex-wrap gap-2">
              {BENEFIT_CATS.map(({ cat, label }) => (
                <Button key={cat} variant="outline" size="sm" className="gap-1 text-emerald-700" onClick={() => downloadReceiptsZip(cat, label)}>
                  <Archive className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Carregando...</div>
          ) : scope === "salary" ? (
            <SalaryTable
              records={records}
              expandedRows={expandedRows}
              toggleRow={toggleRow}
              onPatch={(id, field, value) => patchMutation.mutate({ id, field, value })}
            />
          ) : (
            <BenefitTable
              records={records}
              onPatch={(id, field, value) => patchMutation.mutate({ id, field, value })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Breadcrumb({ parts }: { parts: { label: string; onClick: () => void }[] }) {
  return (
    <div className="mb-4 flex items-center gap-1 text-sm text-slate-500">
      <button onClick={parts[0].onClick} className="flex items-center gap-1 hover:text-blue-600">
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </button>
      <span className="mx-2 text-slate-300">|</span>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
          <button onClick={p.onClick} className="hover:text-blue-600">{p.label}</button>
        </span>
      ))}
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-blue-500 hover:bg-blue-50"
    >
      <div className="rounded-lg bg-blue-100 p-3 text-blue-700">{icon}</div>
      <div>
        <p className="text-lg font-semibold text-slate-800">{title}</p>
        {desc && <p className="text-sm text-slate-500">{desc}</p>}
      </div>
    </button>
  );
}

function PaidCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 cursor-pointer accent-emerald-600"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function SalaryTable({
  records,
  expandedRows,
  toggleRow,
  onPatch,
}: {
  records: PayrollRecord[];
  expandedRows: Set<string>;
  toggleRow: (id: string) => void;
  onPatch: (id: string, field: PatchField, value: boolean) => void;
}) {
  if (records.length === 0) {
    return <div className="py-10 text-center text-slate-400">Nenhum registro. Clique em Recalcular.</div>;
  }

  const totals = records.reduce(
    (acc, r) => {
      if (!r.included_salary) return acc;
      const adv = r.breakdown?.advance_totals || {};
      const salaryAdv = Number(adv.salario || 0) + Number(adv.produtos || 0);
      const inss = Number(r.inss || 0);
      const gross = Number(r.gross_pay);
      return {
        gross: acc.gross + gross,
        inss: acc.inss + inss,
        adv: acc.adv + salaryAdv,
        net: acc.net + (gross - inss - salaryAdv),
      };
    },
    { gross: 0, inss: 0, adv: 0, net: 0 }
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead className="w-12">Incluir</TableHead>
          <TableHead className="w-12">Pago?</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>CPF</TableHead>
          <TableHead className="text-right">Salário Bruto</TableHead>
          <TableHead className="text-right">INSS</TableHead>
          <TableHead className="text-right">Adiantamento</TableHead>
          <TableHead className="text-right">Salário Líquido</TableHead>
          <TableHead>Chave PIX</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => {
          const isExpanded = expandedRows.has(record.id);
          const breakdown = record.breakdown;
          const adv = breakdown?.advance_totals || {};
          const salaryAdv = Number(adv.salario || 0) + Number(adv.produtos || 0);
          const inss = Number(record.inss || 0);
          const gross = Number(record.gross_pay);
          const net = gross - inss - salaryAdv;
          const pix = breakdown?.pix_key || record.pix_key || "";
          const excluded = !record.included_salary;

          return (
            <Fragment key={record.id}>
              <TableRow className={`hover:bg-slate-50 ${excluded ? "opacity-50" : ""}`}>
                <TableCell className="cursor-pointer" onClick={() => toggleRow(record.id)}>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-emerald-600"
                    checked={record.included_salary}
                    onChange={(e) => onPatch(record.id, "included_salary", e.target.checked)}
                  />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <PaidCheckbox
                    checked={!!record.paid_salary}
                    onChange={(v) => onPatch(record.id, "paid_salary", v)}
                  />
                </TableCell>
                <TableCell className={`font-medium cursor-pointer ${excluded ? "line-through" : ""}`} onClick={() => toggleRow(record.id)}>
                  {record.person_name || "—"}
                </TableCell>
                <TableCell className="text-sm text-slate-600">{record.person_cpf || "—"}</TableCell>
                <TableCell className="text-right">{formatBRL(gross)}</TableCell>
                <TableCell className="text-right text-red-600">{inss > 0 ? `- ${formatBRL(inss)}` : "—"}</TableCell>
                <TableCell className="text-right text-amber-600">{salaryAdv > 0 ? `- ${formatBRL(salaryAdv)}` : "—"}</TableCell>
                <TableCell className="text-right font-bold text-emerald-700">{formatBRL(net)}</TableCell>
                <TableCell className="text-sm text-slate-500 max-w-[150px] truncate">{pix || "—"}</TableCell>
              </TableRow>
              {isExpanded && breakdown && (
                <TableRow>
                  <TableCell colSpan={10} className="bg-slate-50">
                    <div className="px-8 py-3 space-y-3 text-sm">
                      {breakdown.company_earnings && (
                        <div>
                          <p className="font-medium text-slate-700 mb-1">Comissões por Empresa:</p>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(breakdown.company_earnings).map(([company, data]) => (
                              <div key={company} className="rounded border p-2">
                                <p className="font-medium">{company}</p>
                                <p className="text-xs text-slate-500">{data.pct}% de {formatBRL(data.total_value)}</p>
                                <p className="text-emerald-700">{formatBRL(data.total_earning)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {breakdown.advances?.salario && breakdown.advances.salario.length > 0 && (
                        <div>
                          <p className="font-medium text-slate-700 mb-1">Adiantamentos de Salário:</p>
                          {breakdown.advances.salario.map((a, i) => (
                            <p key={i} className="text-slate-600">{formatBRL(a.amount)} em {a.date}</p>
                          ))}
                        </div>
                      )}
                      {breakdown.advances?.produtos && breakdown.advances.produtos.length > 0 && (
                        <div>
                          <p className="font-medium text-slate-700 mb-1">Adiantamentos de Produtos:</p>
                          {breakdown.advances.produtos.map((a, i) => (
                            <p key={i} className="text-slate-600">{a.product_name}: {formatBRL(a.amount)} em {a.date}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
        <TableRow className="bg-slate-100 font-bold">
          <TableCell colSpan={3} />
          <TableCell>TOTAL (incluídos)</TableCell>
          <TableCell />
          <TableCell className="text-right">{formatBRL(totals.gross)}</TableCell>
          <TableCell className="text-right text-red-600">{totals.inss > 0 ? `- ${formatBRL(totals.inss)}` : "—"}</TableCell>
          <TableCell className="text-right text-amber-600">{totals.adv > 0 ? `- ${formatBRL(totals.adv)}` : "—"}</TableCell>
          <TableCell className="text-right text-emerald-700">{formatBRL(totals.net)}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}

function BenefitTable({
  records,
  onPatch,
}: {
  records: PayrollRecord[];
  onPatch: (id: string, field: PatchField, value: boolean) => void;
}) {
  if (records.length === 0) {
    return <div className="py-10 text-center text-slate-400">Nenhum registro. Clique em Recalcular.</div>;
  }

  const totals = records.reduce(
    (acc, r) => {
      if (!r.included_benefits) return acc;
      const alim = benefitVal(r, "alimentacao");
      const trans = benefitVal(r, "transporte");
      const ref = benefitVal(r, "refeicao");
      return {
        alim: acc.alim + alim,
        trans: acc.trans + trans,
        ref: acc.ref + ref,
        gross: acc.gross + alim + trans + ref,
      };
    },
    { alim: 0, trans: 0, ref: 0, gross: 0 }
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Incluir</TableHead>
          <TableHead className="w-12">Pago?</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead className="text-right">Alimentação</TableHead>
          <TableHead className="text-right">Transporte</TableHead>
          <TableHead className="text-right">Refeição</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Chave PIX</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => {
          const alim = benefitVal(record, "alimentacao");
          const trans = benefitVal(record, "transporte");
          const ref = benefitVal(record, "refeicao");
          const gross = alim + trans + ref;
          const pix = record.breakdown?.pix_key || record.pix_key || "";
          const excluded = !record.included_benefits;
          return (
            <TableRow key={record.id} className={excluded ? "opacity-50" : ""}>
              <TableCell>
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-emerald-600"
                  checked={record.included_benefits}
                  onChange={(e) => onPatch(record.id, "included_benefits", e.target.checked)}
                />
              </TableCell>
              <TableCell>
                <PaidCheckbox
                  checked={!!record.paid_benefits}
                  onChange={(v) => onPatch(record.id, "paid_benefits", v)}
                />
              </TableCell>
              <TableCell className={`font-medium ${excluded ? "line-through" : ""}`}>{record.person_name || "—"}</TableCell>
              <TableCell className="text-right">{formatBRL(alim)}</TableCell>
              <TableCell className="text-right">{formatBRL(trans)}</TableCell>
              <TableCell className="text-right">{formatBRL(ref)}</TableCell>
              <TableCell className="text-right font-bold text-emerald-700">{formatBRL(gross)}</TableCell>
              <TableCell className="text-sm text-slate-500 max-w-[150px] truncate">{pix || "—"}</TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-slate-100 font-bold">
          <TableCell colSpan={2} />
          <TableCell>TOTAL (incluídos)</TableCell>
          <TableCell className="text-right">{formatBRL(totals.alim)}</TableCell>
          <TableCell className="text-right">{formatBRL(totals.trans)}</TableCell>
          <TableCell className="text-right">{formatBRL(totals.ref)}</TableCell>
          <TableCell className="text-right text-emerald-700">{formatBRL(totals.gross)}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}
