"use client";

import { useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
import { CheckCircle2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import type { PublicRegistration } from "@/types";

const DOC_LABELS: { kind: string; label: string; optional?: boolean }[] = [
  { kind: "comprovante_endereco", label: "Comprovante de Endereço" },
  { kind: "rg_cnh", label: "RG / CNH" },
  { kind: "foto", label: "Foto", optional: true },
];

const PUBLIC_FIELDS = [
  "name", "cpf", "email", "pix_key", "date_of_birth", "residencia",
  "local_nascimento", "pais_nacionalidade", "estado_civil", "filiacao_pai",
  "filiacao_mae", "orgao_emissor", "grau_instrucao", "sexo", "cor",
  "deficiencia", "telefone_residencial", "telefone_celular",
  "cedula_identidade", "rg_data_emissao", "titulo_eleitoral", "titulo_zona",
  "titulo_secao", "inscr_orgao_classe", "ctps", "ctps_serie",
  "ctps_data_expedicao", "ctps_uf", "cnh", "cnh_categoria", "doc_militar",
  "doc_militar_categoria",
  "pis_cadastrado_em", "pis_sob_n", "pis_domicilio_bancario", "pis_n_banco",
  "pis_agencia_codigo", "pis_end_agencia",
] as const;

// Optional document / PIS fields rendered as extra sections.
const DOC_FIELDS: { key: string; label: string }[] = [
  { key: "cedula_identidade", label: "Cédula de Identidade (RG)" },
  { key: "rg_data_emissao", label: "Data de emissão (RG)" },
  { key: "titulo_eleitoral", label: "Título Eleitoral" },
  { key: "titulo_zona", label: "Zona" },
  { key: "titulo_secao", label: "Seção" },
  { key: "inscr_orgao_classe", label: "Inscr. Órgão de Classe" },
  { key: "ctps", label: "CTPS" },
  { key: "ctps_serie", label: "Série CTPS" },
  { key: "ctps_data_expedicao", label: "Data expedição CTPS" },
  { key: "ctps_uf", label: "UF CTPS" },
  { key: "cnh", label: "CNH" },
  { key: "cnh_categoria", label: "Categoria CNH" },
  { key: "doc_militar", label: "Doc. Militar" },
  { key: "doc_militar_categoria", label: "Categoria (Militar)" },
];
const PIS_FIELDS: { key: string; label: string }[] = [
  { key: "pis_cadastrado_em", label: "Cadastrado em" },
  { key: "pis_sob_n", label: "Sob nº" },
  { key: "pis_domicilio_bancario", label: "Domicílio bancário" },
  { key: "pis_n_banco", label: "Nº banco" },
  { key: "pis_agencia_codigo", label: "Agência código" },
  { key: "pis_end_agencia", label: "End. da agência" },
];

export default function PublicRegistrationPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, isError } = useQuery<PublicRegistration>({
    queryKey: ["public-registration", token],
    queryFn: () => api.get(`/api/public/employee-registration/${token}`),
    retry: false,
  });

  // Edits overlay on top of the loaded data — avoids syncing data into state
  // via an effect (which the build's lint rules reject).
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [doneOverride, setDoneOverride] = useState<boolean | null>(null);
  const [docOverlay, setDocOverlay] = useState<Record<string, string>>({});
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const set = (k: string) => (v: string) => setEdits((e) => ({ ...e, [k]: v }));

  const docUrl = (kind: string): string =>
    docOverlay[kind] ?? (data?.documents?.[kind] ?? "") ?? "";

  const uploadDoc = async (kind: string, file: File) => {
    setUploadingKind(kind);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);
      const r = await api.upload<{ kind: string; url: string }>(
        `/api/public/employee-registration/${token}/document`,
        fd
      );
      setDocOverlay((o) => ({ ...o, [kind]: r.url }));
      toast.success("Documento enviado.");
    } catch {
      toast.error("Erro ao enviar documento.");
    }
    setUploadingKind(null);
  };

  const val = (k: string): string => {
    if (k in edits) return edits[k];
    const v = data?.fields?.[k];
    if (v !== null && v !== undefined && v !== "") return String(v);
    if (k === "pais_nacionalidade") return "BRASIL";
    return "";
  };

  const done = doneOverride !== null ? doneOverride : !!data?.submitted_at;

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const k of PUBLIC_FIELDS) {
        const v = val(k).trim();
        body[k] = v ? v : null;
      }
      return api.put(`/api/public/employee-registration/${token}`, body);
    },
    onSuccess: () => {
      setDoneOverride(true);
      toast.success("Dados enviados com sucesso!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: () => toast.error("Erro ao enviar. Tente novamente."),
  });

  const validate = () => {
    const missing: string[] = [];
    const checks: [string, string][] = [
      ["name", "Nome"],
      ["cpf", "CPF"],
      ["email", "E-mail"],
      ["residencia", "Residência"],
      ["date_of_birth", "Data de nascimento"],
      ["local_nascimento", "Local de nascimento"],
      ["pais_nacionalidade", "País de nacionalidade"],
      ["estado_civil", "Estado civil"],
      ["filiacao_pai", "Filiação (pai)"],
      ["filiacao_mae", "Filiação (mãe)"],
      ["orgao_emissor", "Órgão emissor"],
      ["grau_instrucao", "Grau de instrução"],
      ["sexo", "Sexo"],
      ["cor", "Cor"],
      ["deficiencia", "Deficiência"],
      ["pix_key", "Chave PIX"],
    ];
    for (const [k, label] of checks) if (!val(k).trim()) missing.push(label);
    if (!val("telefone_residencial").trim() && !val("telefone_celular").trim())
      missing.push("Telefone (fixo ou celular)");
    return missing;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-lg font-bold text-slate-900">Link inválido</h1>
            <p className="mt-2 text-sm text-slate-500">
              Este link de cadastro não é válido ou já não está disponível.
              Solicite um novo link ao RH.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{data.employer.name}</p>
            <p className="text-xs text-slate-500">CNPJ: {data.employer.cnpj}</p>
          </div>
          <Image src="/logo.png" alt="Logo" width={120} height={36} className="h-8 w-auto object-contain" priority />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Ficha de Cadastro</h1>
          <p className="text-sm text-slate-500">
            Preencha seus dados pessoais para o registro de empregado.
          </p>
        </div>

        {done ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                Dados enviados!
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Obrigado. O RH foi notificado e dará sequência ao seu registro.
                Você pode fechar esta página.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setDoneOverride(false)}
              >
                Revisar / editar dados
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const missing = validate();
              if (missing.length) {
                toast.error("Preencha: " + missing.join(", "));
                return;
              }
              submit.mutate();
            }}
          >
            <Card>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                <Field label="Nome Completo *" className="sm:col-span-2">
                  <Input value={val("name")} onChange={(e) => set("name")(e.target.value)} required />
                </Field>
                <Field label="CPF *">
                  <Input
                    value={val("cpf")}
                    onChange={(e) => set("cpf")(cpfMask(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </Field>
                <Field label="E-mail *" className="sm:col-span-2">
                  <Input
                    type="email"
                    value={val("email")}
                    onChange={(e) => set("email")(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </Field>
                <Field label="Chave PIX *">
                  <Input value={val("pix_key")} onChange={(e) => set("pix_key")(e.target.value)} />
                </Field>
                <Field label="Data de Nascimento *">
                  <Input type="date" value={val("date_of_birth")} onChange={(e) => set("date_of_birth")(e.target.value)} />
                </Field>
                <Field label="Local de Nascimento *">
                  <Input value={val("local_nascimento")} onChange={(e) => set("local_nascimento")(e.target.value)} placeholder="Cidade - UF" />
                </Field>
                <Field label="Residência (endereço completo) *" className="sm:col-span-2">
                  <Textarea rows={2} value={val("residencia")} onChange={(e) => set("residencia")(e.target.value)} />
                </Field>
                <Field label="País de Nacionalidade *">
                  <Input value={val("pais_nacionalidade")} onChange={(e) => set("pais_nacionalidade")(e.target.value)} />
                </Field>
                <Field label="Estado Civil *">
                  <Select value={val("estado_civil")} onValueChange={(v) => v && set("estado_civil")(v)}>
                    <SelectTrigger>
                      <span className="flex flex-1 text-left">{val("estado_civil") || "Selecione"}</span>
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
                <Field label="Filiação - Pai *">
                  <Input value={val("filiacao_pai")} onChange={(e) => set("filiacao_pai")(e.target.value)} />
                </Field>
                <Field label="Filiação - Mãe *">
                  <Input value={val("filiacao_mae")} onChange={(e) => set("filiacao_mae")(e.target.value)} />
                </Field>
                <Field label="Sexo *">
                  <Select value={val("sexo")} onValueChange={(v) => v && set("sexo")(v)}>
                    <SelectTrigger>
                      <span className="flex flex-1 text-left">{val("sexo") || "Selecione"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Cor / Raça *">
                  <Input value={val("cor")} onChange={(e) => set("cor")(e.target.value)} />
                </Field>
                <Field label="Grau de Instrução *">
                  <Input value={val("grau_instrucao")} onChange={(e) => set("grau_instrucao")(e.target.value)} />
                </Field>
                <Field label="Deficiência *">
                  <Input value={val("deficiencia")} onChange={(e) => set("deficiencia")(e.target.value)} placeholder="Não / tipo" />
                </Field>
                <Field label="Órgão Emissor (RG) *">
                  <Input value={val("orgao_emissor")} onChange={(e) => set("orgao_emissor")(e.target.value)} placeholder="SSP/UF" />
                </Field>
                <Field label="Telefone Fixo">
                  <Input value={val("telefone_residencial")} onChange={(e) => set("telefone_residencial")(e.target.value)} />
                </Field>
                <Field label="Telefone Celular">
                  <Input value={val("telefone_celular")} onChange={(e) => set("telefone_celular")(e.target.value)} />
                </Field>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="p-6">
                <p className="mb-1 text-sm font-semibold text-slate-700">Documentos (opcional)</p>
                <p className="mb-4 text-xs text-slate-500">Preencha o que tiver em mãos.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {DOC_FIELDS.map(({ key, label }) => (
                    <Field key={key} label={label}>
                      <Input value={val(key)} onChange={(e) => set(key)(e.target.value)} />
                    </Field>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="p-6">
                <p className="mb-1 text-sm font-semibold text-slate-700">PIS / Banco (opcional)</p>
                <p className="mb-4 text-xs text-slate-500">Preencha o que tiver em mãos.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PIS_FIELDS.map(({ key, label }) => (
                    <Field key={key} label={label}>
                      <Input value={val(key)} onChange={(e) => set(key)(e.target.value)} />
                    </Field>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="p-6">
                <p className="mb-1 text-sm font-semibold text-slate-700">
                  Anexos
                </p>
                <p className="mb-4 text-xs text-slate-500">
                  Anexe foto ou PDF dos documentos. Comprovante de Endereço e
                  RG/CNH são necessários; foto é opcional.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {DOC_LABELS.map(({ kind, label, optional }) => {
                    const url = docUrl(kind);
                    const busy = uploadingKind === kind;
                    return (
                      <div key={kind} className="space-y-2">
                        <Label>
                          {label} {optional ? "" : "*"}
                        </Label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:border-blue-400">
                          {url ? (
                            <FileText className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {busy
                            ? "Enviando..."
                            : url
                            ? "Trocar arquivo"
                            : "Enviar arquivo"}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            disabled={busy}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadDoc(kind, file);
                            }}
                          />
                        </label>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-emerald-600 underline"
                          >
                            Arquivo enviado
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <p className="mt-3 text-xs text-slate-500">
              Informe ao menos um telefone (fixo ou celular). Campos com * são obrigatórios.
            </p>

            <div className="mt-5">
              <Button type="submit" disabled={submit.isPending} className="w-full sm:w-auto">
                {submit.isPending ? "Enviando..." : "Enviar dados"}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
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
