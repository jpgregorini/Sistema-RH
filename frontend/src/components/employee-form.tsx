"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase-browser";
import { cpfMask } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Copy, Link2, FileText, CheckCircle2, Clock, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Employee, ContractType } from "@/types";

interface EmployeeFormProps {
  employee?: Employee;
}

type Mode = "manual" | "link";

// All editable keys with sensible string defaults.
const FIELD_KEYS = [
  "name", "cpf", "pix_key", "date_of_birth", "residencia", "local_nascimento",
  "pais_nacionalidade", "estado_civil", "filiacao_pai", "filiacao_mae",
  "orgao_emissor", "grau_instrucao", "sexo", "cor", "deficiencia",
  "telefone_residencial", "telefone_celular", "matricula_esocial",
  "beneficiarios", "cedula_identidade", "rg_data_emissao", "titulo_eleitoral",
  "titulo_zona", "titulo_secao", "inscr_orgao_classe", "ctps", "ctps_serie",
  "ctps_data_expedicao", "ctps_uf", "cnh", "cnh_categoria", "doc_militar",
  "doc_militar_categoria", "cargo", "funcao", "cbo", "data_admissao",
  "salario_por", "horario_trabalho", "horario_intervalo", "fgts_opcao_em",
  "conta_vinculada_banco", "data_ratificacao", "pis_cadastrado_em", "pis_sob_n",
  "pis_domicilio_bancario", "pis_n_banco", "pis_agencia_codigo", "pis_end_agencia",
] as const;

export function EmployeeForm({ employee }: EmployeeFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!employee;
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const [mode, setMode] = useState<Mode>(
    (employee?.registration_mode as Mode) || "manual"
  );
  const [token, setToken] = useState<string | null>(
    employee?.registration_token || null
  );

  const init = (k: string) => {
    const v = employee?.[k as keyof Employee];
    return v === null || v === undefined ? "" : String(v);
  };
  const [form, setForm] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const k of FIELD_KEYS) o[k] = init(k);
    if (!o.pais_nacionalidade) o.pais_nacionalidade = "BRASIL";
    return o;
  });
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [contractType, setContractType] = useState<ContractType>(
    employee?.contract_type || "CLT"
  );
  const [baseSalary, setBaseSalary] = useState(
    employee?.base_salary ? String(employee.base_salary) : ""
  );
  const [payday, setPayday] = useState(employee?.payday || 5);
  const [notes, setNotes] = useState(employee?.notes || "");

  const [benefAlim, setBenefAlim] = useState(
    employee?.beneficio_alimentacao ? String(employee.beneficio_alimentacao) : ""
  );
  const [benefTrans, setBenefTrans] = useState(
    employee?.beneficio_transporte ? String(employee.beneficio_transporte) : ""
  );
  const [benefRef, setBenefRef] = useState(
    employee?.beneficio_refeicao ? String(employee.beneficio_refeicao) : ""
  );
  const [insalubridadePct, setInsalubridadePct] = useState<string>(
    employee?.insalubridade_pct ? String(employee.insalubridade_pct) : "0"
  );
  const [periculosidade, setPericulosidade] = useState<boolean>(
    employee?.periculosidade || false
  );

  const [photoUrl, setPhotoUrl] = useState(employee?.photo_url || "");
  const [contractUrl, setContractUrl] = useState(employee?.contract_file_url || "");
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = useCallback(
    async (file: File, onUrl: (url: string) => void) => {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) {
        toast.error("Erro ao enviar arquivo.");
        setUploading(false);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(path);
      onUrl(publicUrl);
      setUploading(false);
      toast.success("Arquivo enviado.");
    },
    []
  );

  const buildBody = () => {
    const body: Record<string, unknown> = {
      contract_type: contractType,
      base_salary: Number(baseSalary) || null,
      payday,
      notes: notes || null,
      beneficio_alimentacao: Number(benefAlim) || 0,
      beneficio_transporte: Number(benefTrans) || 0,
      beneficio_refeicao: Number(benefRef) || 0,
      insalubridade_pct: Number(insalubridadePct) || 0,
      periculosidade,
      photo_url: photoUrl || null,
      contract_file_url: contractUrl || null,
    };
    for (const k of FIELD_KEYS) {
      const v = form[k]?.trim();
      body[k] = v ? v : null;
    }
    if (!isEditing) body.registration_mode = mode;
    return body;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = buildBody();
      if (isEditing) {
        return api.put<Employee>(`/api/employees/${employee.id}`, body);
      }
      return api.post<Employee>("/api/employees", body);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      if (!isEditing && mode === "link") {
        setToken(saved.registration_token || null);
        toast.success("Funcionário criado. Copie o link e envie ao funcionário.");
        return; // stay on page to show the link
      }
      toast.success(
        isEditing ? "Funcionário atualizado." : "Funcionário cadastrado."
      );
      router.push("/funcionarios");
    },
    onError: () => toast.error("Erro ao salvar funcionário."),
  });

  const genLink = useMutation({
    mutationFn: () =>
      api.post<{ token: string }>(
        `/api/employees/${employee!.id}/registration-link`
      ),
    onSuccess: (r) => {
      setToken(r.token);
      toast.success("Link gerado.");
    },
  });

  const linkUrl = token ? `${appOrigin}/registro/${token}` : "";
  const copyLink = () => {
    navigator.clipboard.writeText(linkUrl);
    toast.success("Link copiado.");
  };

  const downloadRegistro = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    window.open(`${apiUrl}/api/employees/${employee!.id}/registro-pdf`, "_blank");
  };

  // In create+link mode the employee fills personal data AND name/CPF via the
  // public link, so RH doesn't enter those here.
  const linkCreate = mode === "link" && !isEditing;
  const showPersonal = !linkCreate;
  const showIdentity = !linkCreate;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditing ? "Editar Funcionário" : "Novo Funcionário"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEditing
            ? "Atualize as informações e gere o Registro de Empregado"
            : "Cadastre um novo funcionário no sistema"}
        </p>
      </div>

      {!isEditing && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <Label className="mb-2 block">Forma de cadastro</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  mode === "manual"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-semibold">Manual</p>
                <p className="text-xs text-slate-500">
                  RH preenche todos os campos do documento.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("link")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  mode === "link"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-semibold">Por Link</p>
                <p className="text-xs text-slate-500">
                  RH preenche dados de trabalho; funcionário preenche os dados
                  pessoais pelo link.
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {(token || (isEditing && employee?.registration_mode === "link")) && (
        <Card className="mb-4 border-blue-200 bg-blue-50/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Link2 className="h-4 w-4" />
              Link de preenchimento do funcionário
            </div>
            {token ? (
              <div className="flex gap-2">
                <Input readOnly value={linkUrl} className="bg-white" />
                <Button type="button" variant="outline" onClick={copyLink} className="gap-1">
                  <Copy className="h-4 w-4" />
                  Copiar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => genLink.mutate()}
                disabled={genLink.isPending}
              >
                Gerar link
              </Button>
            )}
            {employee?.registration_submitted_at ? (
              <p className="flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Funcionário enviou os dados.
              </p>
            ) : (
              <p className="flex items-center gap-1 text-xs text-amber-600">
                <Clock className="h-3.5 w-3.5" />
                Aguardando preenchimento do funcionário.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
        className="space-y-4"
      >
        {/* Identificação */}
        <Section title="Identificação">
          {showIdentity ? (
            <>
              <Field label="Nome Completo *" className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => set("name")(e.target.value)} required />
              </Field>
              <Field label="CPF *">
                <Input
                  value={form.cpf}
                  onChange={(e) => set("cpf")(cpfMask(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                />
              </Field>
            </>
          ) : (
            <div className="sm:col-span-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              Nome e CPF serão preenchidos pelo próprio funcionário através do link.
            </div>
          )}
          <Field label="Tipo de Contrato *">
            <Select value={contractType} onValueChange={(v) => v && setContractType(v as ContractType)}>
              <SelectTrigger>
                <span className="flex flex-1 text-left">{contractType}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLT">CLT</SelectItem>
                <SelectItem value="PJ">PJ</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dia de Pagamento *">
            <Input
              type="number"
              min={1}
              max={31}
              value={payday}
              onChange={(e) => setPayday(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Matrícula eSocial">
            <Input value={form.matricula_esocial} onChange={(e) => set("matricula_esocial")(e.target.value)} />
          </Field>
          <Field label="Beneficiários" className="sm:col-span-2">
            <Input value={form.beneficiarios} onChange={(e) => set("beneficiarios")(e.target.value)} />
          </Field>
        </Section>

        {/* Dados Pessoais — employee fills via link */}
        {showPersonal && (
          <Section
            title="Dados Pessoais"
            hint={
              mode === "link"
                ? "Preenchidos pelo funcionário via link (editável aqui também)."
                : undefined
            }
          >
            <Field label="Data de Nascimento">
              <Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth")(e.target.value)} />
            </Field>
            <Field label="Local de Nascimento">
              <Input value={form.local_nascimento} onChange={(e) => set("local_nascimento")(e.target.value)} placeholder="Cidade - UF" />
            </Field>
            <Field label="País de Nacionalidade">
              <Input value={form.pais_nacionalidade} onChange={(e) => set("pais_nacionalidade")(e.target.value)} />
            </Field>
            <Field label="Estado Civil">
              <Select value={form.estado_civil} onValueChange={(v) => v && set("estado_civil")(v)}>
                <SelectTrigger>
                  <span className="flex flex-1 text-left">{form.estado_civil || "Selecione"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solteiro">Solteiro(a)</SelectItem>
                  <SelectItem value="Casado">Casado(a)</SelectItem>
                  <SelectItem value="Divorciado">Divorciado(a)</SelectItem>
                  <SelectItem value="Viúvo">Viúvo(a)</SelectItem>
                  <SelectItem value="União Estável">União Estável</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Residência (endereço completo)" className="sm:col-span-2">
              <Textarea rows={2} value={form.residencia} onChange={(e) => set("residencia")(e.target.value)} />
            </Field>
            <Field label="Filiação - Pai">
              <Input value={form.filiacao_pai} onChange={(e) => set("filiacao_pai")(e.target.value)} />
            </Field>
            <Field label="Filiação - Mãe">
              <Input value={form.filiacao_mae} onChange={(e) => set("filiacao_mae")(e.target.value)} />
            </Field>
            <Field label="Sexo">
              <Select value={form.sexo} onValueChange={(v) => v && set("sexo")(v)}>
                <SelectTrigger>
                  <span className="flex flex-1 text-left">{form.sexo || "Selecione"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cor / Raça">
              <Input value={form.cor} onChange={(e) => set("cor")(e.target.value)} />
            </Field>
            <Field label="Grau de Instrução">
              <Input value={form.grau_instrucao} onChange={(e) => set("grau_instrucao")(e.target.value)} />
            </Field>
            <Field label="Deficiência">
              <Input value={form.deficiencia} onChange={(e) => set("deficiencia")(e.target.value)} placeholder="Não / tipo" />
            </Field>
            <Field label="Órgão Emissor (RG)">
              <Input value={form.orgao_emissor} onChange={(e) => set("orgao_emissor")(e.target.value)} placeholder="SSP/UF" />
            </Field>
            <Field label="Telefone Residencial">
              <Input value={form.telefone_residencial} onChange={(e) => set("telefone_residencial")(e.target.value)} />
            </Field>
            <Field label="Telefone Celular">
              <Input value={form.telefone_celular} onChange={(e) => set("telefone_celular")(e.target.value)} />
            </Field>
            <Field label="Chave PIX">
              <Input value={form.pix_key} onChange={(e) => set("pix_key")(e.target.value)} />
            </Field>
          </Section>
        )}

        {/* Trabalho — RH */}
        <Section title="Dados de Trabalho" hint="Preenchidos pelo RH (confidenciais).">
          <Field label="Cargo">
            <Input value={form.cargo} onChange={(e) => set("cargo")(e.target.value)} />
          </Field>
          <Field label="Função">
            <Input value={form.funcao} onChange={(e) => set("funcao")(e.target.value)} />
          </Field>
          <Field label="C.B.O.">
            <Input value={form.cbo} onChange={(e) => set("cbo")(e.target.value)} />
          </Field>
          <Field label="Data de Admissão">
            <Input type="date" value={form.data_admissao} onChange={(e) => set("data_admissao")(e.target.value)} />
          </Field>
          <Field label="Salário Base (R$)">
            <Input type="number" step="0.01" min="0" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Por">
            <Select value={form.salario_por} onValueChange={(v) => v && set("salario_por")(v)}>
              <SelectTrigger>
                <span className="flex flex-1 text-left">{form.salario_por || "Selecione"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mês">Mês</SelectItem>
                <SelectItem value="Quinzena">Quinzena</SelectItem>
                <SelectItem value="Semana">Semana</SelectItem>
                <SelectItem value="Dia">Dia</SelectItem>
                <SelectItem value="Hora">Hora</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Horário de Trabalho">
            <Input value={form.horario_trabalho} onChange={(e) => set("horario_trabalho")(e.target.value)} placeholder="das 08:00 as 17:00" />
          </Field>
          <Field label="Horário de Intervalo">
            <Input value={form.horario_intervalo} onChange={(e) => set("horario_intervalo")(e.target.value)} placeholder="das 12:00 as 13:00" />
          </Field>
          <Field label="FGTS - Opção em">
            <Input type="date" value={form.fgts_opcao_em} onChange={(e) => set("fgts_opcao_em")(e.target.value)} />
          </Field>
          <Field label="Conta vinculada no banco">
            <Input value={form.conta_vinculada_banco} onChange={(e) => set("conta_vinculada_banco")(e.target.value)} />
          </Field>
          <Field label="Data da Ratificação">
            <Input value={form.data_ratificacao} onChange={(e) => set("data_ratificacao")(e.target.value)} />
          </Field>
        </Section>

        {/* Documentos (opcional) */}
        <Section title="Documentos (opcional)">
          <Field label="Cédula de Identidade (RG)">
            <Input value={form.cedula_identidade} onChange={(e) => set("cedula_identidade")(e.target.value)} />
          </Field>
          <Field label="Data de emissão (RG)">
            <Input value={form.rg_data_emissao} onChange={(e) => set("rg_data_emissao")(e.target.value)} />
          </Field>
          <Field label="Título Eleitoral">
            <Input value={form.titulo_eleitoral} onChange={(e) => set("titulo_eleitoral")(e.target.value)} />
          </Field>
          <Field label="Zona">
            <Input value={form.titulo_zona} onChange={(e) => set("titulo_zona")(e.target.value)} />
          </Field>
          <Field label="Seção">
            <Input value={form.titulo_secao} onChange={(e) => set("titulo_secao")(e.target.value)} />
          </Field>
          <Field label="Inscr. Órgão de Classe">
            <Input value={form.inscr_orgao_classe} onChange={(e) => set("inscr_orgao_classe")(e.target.value)} />
          </Field>
          <Field label="CTPS">
            <Input value={form.ctps} onChange={(e) => set("ctps")(e.target.value)} />
          </Field>
          <Field label="Série CTPS">
            <Input value={form.ctps_serie} onChange={(e) => set("ctps_serie")(e.target.value)} />
          </Field>
          <Field label="Data expedição CTPS">
            <Input value={form.ctps_data_expedicao} onChange={(e) => set("ctps_data_expedicao")(e.target.value)} />
          </Field>
          <Field label="UF CTPS">
            <Input value={form.ctps_uf} onChange={(e) => set("ctps_uf")(e.target.value)} />
          </Field>
          <Field label="CNH">
            <Input value={form.cnh} onChange={(e) => set("cnh")(e.target.value)} />
          </Field>
          <Field label="Categoria CNH">
            <Input value={form.cnh_categoria} onChange={(e) => set("cnh_categoria")(e.target.value)} />
          </Field>
          <Field label="Doc. Militar">
            <Input value={form.doc_militar} onChange={(e) => set("doc_militar")(e.target.value)} />
          </Field>
          <Field label="Categoria (Militar)">
            <Input value={form.doc_militar_categoria} onChange={(e) => set("doc_militar_categoria")(e.target.value)} />
          </Field>
        </Section>

        {/* PIS / Banco (opcional) */}
        <Section title="PIS / Banco (opcional)">
          <Field label="Cadastrado em">
            <Input value={form.pis_cadastrado_em} onChange={(e) => set("pis_cadastrado_em")(e.target.value)} />
          </Field>
          <Field label="Sob nº">
            <Input value={form.pis_sob_n} onChange={(e) => set("pis_sob_n")(e.target.value)} />
          </Field>
          <Field label="Domicílio bancário">
            <Input value={form.pis_domicilio_bancario} onChange={(e) => set("pis_domicilio_bancario")(e.target.value)} />
          </Field>
          <Field label="Nº banco">
            <Input value={form.pis_n_banco} onChange={(e) => set("pis_n_banco")(e.target.value)} />
          </Field>
          <Field label="Agência código">
            <Input value={form.pis_agencia_codigo} onChange={(e) => set("pis_agencia_codigo")(e.target.value)} />
          </Field>
          <Field label="End. da agência">
            <Input value={form.pis_end_agencia} onChange={(e) => set("pis_end_agencia")(e.target.value)} />
          </Field>
        </Section>

        {/* Adicionais + Benefícios */}
        <Section title="Adicionais e Benefícios" hint="Insalubridade sobre salário mínimo (R$ 1.621,00); periculosidade = 30% do salário base.">
          <Field label="Insalubridade">
            <Select value={insalubridadePct} onValueChange={(v) => v && setInsalubridadePct(v)}>
              <SelectTrigger>
                <span className="flex flex-1 text-left">
                  {insalubridadePct === "0" ? "Sem insalubridade" : `${insalubridadePct}%`}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem insalubridade</SelectItem>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="40">40%</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Periculosidade">
            <label className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={periculosidade}
                onChange={(e) => setPericulosidade(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm">Recebe periculosidade</span>
            </label>
          </Field>
          <Field label="Benefício Alimentação (R$)">
            <Input type="number" step="0.01" min="0" value={benefAlim} onChange={(e) => setBenefAlim(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Benefício Transporte (R$)">
            <Input type="number" step="0.01" min="0" value={benefTrans} onChange={(e) => setBenefTrans(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Benefício Refeição (R$)">
            <Input type="number" step="0.01" min="0" value={benefRef} onChange={(e) => setBenefRef(e.target.value)} placeholder="0,00" />
          </Field>
        </Section>

        <Section title="Anexos">
          <Field label="Foto (opcional)">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-blue-400">
              <Upload className="h-4 w-4" />
              {photoUrl ? "Alterar foto" : "Enviar foto"}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, setPhotoUrl);
                }}
              />
            </label>
            {photoUrl && <span className="text-xs text-emerald-600">Arquivo enviado</span>}
          </Field>
          <Field label="Contrato (opcional)">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-blue-400">
              <Upload className="h-4 w-4" />
              {contractUrl ? "Alterar contrato" : "Enviar contrato"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, setContractUrl);
                }}
              />
            </label>
            {contractUrl && <span className="text-xs text-emerald-600">Arquivo enviado</span>}
          </Field>
        </Section>

        <Section title="Observações">
          <Field label="Observações internas" className="sm:col-span-2">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </Section>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending
              ? "Salvando..."
              : isEditing
              ? "Atualizar Funcionário"
              : mode === "link"
              ? "Criar e Gerar Link"
              : "Cadastrar Funcionário"}
          </Button>
          {isEditing && (
            <Button type="button" variant="outline" className="gap-2" onClick={downloadRegistro}>
              <FileText className="h-4 w-4" />
              Gerar Registro de Empregado
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => router.push("/funcionarios")}>
            {token && !isEditing ? "Concluir" : "Cancelar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
