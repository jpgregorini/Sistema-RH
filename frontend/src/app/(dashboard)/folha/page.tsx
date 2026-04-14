"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, Download, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import type { Driver, Employee, PayrollRecord } from "@/types";

export default function FolhaPage() {
  const queryClient = useQueryClient();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [calculating, setCalculating] = useState(false);
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
  });

  const driverPayroll = payroll.filter((p) => p.person_type === "driver");
  const employeePayroll = payroll.filter((p) => p.person_type === "employee");

  const calculateAll = async () => {
    setCalculating(true);
    try {
      const allPeople = [
        ...drivers.map((d) => ({ type: "driver" as const, id: d.id })),
        ...employees.map((e) => ({ type: "employee" as const, id: e.id })),
      ];

      for (const person of allPeople) {
        await api.post("/api/payroll/generate", {
          person_type: person.type,
          person_id: person.id,
          month,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["payroll", month] });
      toast.success("Folha de pagamento calculada.");
    } catch {
      toast.error("Erro ao calcular folha.");
    }
    setCalculating(false);
  };

  const exportExcel = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    window.open(`${apiUrl}/api/payroll/export?month=${month}`, "_blank");
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderSalaryTable = (records: PayrollRecord[]) => {
    if (records.length === 0) {
      return (
        <div className="py-8 text-center text-slate-400">
          Nenhum registro encontrado. Calcule a folha primeiro.
        </div>
      );
    }

    const totals = records.reduce(
      (acc, r) => {
        const advTotals = r.breakdown?.advance_totals || {};
        const salaryAdv = Number(advTotals.salario || 0) + Number(advTotals.produtos || 0);
        return {
          gross: acc.gross + Number(r.gross_pay),
          inss: acc.inss + Number(r.inss || 0),
          advances: acc.advances + salaryAdv,
          net: acc.net + (Number(r.gross_pay) - Number(r.inss || 0) - salaryAdv),
        };
      },
      { gross: 0, inss: 0, advances: 0, net: 0 }
    );

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
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
            const advTotals = breakdown?.advance_totals || {};
            const salaryAdv = Number(advTotals.salario || 0) + Number(advTotals.produtos || 0);
            const inss = Number(record.inss || 0);
            const gross = Number(record.gross_pay);
            const netSalary = gross - inss - salaryAdv;
            const pixKey = breakdown?.pix_key || record.pix_key || "";

            return (
              <>
                <TableRow
                  key={record.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleRow(record.id)}
                >
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {record.person_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {record.person_cpf || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatBRL(gross)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {inss > 0 ? `- ${formatBRL(inss)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-amber-600">
                    {salaryAdv > 0 ? `- ${formatBRL(salaryAdv)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-700">
                    {formatBRL(netSalary)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 max-w-[150px] truncate">
                    {pixKey || "—"}
                  </TableCell>
                </TableRow>
                {isExpanded && breakdown && (
                  <TableRow key={`${record.id}-detail`}>
                    <TableCell colSpan={8} className="bg-slate-50">
                      <div className="px-8 py-3 space-y-3 text-sm">
                        {breakdown.company_earnings && (
                          <div>
                            <p className="font-medium text-slate-700 mb-1">
                              Comissões por Empresa:
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {Object.entries(breakdown.company_earnings).map(([company, data]) => (
                                <div key={company} className="rounded border p-2">
                                  <p className="font-medium">{company}</p>
                                  <p className="text-xs text-slate-500">
                                    {data.pct}% de {formatBRL(data.total_value)}
                                  </p>
                                  <p className="text-emerald-700">
                                    {formatBRL(data.total_earning)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {breakdown.advances && (
                          <div className="space-y-2">
                            {breakdown.advances.salario && breakdown.advances.salario.length > 0 && (
                              <div>
                                <p className="font-medium text-slate-700 mb-1">
                                  Adiantamentos de Salário:
                                </p>
                                {breakdown.advances.salario.map((a, i) => (
                                  <p key={i} className="text-slate-600">
                                    {formatBRL(a.amount)} em {a.date}
                                  </p>
                                ))}
                              </div>
                            )}
                            {breakdown.advances.produtos && breakdown.advances.produtos.length > 0 && (
                              <div>
                                <p className="font-medium text-slate-700 mb-1">
                                  Adiantamentos de Produtos:
                                </p>
                                {breakdown.advances.produtos.map((a, i) => (
                                  <p key={i} className="text-slate-600">
                                    {a.product_name}: {formatBRL(a.amount)} em {a.date}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}

          <TableRow className="bg-slate-100 font-bold">
            <TableCell></TableCell>
            <TableCell>TOTAL</TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right">{formatBRL(totals.gross)}</TableCell>
            <TableCell className="text-right text-red-600">
              {totals.inss > 0 ? `- ${formatBRL(totals.inss)}` : "—"}
            </TableCell>
            <TableCell className="text-right text-amber-600">
              {totals.advances > 0 ? `- ${formatBRL(totals.advances)}` : "—"}
            </TableCell>
            <TableCell className="text-right text-emerald-700">
              {formatBRL(totals.net)}
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };

  const renderBenefitTable = (records: PayrollRecord[]) => {
    if (records.length === 0) {
      return (
        <div className="py-8 text-center text-slate-400">
          Nenhum registro encontrado. Calcule a folha primeiro.
        </div>
      );
    }

    const totals = records.reduce(
      (acc, r) => {
        const b = r.breakdown?.benefit;
        const alim = b?.alimentacao_valor ?? Number(r.beneficio_alimentacao || 0);
        const trans = b?.transporte_valor ?? Number(r.beneficio_transporte || 0);
        const ref = b?.refeicao_valor ?? Number(r.beneficio_refeicao || 0);
        const dedAlim = b?.alimentacao_deducao ?? 0;
        const dedTrans = b?.transporte_deducao ?? 0;
        const dedRef = b?.refeicao_deducao ?? 0;
        const gross = alim + trans + ref;
        const net = gross - dedAlim - dedTrans - dedRef;
        return {
          gross: acc.gross + gross,
          alim: acc.alim + alim,
          dedAlim: acc.dedAlim + dedAlim,
          trans: acc.trans + trans,
          dedTrans: acc.dedTrans + dedTrans,
          ref: acc.ref + ref,
          dedRef: acc.dedRef + dedRef,
          net: acc.net + net,
        };
      },
      { gross: 0, alim: 0, dedAlim: 0, trans: 0, dedTrans: 0, ref: 0, dedRef: 0, net: 0 }
    );

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="text-right">Benefício Bruto</TableHead>
            <TableHead className="text-right">Alimentação</TableHead>
            <TableHead className="text-right text-red-600">Ded. Alim.</TableHead>
            <TableHead className="text-right">Transporte</TableHead>
            <TableHead className="text-right text-red-600">Ded. Transp.</TableHead>
            <TableHead className="text-right">Refeição</TableHead>
            <TableHead className="text-right text-red-600">Ded. Ref.</TableHead>
            <TableHead className="text-right">Benefício Líquido</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const b = record.breakdown?.benefit;
            const alim = b?.alimentacao_valor ?? Number(record.beneficio_alimentacao || 0);
            const trans = b?.transporte_valor ?? Number(record.beneficio_transporte || 0);
            const ref = b?.refeicao_valor ?? Number(record.beneficio_refeicao || 0);
            const dedAlim = b?.alimentacao_deducao ?? 0;
            const dedTrans = b?.transporte_deducao ?? 0;
            const dedRef = b?.refeicao_deducao ?? 0;
            const gross = alim + trans + ref;
            const net = gross - dedAlim - dedTrans - dedRef;

            return (
              <TableRow key={record.id}>
                <TableCell className="font-medium">
                  {record.person_name || "—"}
                </TableCell>
                <TableCell className="text-right">{formatBRL(gross)}</TableCell>
                <TableCell className="text-right">{formatBRL(alim)}</TableCell>
                <TableCell className="text-right text-red-600">
                  {dedAlim > 0 ? `- ${formatBRL(dedAlim)}` : "—"}
                </TableCell>
                <TableCell className="text-right">{formatBRL(trans)}</TableCell>
                <TableCell className="text-right text-red-600">
                  {dedTrans > 0 ? `- ${formatBRL(dedTrans)}` : "—"}
                </TableCell>
                <TableCell className="text-right">{formatBRL(ref)}</TableCell>
                <TableCell className="text-right text-red-600">
                  {dedRef > 0 ? `- ${formatBRL(dedRef)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-700">
                  {formatBRL(net)}
                </TableCell>
              </TableRow>
            );
          })}

          <TableRow className="bg-slate-100 font-bold">
            <TableCell>TOTAL</TableCell>
            <TableCell className="text-right">{formatBRL(totals.gross)}</TableCell>
            <TableCell className="text-right">{formatBRL(totals.alim)}</TableCell>
            <TableCell className="text-right text-red-600">
              {totals.dedAlim > 0 ? `- ${formatBRL(totals.dedAlim)}` : "—"}
            </TableCell>
            <TableCell className="text-right">{formatBRL(totals.trans)}</TableCell>
            <TableCell className="text-right text-red-600">
              {totals.dedTrans > 0 ? `- ${formatBRL(totals.dedTrans)}` : "—"}
            </TableCell>
            <TableCell className="text-right">{formatBRL(totals.ref)}</TableCell>
            <TableCell className="text-right text-red-600">
              {totals.dedRef > 0 ? `- ${formatBRL(totals.dedRef)}` : "—"}
            </TableCell>
            <TableCell className="text-right text-emerald-700">
              {formatBRL(totals.net)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Folha de Pagamento
          </h1>
          <p className="text-sm text-slate-500">
            Calcule e exporte a folha de pagamento mensal
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label>Mês:</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            onClick={calculateAll}
            disabled={calculating}
            className="gap-2"
          >
            {calculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4" />
            )}
            {calculating ? "Calculando..." : "Calcular Folha"}
          </Button>
          <Button
            variant="outline"
            onClick={exportExcel}
            disabled={payroll.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="motoristas">
        <TabsList className="mb-4">
          <TabsTrigger value="motoristas">
            Motoristas
            {driverPayroll.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {driverPayroll.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="funcionarios">
            Funcionários
            {employeePayroll.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {employeePayroll.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="motoristas">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-700">Folha de Salário</h3>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center text-slate-400">Carregando...</div>
                ) : (
                  renderSalaryTable(driverPayroll)
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-700">Folha de Benefícios</h3>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center text-slate-400">Carregando...</div>
                ) : (
                  renderBenefitTable(driverPayroll)
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="funcionarios">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-700">Folha de Salário</h3>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center text-slate-400">Carregando...</div>
                ) : (
                  renderSalaryTable(employeePayroll)
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-700">Folha de Benefícios</h3>
                </div>
                {isLoading ? (
                  <div className="py-8 text-center text-slate-400">Carregando...</div>
                ) : (
                  renderBenefitTable(employeePayroll)
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
